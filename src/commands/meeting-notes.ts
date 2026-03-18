import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { parseJsonData } from "../util/errors.js";

interface MeetingNotesQueryOptions {
	data?: string;
}

export function buildMeetingNotesQueryCall(opts: MeetingNotesQueryOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-query-meeting-notes", args: parseJsonData(opts.data) };
	}
	return { tool: "notion-query-meeting-notes", args: {} };
}

export function registerMeetingNotesCommands(program: Command): void {
	const mn = program
		.command("meeting-notes")
		.description("Query meeting notes with filters (date, attendees, title)");

	mn.command("query")
		.description("Query meeting notes (use --data for filter JSON)")
		.option("--data <json>", "Raw JSON arguments (filter object)")
		.action(async (opts: MeetingNotesQueryOptions, cmd: Command) => {
			const { tool, args } = buildMeetingNotesQueryCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
