import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { parseDbProps } from "../util/db-props.js";
import { parseJsonData } from "../util/errors.js";

interface DbCreateOptions {
	title?: string;
	parent?: string;
	description?: string;
	schema?: string;
	props?: string[];
	data?: string;
}

interface DbUpdateOptions {
	title?: string;
	description?: string;
	statements?: string;
	data?: string;
}

export function buildDbCreateCall(opts: DbCreateOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-create-database", args: parseJsonData(opts.data) };
	}
	const args: Record<string, unknown> = {};

	if (opts.schema) {
		args.schema = opts.schema;
	} else if (opts.props?.length) {
		const tableName = opts.title ?? "Untitled";
		args.schema = `CREATE TABLE "${tableName}" (${parseDbProps(opts.props)})`;
	}

	if (opts.title) args.title = opts.title;
	if (opts.parent) {
		args.parent = { page_id: opts.parent, type: "page_id" };
	}
	if (opts.description) args.description = opts.description;

	return { tool: "notion-create-database", args };
}

export function buildDbUpdateCall(
	id: string,
	opts: DbUpdateOptions,
): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-update-data-source", args: parseJsonData(opts.data) };
	}
	const args: Record<string, unknown> = { data_source_id: id };
	if (opts.title) args.title = opts.title;
	if (opts.description) args.description = opts.description;
	if (opts.statements) args.statements = opts.statements;
	return { tool: "notion-update-data-source", args };
}

export function buildDbQueryCall(viewUrl: string): {
	tool: string;
	args: Record<string, unknown>;
} {
	return { tool: "notion-query-database-view", args: { view_url: viewUrl } };
}

export function registerDbCommands(program: Command): void {
	const db = program.command("db").description("Create, update, or query databases");

	db.command("create")
		.description("Create a database with SQL DDL schema (--prop, --schema)")
		.option("--title <title>", "Database title")
		.option("--parent <id>", "Parent page ID")
		.option("--description <text>", "Database description")
		.option("--schema <ddl>", "SQL DDL schema (overrides --prop)")
		.option(
			"--prop <name:type=opts>",
			"Define column (repeatable)",
			(v: string, a: string[]) => [...a, v],
			[] as string[],
		)
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.addHelpText(
			"after",
			`
Examples:
  notion db create --title "Tasks" --parent <page-id> --prop "Name:title" --prop "Status:select=Open,Done"
  notion db create --schema 'CREATE TABLE "T" ("Name" TITLE)' --parent <page-id>

Column types: TITLE, RICH_TEXT, DATE, SELECT('a','b'), MULTI_SELECT, NUMBER, CHECKBOX, URL
Response contains data_source_id (collection://...) needed for page create and view create.`,
		)
		.action(async (opts: DbCreateOptions & { prop?: string[] }, cmd: Command) => {
			opts.props = opts.prop;
			const { tool, args } = buildDbCreateCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	db.command("update")
		.description("Update schema, title, or attributes via SQL DDL (--statements)")
		.argument("<id>", "Database or data source ID")
		.option("--title <title>", "New title")
		.option("--description <text>", "New description")
		.option("--statements <ddl>", "SQL DDL statements (ADD/DROP/RENAME/ALTER COLUMN)")
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.addHelpText(
			"after",
			`
Examples:
  notion db update <ds-id> --title "New Title"
  notion db update <ds-id> --statements 'ADD COLUMN "Priority" SELECT'

Get data_source_id: run "notion fetch <db-id>" and look for collection://... in the response.
Statements: ADD COLUMN, DROP COLUMN, RENAME COLUMN "Old" TO "New", ALTER COLUMN "Name" SET <type>`,
		)
		.action(async (id: string, opts: DbUpdateOptions, cmd: Command) => {
			const { tool, args } = buildDbUpdateCall(id, opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	db.command("query")
		.description("Query a database view (uses the view's existing filters/sorts)")
		.argument("<view-url>", "Database view URL (must include ?v=<view-id>)")
		.addHelpText(
			"after",
			`
Example:
  notion db query "https://www.notion.so/<db-id>?v=<view-id>"

Requires a view URL with ?v= parameter (not just a DB URL).
To get view URLs: run "notion fetch <db-id>".
If no views exist: create one with "notion view create".`,
		)
		.action(async (viewUrl: string, _opts: unknown, cmd: Command) => {
			const { tool, args } = buildDbQueryCall(viewUrl);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
