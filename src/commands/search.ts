import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";

export function buildSearchCall(query: string): {
	tool: string;
	args: Record<string, unknown>;
} {
	return { tool: "notion-search", args: { query } };
}

export function registerSearchCommands(program: Command): void {
	program
		.command("search")
		.description("Search pages, databases, and users across workspace")
		.argument("<query>", "Search query")
		.action(async (query: string, _opts: unknown, cmd: Command) => {
			const { tool, args } = buildSearchCall(query);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
