import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { extractText, printOutput } from "../output/json.js";
import type { BeadsPushIssue } from "../util/beads.js";
import {
	assessBeadsSchema,
	buildBeadsProperties,
	detectBeadsPropertiesFromQueryPayload,
	extractBeadsDatabaseInfoFromText,
	extractResultJson,
	extractSelfUserFromPayload,
	normalizeBeadsQueryPayload,
	parseBeadsPushInput,
} from "../util/beads.js";
import { CliError } from "../util/errors.js";
import { readStdin } from "../util/stdin.js";

interface BeadsStatusOptions {
	databaseId?: string;
	viewUrl?: string;
}

interface BeadsPullOptions {
	viewUrl?: string;
}

interface BeadsPushOptions {
	databaseId?: string;
	viewUrl?: string;
	input?: string;
	data?: string;
}

interface ToolCall {
	tool: string;
	args: Record<string, unknown>;
}

function requireOption(
	value: string | undefined,
	flag: string,
	what: string,
	commandName: string,
): string {
	if (value) {
		return value;
	}
	throw new CliError(
		`Missing ${flag}`,
		`${what} is required`,
		`Run "ncli beads ${commandName} --help" for usage`,
	);
}

async function readPushInput(opts: BeadsPushOptions) {
	if (opts.data) {
		return parseBeadsPushInput(opts.data);
	}
	if (!opts.input) {
		throw new CliError(
			"Missing push input",
			"beads push requires --input <path|-> or --data <json>",
			"Pass --input issues.json, --input -, or --data '{\"issues\":[...]}'.",
		);
	}
	const raw = opts.input === "-" ? await readStdin() : await readFile(opts.input, "utf8");
	return parseBeadsPushInput(raw);
}

export function buildBeadsAuthCall(): ToolCall {
	return { tool: "notion-get-users", args: { user_id: "self" } };
}

export function buildBeadsFetchCall(databaseId: string): ToolCall {
	return { tool: "notion-fetch", args: { id: databaseId } };
}

export function buildBeadsPullCall(viewUrl: string): ToolCall {
	return { tool: "notion-query-database-view", args: { view_url: viewUrl } };
}

export function buildBeadsCreateCall(dataSourceId: string, issues: BeadsPushIssue[]): ToolCall {
	return {
		tool: "notion-create-pages",
		args: {
			parent: { data_source_id: dataSourceId, type: "data_source_id" },
			pages: issues.map((issue) => ({ properties: buildBeadsProperties(issue) })),
		},
	};
}

export function buildBeadsUpdateCall(pageId: string, issue: BeadsPushIssue): ToolCall {
	return {
		tool: "notion-update-page",
		args: {
			page_id: pageId,
			command: "update_properties",
			properties: buildBeadsProperties(issue),
		},
	};
}

async function runBeadsStatus(opts: BeadsStatusOptions, cmd: Command): Promise<void> {
	const databaseId = requireOption(
		opts.databaseId,
		"--database-id",
		"A Notion database ID",
		"status",
	);

	await withConnection(async (conn) => {
		const authCall = buildBeadsAuthCall();
		const authResult = (await conn.callTool(authCall.tool, authCall.args)) as Record<
			string,
			unknown
		>;
		const authPayload = extractResultJson(authResult, "beads status auth");

		const fetchCall = buildBeadsFetchCall(databaseId);
		const fetchResult = (await conn.callTool(fetchCall.tool, fetchCall.args)) as Record<
			string,
			unknown
		>;
		const databaseInfo = extractBeadsDatabaseInfoFromText(extractText(fetchResult));

		let queryResult: Record<string, unknown> | null = null;
		let schema = assessBeadsSchema([], false);
		if (opts.viewUrl) {
			const queryCall = buildBeadsPullCall(opts.viewUrl);
			queryResult = (await conn.callTool(queryCall.tool, queryCall.args)) as Record<
				string,
				unknown
			>;
			const queryPayload = extractResultJson(queryResult, "beads status query");
			schema = assessBeadsSchema(detectBeadsPropertiesFromQueryPayload(queryPayload), true);
		}

		const payload = {
			ready: !!databaseInfo.data_source_id && (!schema.checked || schema.missing.length === 0),
			auth: {
				ok: true,
				user: extractSelfUserFromPayload(authPayload),
			},
			database: {
				id: databaseInfo.database_id ?? databaseId,
				url: databaseInfo.database_url,
			},
			data_source_id: databaseInfo.data_source_id,
			views: databaseInfo.views,
			schema,
		};

		const rawPayload = {
			auth: authResult,
			fetch: fetchResult,
			query: queryResult,
		};

		printOutput(
			(cmd.optsWithGlobals().raw ? rawPayload : payload) as Record<string, unknown>,
			cmd.optsWithGlobals(),
		);
	});
}

async function runBeadsPull(opts: BeadsPullOptions, cmd: Command): Promise<void> {
	const viewUrl = requireOption(opts.viewUrl, "--view-url", "A Notion database view URL", "pull");

	await withConnection(async (conn) => {
		const queryCall = buildBeadsPullCall(viewUrl);
		const result = (await conn.callTool(queryCall.tool, queryCall.args)) as Record<string, unknown>;
		const payload = normalizeBeadsQueryPayload(extractResultJson(result, "beads pull"));
		printOutput(
			(cmd.optsWithGlobals().raw ? result : payload) as Record<string, unknown>,
			cmd.optsWithGlobals(),
		);
	});
}

async function runBeadsPush(opts: BeadsPushOptions, cmd: Command): Promise<void> {
	const databaseId = requireOption(
		opts.databaseId,
		"--database-id",
		"A Notion database ID",
		"push",
	);
	const viewUrl = requireOption(opts.viewUrl, "--view-url", "A Notion database view URL", "push");
	const input = await readPushInput(opts);

	await withConnection(async (conn) => {
		const fetchCall = buildBeadsFetchCall(databaseId);
		const fetchResult = (await conn.callTool(fetchCall.tool, fetchCall.args)) as Record<
			string,
			unknown
		>;
		const databaseInfo = extractBeadsDatabaseInfoFromText(extractText(fetchResult));
		if (!databaseInfo.data_source_id) {
			throw new CliError(
				"Missing data source ID",
				`Could not extract a data_source_id from database ${databaseId}`,
				'Run "ncli fetch <db-id> --raw" and check that the target is a database page',
			);
		}

		const queryCall = buildBeadsPullCall(viewUrl);
		const queryResult = (await conn.callTool(queryCall.tool, queryCall.args)) as Record<
			string,
			unknown
		>;
		const queryPayload = extractResultJson(queryResult, "beads push preflight query");
		const existing = normalizeBeadsQueryPayload(queryPayload).issues;
		const schema = assessBeadsSchema(detectBeadsPropertiesFromQueryPayload(queryPayload), true);
		if (schema.missing.length > 0) {
			throw new CliError(
				"Invalid beads database schema",
				`The target view is missing required properties: ${schema.missing.join(", ")}`,
				"Use the dedicated beads database schema before pushing issues",
			);
		}

		const existingById = new Map(existing.map((issue) => [issue.id, issue]));
		const toCreate: BeadsPushIssue[] = [];
		const toUpdate: Array<{ pageId: string; issue: BeadsPushIssue }> = [];

		for (const issue of input.issues) {
			const current = existingById.get(issue.id);
			if (current?.notion_page_id) {
				toUpdate.push({ pageId: current.notion_page_id, issue });
			} else {
				toCreate.push(issue);
			}
		}

		let createResult: Record<string, unknown> | null = null;
		if (toCreate.length > 0) {
			const createCall = buildBeadsCreateCall(databaseInfo.data_source_id, toCreate);
			createResult = (await conn.callTool(createCall.tool, createCall.args)) as Record<
				string,
				unknown
			>;
		}

		const updateResults: Array<{ id: string; result: Record<string, unknown> }> = [];
		for (const update of toUpdate) {
			const updateCall = buildBeadsUpdateCall(update.pageId, update.issue);
			const result = (await conn.callTool(updateCall.tool, updateCall.args)) as Record<
				string,
				unknown
			>;
			updateResults.push({ id: update.issue.id, result });
		}

		const payload = {
			input_count: input.issues.length,
			created_count: toCreate.length,
			updated_count: toUpdate.length,
			created: toCreate.map((issue) => ({
				id: issue.id,
				title: issue.title,
			})),
			updated: toUpdate.map((issue) => ({
				id: issue.issue.id,
				title: issue.issue.title,
				notion_page_id: issue.pageId,
			})),
		};

		const rawPayload = {
			fetch: fetchResult,
			query: queryResult,
			create: createResult,
			updates: updateResults,
		};

		printOutput(
			(cmd.optsWithGlobals().raw ? rawPayload : payload) as Record<string, unknown>,
			cmd.optsWithGlobals(),
		);
	});
}

export function registerBeadsCommands(program: Command): void {
	const beads = program.command("beads").description("Beads-oriented Notion sync workflows");

	beads
		.command("status")
		.description("Check database connectivity and beads schema readiness")
		.requiredOption("--database-id <id>", "Notion database ID")
		.option("--view-url <url>", "Database view URL used to validate schema fields")
		.addHelpText(
			"after",
			`
Examples:
  ncli beads status --database-id <db-id>
  ncli beads status --database-id <db-id> --view-url "view://<view-id>"

The dedicated beads database schema expects:
  Name, Beads ID, Status, Priority, Type, Description
Optional:
  Assignee, Labels`,
		)
		.action(async (opts: BeadsStatusOptions, cmd: Command) => {
			await runBeadsStatus(opts, cmd);
		});

	beads
		.command("pull")
		.description("Normalize a Notion beads view into beads-friendly JSON")
		.requiredOption("--view-url <url>", "Database view URL")
		.addHelpText(
			"after",
			`
Example:
  ncli beads pull --view-url "view://<view-id>" --json

Output:
  { "issues": [{ "id": "bd-123", "title": "...", ... }] }`,
		)
		.action(async (opts: BeadsPullOptions, cmd: Command) => {
			await runBeadsPull(opts, cmd);
		});

	beads
		.command("push")
		.description("Create or update Notion pages from beads issue JSON")
		.requiredOption("--database-id <id>", "Notion database ID")
		.requiredOption("--view-url <url>", "Database view URL used to match existing issues")
		.option("--input <path|->", 'Issue JSON file path, or "-" to read stdin')
		.option("--data <json>", "Issue JSON string (overrides --input)")
		.addHelpText(
			"after",
			`
Examples:
  ncli beads push --database-id <db-id> --view-url "view://<view-id>" --input issues.json
  echo '{"issues":[{"id":"bd-1","title":"Fix login"}]}' | ncli beads push --database-id <db-id> --view-url "view://<view-id>" --input -

Input JSON:
  { "issues": [{ "id": "bd-123", "title": "Title", "status": "open" }] }

Matching uses the "Beads ID" property. Existing rows are updated, missing rows are created.`,
		)
		.action(async (opts: BeadsPushOptions, cmd: Command) => {
			await runBeadsPush(opts, cmd);
		});
}
