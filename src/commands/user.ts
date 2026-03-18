import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { parseJsonData } from "../util/errors.js";

interface UserListOptions {
	query?: string;
	userId?: string;
	data?: string;
}

interface TeamListOptions {
	query?: string;
	data?: string;
}

export function buildUserListCall(opts: UserListOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-get-users", args: parseJsonData(opts.data) };
	}
	const args: Record<string, unknown> = {};
	if (opts.query) args.query = opts.query;
	if (opts.userId) args.user_id = opts.userId;
	return { tool: "notion-get-users", args };
}

export function buildTeamListCall(opts: TeamListOptions): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-get-teams", args: parseJsonData(opts.data) };
	}
	const args: Record<string, unknown> = {};
	if (opts.query) args.query = opts.query;
	return { tool: "notion-get-teams", args };
}

export function registerUserCommands(program: Command): void {
	const user = program.command("user").description("List and search workspace users");

	user
		.command("list")
		.description("List workspace users")
		.option("--query <q>", "Filter by name or email")
		.option("--user-id <id>", 'User ID (use "self" for current user)')
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.action(async (opts: UserListOptions, cmd: Command) => {
			const { tool, args } = buildUserListCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}

export function registerTeamCommands(program: Command): void {
	const team = program.command("team").description("List and search workspace teams");

	team
		.command("list")
		.description("List workspace teams")
		.option("--query <q>", "Filter by team name")
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.action(async (opts: TeamListOptions, cmd: Command) => {
			const { tool, args } = buildTeamListCall(opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
