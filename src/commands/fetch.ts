import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";

export function buildFetchCall(urlOrId: string): {
	tool: string;
	args: Record<string, unknown>;
} {
	return { tool: "notion-fetch", args: { id: urlOrId } };
}

export function registerFetchCommands(program: Command): void {
	program
		.command("fetch")
		.description("Retrieve a page, database, or data source by URL or ID")
		.argument("<url-or-id>", "Notion URL or page/database ID")
		.action(async (urlOrId: string, _opts: unknown, cmd: Command) => {
			const { tool, args } = buildFetchCall(urlOrId);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
