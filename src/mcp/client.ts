import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CallbackServer } from "../auth/callback-server.js";
import { NotionOAuthProvider } from "../auth/provider.js";
import { TokenStore } from "../auth/token-store.js";
import { CONFIG_DIR, MCP_SERVER_URL } from "../util/config.js";
import { CliError } from "../util/errors.js";

export class MCPConnection {
	private client: Client | null = null;
	private callbackServer: CallbackServer | null = null;

	async connect(): Promise<void> {
		const tokenStore = new TokenStore(CONFIG_DIR);
		const callbackServer = new CallbackServer();
		this.callbackServer = callbackServer;

		// Start the callback server first to get the port
		const callbackPromise = callbackServer.waitForCallback();

		const provider = new NotionOAuthProvider(tokenStore, callbackServer);
		const serverUrl = new URL(MCP_SERVER_URL);

		const client = new Client({ name: "ncli", version: "0.2.0" }, { capabilities: {} });
		this.client = client;

		let transport = new StreamableHTTPClientTransport(serverUrl, {
			authProvider: provider,
		});

		try {
			await client.connect(transport);
		} catch (error) {
			if (error instanceof UnauthorizedError) {
				console.error("Opening browser for Notion login...");

				const code = await callbackPromise;
				await transport.finishAuth(code);

				// Reconnect with new tokens
				transport = new StreamableHTTPClientTransport(serverUrl, {
					authProvider: provider,
				});
				await client.connect(transport);
			} else {
				callbackServer.stop();
				throw error;
			}
		}
	}

	async callTool(
		name: string,
		args: Record<string, unknown> = {},
	): Promise<Awaited<ReturnType<Client["callTool"]>>> {
		if (!this.client) {
			throw new CliError(
				"Not connected to Notion",
				"connect() has not been called",
				"Run any command — connection is automatic",
			);
		}
		const result = await this.client.callTool({ name, arguments: args });
		if (result.isError) {
			throw mcpErrorToCliError(name, result);
		}
		return result;
	}

	async listTools(): Promise<Tool[]> {
		if (!this.client) {
			throw new CliError(
				"Not connected to Notion",
				"connect() has not been called",
				"Run any command — connection is automatic",
			);
		}
		const result = await this.client.listTools();
		return result.tools;
	}

	async disconnect(): Promise<void> {
		if (this.client) {
			await this.client.close();
			this.client = null;
		}
		if (this.callbackServer) {
			this.callbackServer.stop();
			this.callbackServer = null;
		}
	}
}

function extractMcpErrorMessage(result: Record<string, unknown>): string {
	const content = result.content;
	if (!Array.isArray(content)) return "Unknown MCP error";
	const text = (content as Array<{ type: string; text?: string }>)
		.filter((c) => c.type === "text" && c.text)
		.map((c) => c.text)
		.join("\n");
	try {
		const parsed = JSON.parse(text);
		if (parsed.body) {
			try {
				const body = JSON.parse(parsed.body);
				return body.message || parsed.message || text;
			} catch {
				return parsed.message || text;
			}
		}
		return parsed.message || text;
	} catch {
		return text || "Unknown MCP error";
	}
}

interface HintRule {
	pattern: RegExp;
	tool?: string;
	hint: string;
}

const HINT_RULES: HintRule[] = [
	// Tool-specific hints (checked first)
	{
		pattern: /could not find page with id/i,
		tool: "notion-create-pages",
		hint: 'If adding to a database, use --parent collection://<ds-id>. For --data, use "parent":{"data_source_id":"<uuid>","type":"data_source_id"}. Run "ncli fetch <db-id>" to get the data_source_id',
	},
	{
		pattern: /invalid database view url/i,
		hint: 'Use a view URL with ?v= parameter. Run "ncli fetch <db-id>" to find view URLs, or create one with "ncli view create"',
	},
	{
		pattern: /data_source_id[\s\S]*?required/i,
		hint: "data_source_id is required. Use --parent collection://<ds-id> or, with --data, pass the bare UUID from the fetched collection://... value",
	},
	{
		pattern: /rich_text[\s\S]*?required/i,
		hint: 'Use --body "your comment text" to set the comment content',
	},
	{
		pattern: /tool .* not found/i,
		hint: 'Run "ncli --help" to see available commands, or check the tool name for typos',
	},
	// Generic hints
	{
		pattern: /unauthorized|not authorized/i,
		hint: 'Run "ncli login" to re-authenticate',
	},
	{
		pattern: /could not find|does not exist/i,
		hint: 'Check the ID or URL. Run "ncli search" to find the correct resource',
	},
	{
		pattern: /rate limit|429/i,
		hint: "Wait a moment and retry. The CLI retries automatically up to 3 times",
	},
	{
		pattern: /input validation error/i,
		hint: 'Check required arguments. Use --data for full control, or run "ncli <command> --help" for usage',
	},
];

function mcpErrorToCliError(toolName: string, result: Record<string, unknown>): CliError {
	const message = extractMcpErrorMessage(result);
	const rule = HINT_RULES.find((r) => r.pattern.test(message) && (!r.tool || r.tool === toolName));
	return new CliError(`${toolName} failed`, message, rule?.hint);
}
