import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { CliError, parseJsonData } from "../util/errors.js";
import { parseProps } from "../util/props.js";
import { readStdin } from "../util/stdin.js";

interface PageWriteOptions {
	title?: string;
	parent?: string;
	props?: string[];
	body?: string;
	data?: string;
}

function stripDataSourcePrefix(id: string): string {
	return id.replace(/^collection:\/\//, "");
}

export function parseParentRef(id: string): Record<string, string> {
	if (id.startsWith("collection://")) {
		return { data_source_id: stripDataSourcePrefix(id), type: "data_source_id" };
	}
	if (id === "workspace") {
		return { type: "workspace" };
	}
	return { page_id: id, type: "page_id" };
}

export function buildPageCreateCall(opts: PageWriteOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-create-pages", args: parseJsonData(opts.data) };
	}
	const page: Record<string, unknown> = {};
	const properties: Record<string, unknown> = {};
	if (opts.title) properties.title = opts.title;
	if (opts.props?.length) Object.assign(properties, parseProps(opts.props));
	if (Object.keys(properties).length > 0) page.properties = properties;
	if (opts.body) page.content = opts.body;

	const args: Record<string, unknown> = { pages: [page] };
	if (opts.parent) {
		if (opts.parent === "workspace") {
			throw new CliError(
				'"workspace" is not a valid parent for page create',
				"notion-create-pages only accepts page_id or data_source_id as parent",
				"Use a page ID or collection://<ds-id> as --parent",
			);
		}
		args.parent = parseParentRef(opts.parent);
	}
	return { tool: "notion-create-pages", args };
}

export function buildPageUpdateCall(
	id: string,
	opts: Omit<PageWriteOptions, "parent">,
): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-update-page", args: parseJsonData(opts.data) };
	}

	const hasProps = !!(opts.title || opts.props?.length);
	const hasBody = !!opts.body;
	if (hasProps && hasBody) {
		throw new CliError(
			"Cannot use --body with --prop/--title in the same command",
			"Property update and content replacement are separate MCP operations",
			'Run two commands: "notion page update <id> --prop ..." then "notion page update <id> --body ..."',
		);
	}

	const args: Record<string, unknown> = { page_id: id };
	if (opts.title) {
		args.command = "update_properties";
		args.properties = {
			title: opts.title,
			...((opts.props?.length && parseProps(opts.props)) || {}),
		};
	} else if (opts.props?.length) {
		args.command = "update_properties";
		args.properties = parseProps(opts.props);
	}
	if (hasBody) {
		args.command = "replace_content";
		args.new_str = opts.body;
	}
	return { tool: "notion-update-page", args };
}

export function buildPageMoveCall(
	ids: string[],
	to: string,
): {
	tool: string;
	args: Record<string, unknown>;
} {
	return {
		tool: "notion-move-pages",
		args: {
			page_or_database_ids: ids,
			new_parent: parseParentRef(to),
		},
	};
}

export function buildPageDuplicateCall(id: string): {
	tool: string;
	args: Record<string, unknown>;
} {
	return { tool: "notion-duplicate-page", args: { page_id: id } };
}

async function resolveBody(body: string | undefined): Promise<string | undefined> {
	if (body === "-") {
		return readStdin();
	}
	return body;
}

export function registerPageCommands(program: Command): void {
	const page = program.command("page").description("Create, update, move, or duplicate pages");

	page
		.command("create")
		.description("Create a page (--title, --parent, --prop Key=Value, --body)")
		.option("--title <title>", "Page title")
		.option("--parent <id>", "Parent page or database ID")
		.option(
			"--prop <key=value>",
			"Set property (repeatable)",
			(v: string, a: string[]) => [...a, v],
			[] as string[],
		)
		.option("--body <text>", 'Page content (use "-" for stdin)')
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.addHelpText(
			"after",
			`
Examples:
  notion page create --title "Meeting Notes" --parent <page-id>
  notion page create --parent collection://<ds-id> --title "Task" --prop "Status=Open"
  echo "# Content" | notion page create --title "Doc" --body -

Parent types (auto-detected from prefix):
  <page-id>           → page parent
  collection://<id>   → data source parent (for DB pages)

For DB pages: run "notion fetch <db-id>" first to get the data_source_id (collection://...) and schema.`,
		)
		.action(async (opts: PageWriteOptions & { prop?: string[] }, cmd: Command) => {
			opts.props = opts.prop;
			opts.body = await resolveBody(opts.body);
			const { tool, args } = buildPageCreateCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	page
		.command("update")
		.description("Update properties (--prop) or content (--body) of a page")
		.argument("<id>", "Page ID")
		.option("--title <title>", "New page title")
		.option(
			"--prop <key=value>",
			"Set property (repeatable)",
			(v: string, a: string[]) => [...a, v],
			[] as string[],
		)
		.option("--body <text>", 'Page content (use "-" for stdin)')
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.action(
			async (
				id: string,
				opts: Omit<PageWriteOptions, "parent"> & { prop?: string[] },
				cmd: Command,
			) => {
				opts.props = opts.prop;
				opts.body = await resolveBody(opts.body);
				const { tool, args } = buildPageUpdateCall(id, opts);
				await withConnection(async (conn) => {
					const result = await conn.callTool(tool, args);
					printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
				});
			},
		);

	page
		.command("move")
		.description("Move pages or databases to a new parent (--to)")
		.argument("<id...>", "Page IDs to move")
		.requiredOption("--to <parent-id>", "Target parent ID")
		.action(async (ids: string[], opts: { to: string }, cmd: Command) => {
			const { tool, args } = buildPageMoveCall(ids, opts.to);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	page
		.command("duplicate")
		.description("Duplicate a page (async)")
		.argument("<id>", "Page ID to duplicate")
		.action(async (id: string, _opts: unknown, cmd: Command) => {
			const { tool, args } = buildPageDuplicateCall(id);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
