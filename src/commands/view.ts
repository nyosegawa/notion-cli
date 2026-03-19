import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { parseJsonData } from "../util/errors.js";

interface ViewOptions {
	data?: string;
}

export function buildViewCreateCall(opts: ViewOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-create-view", args: parseJsonData(opts.data) };
	}
	return { tool: "notion-create-view", args: {} };
}

export function buildViewUpdateCall(opts: ViewOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-update-view", args: parseJsonData(opts.data) };
	}
	return { tool: "notion-update-view", args: {} };
}

export function registerViewCommands(program: Command): void {
	const view = program
		.command("view")
		.description("Create or update database views (table, board, calendar, etc.)");

	view
		.command("create")
		.description("Create a database view (use --data for full JSON)")
		.option("--data <json>", "Raw JSON arguments")
		.addHelpText(
			"after",
			`
Example:
  ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'

Requires database_id and data_source_id. Get both by running "ncli fetch <db-id>".
Types: table, board, list, calendar, timeline, gallery, form, chart, map, dashboard.
The response contains a view URL (view://...) for use with "ncli db query".`,
		)
		.action(async (opts: ViewOptions, cmd: Command) => {
			const { tool, args } = buildViewCreateCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	view
		.command("update")
		.description("Update a database view (use --data for full JSON)")
		.option("--data <json>", "Raw JSON arguments")
		.action(async (opts: ViewOptions, cmd: Command) => {
			const { tool, args } = buildViewUpdateCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
