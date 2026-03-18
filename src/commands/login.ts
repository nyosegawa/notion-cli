import type { Command } from "commander";
import { TokenStore } from "../auth/token-store.js";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { CONFIG_DIR } from "../util/config.js";

export function registerLoginCommands(program: Command): void {
	program
		.command("login")
		.description("Log in to Notion via OAuth")
		.action(async (_opts: unknown, cmd: Command) => {
			await withConnection(async (conn) => {
				const result = await conn.callTool("notion-get-users", { user_id: "self" });
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	program
		.command("logout")
		.description("Log out from Notion")
		.action((_opts: unknown, cmd: Command) => {
			const store = new TokenStore(CONFIG_DIR);
			store.deleteAll();
			const opts = cmd.optsWithGlobals();
			if (opts.json) {
				console.log(JSON.stringify({ status: "logged_out" }, null, 2));
			} else {
				console.log("Logged out. All tokens cleared.");
			}
		});

	program
		.command("whoami")
		.description("Show current Notion user info")
		.action(async (_opts: unknown, cmd: Command) => {
			await withConnection(async (conn) => {
				const result = await conn.callTool("notion-get-users", { user_id: "self" });
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
