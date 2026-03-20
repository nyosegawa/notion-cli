import type { Command } from "commander";
import { TokenStore } from "../auth/token-store.js";
import { printRestOutput } from "../output/json.js";
import type { HttpMethod } from "../rest/client.js";
import { withRestClient } from "../rest/with-rest-client.js";
import { CONFIG_DIR } from "../util/config.js";
import { CliError, parseJsonData } from "../util/errors.js";
import { readStdin } from "../util/stdin.js";

const VALID_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);

export function buildRestCall(
	method: string,
	apiPath: string,
	jsonStr?: string,
): { method: HttpMethod; path: string; body?: Record<string, unknown> } {
	const upperMethod = method.toUpperCase();
	if (!VALID_METHODS.has(upperMethod)) {
		throw new CliError(
			`Invalid HTTP method: ${method}`,
			"Supported methods are GET, POST, PATCH, DELETE",
			"Example: ncli rest GET /pages/<id>",
		);
	}

	const normalizedPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;

	if (!jsonStr || jsonStr.trim() === "") {
		return { method: upperMethod as HttpMethod, path: normalizedPath };
	}

	const body = parseJsonData(jsonStr);
	return { method: upperMethod as HttpMethod, path: normalizedPath, body };
}

export function registerRestCommands(program: Command): void {
	const rest = program
		.command("rest")
		.description("Call Notion REST API directly — requires integration token")
		.addHelpText(
			"after",
			`
Setup:
  ncli rest login                              # Save integration token (one-time)

Usage:
  ncli rest GET /users/me                      # Verify auth
  ncli rest GET /pages/<page-id>               # Get a page
  ncli rest POST /search '{"query":"test"}'    # Search
  ncli file upload <page-id> ./image.png       # Upload a file

The integration must have access to target pages.
  Go to https://www.notion.so/profile/integrations/internal
  → select your integration → Content access → add pages.`,
		);

	rest
		.command("login")
		.description("Save a Notion integration token for REST API access")
		.addHelpText(
			"after",
			`
Examples:
  ncli rest login                              # Enter token interactively
  echo "ntn_..." | ncli rest login             # Pipe token from stdin

Get your integration token at:
  https://www.notion.so/profile/integrations`,
		)
		.action(async () => {
			let token: string;
			if (!process.stdin.isTTY) {
				token = (await readStdin()).trim();
			} else {
				console.log(`Get your integration token at: https://www.notion.so/profile/integrations
Create a new integration or copy the token from an existing one.
`);
				process.stdout.write("Enter your Notion integration token: ");
				token = await new Promise<string>((resolve) => {
					const chunks: Buffer[] = [];
					process.stdin.setRawMode(true);
					process.stdin.resume();
					process.stdin.setEncoding("utf-8");
					const onData = (data: string) => {
						for (const ch of data) {
							if (ch === "\r" || ch === "\n") {
								process.stdin.setRawMode(false);
								process.stdin.pause();
								process.stdin.removeListener("data", onData);
								process.stdout.write("\n");
								resolve(Buffer.concat(chunks).toString("utf-8").trim());
								return;
							}
							if (ch === "\u0003") {
								process.stdin.setRawMode(false);
								process.exit(1);
							}
							if (ch === "\u007f" || ch === "\b") {
								if (chunks.length > 0) {
									chunks.pop();
									process.stdout.write("\b \b");
								}
							} else {
								chunks.push(Buffer.from(ch));
								process.stdout.write("*");
							}
						}
					};
					process.stdin.on("data", onData);
				});
			}

			if (!token) {
				throw new CliError(
					"No token provided",
					"An integration token is required",
					"Get your token at https://www.notion.so/profile/integrations",
				);
			}

			const store = new TokenStore(CONFIG_DIR);
			store.saveRestToken(token);
			console.log(`Token saved.

Next steps:
  1. Open the Notion page you want to access
  2. Click "..." (top right) → "Connections" → Add your integration
  3. Verify: ncli rest GET /users/me`);
		});

	rest
		.command("logout")
		.description("Remove saved REST API integration token")
		.action(() => {
			const store = new TokenStore(CONFIG_DIR);
			store.deleteRestToken();
			console.log("REST API token removed.");
		});

	rest
		.command("call", { isDefault: true })
		.description("Make a REST API request")
		.argument("<method>", "HTTP method (GET, POST, PATCH, DELETE)")
		.argument("<path>", "API path (e.g. /pages/<id>, /databases/<id>)")
		.argument("[json]", "JSON request body")
		.addHelpText(
			"after",
			`
Examples:
  ncli rest GET /users/me
  ncli rest GET /pages/<page-id>
  ncli rest POST /pages '{"parent":{"page_id":"..."},"properties":{"title":[{"text":{"content":"New Page"}}]}}'
  ncli rest PATCH /blocks/<block-id>/children '{"children":[...]}'
  ncli rest DELETE /blocks/<block-id>
  echo '{"query":"test"}' | ncli rest POST /search

REST API docs: https://developers.notion.com/reference`,
		)
		.action(
			async (
				method: string,
				apiPath: string,
				json: string | undefined,
				_opts: unknown,
				cmd: Command,
			) => {
				let jsonStr = json;
				if (!jsonStr && !process.stdin.isTTY) {
					jsonStr = (await readStdin()).trim();
				}
				const call = buildRestCall(method, apiPath, jsonStr);
				await withRestClient(async (client) => {
					const result = await client.request(call.method, call.path, call.body);
					printRestOutput(result, cmd.optsWithGlobals());
				});
			},
		);
}
