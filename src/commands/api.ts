import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { CliError } from "../util/errors.js";
import { readStdin } from "../util/stdin.js";

export function buildApiCall(
	toolName: string,
	jsonStr?: string,
): { tool: string; args: Record<string, unknown> } {
	if (!jsonStr || jsonStr.trim() === "") {
		return { tool: toolName, args: {} };
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonStr);
	} catch {
		throw new CliError(
			"Invalid JSON argument",
			"The provided JSON string could not be parsed",
			`Check syntax: notion api ${toolName} '{"key": "value"}'`,
		);
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new CliError(
			"Invalid argument type",
			"Arguments must be a JSON object",
			`Use an object: notion api ${toolName} '{"key": "value"}'`,
		);
	}

	return { tool: toolName, args: parsed as Record<string, unknown> };
}

export function registerApiCommand(program: Command): void {
	program
		.command("api")
		.description("Call any MCP tool directly — escape hatch for advanced use")
		.argument("<tool-name>", "MCP tool name (e.g. notion-search)")
		.argument("[json]", "JSON arguments")
		.action(async (toolName: string, json: string | undefined, _opts: unknown, cmd: Command) => {
			let jsonStr = json;
			if (!jsonStr && !process.stdin.isTTY) {
				jsonStr = (await readStdin()).trim();
			}
			const { tool, args } = buildApiCall(toolName, jsonStr);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
