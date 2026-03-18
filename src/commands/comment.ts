import type { Command } from "commander";
import { withConnection } from "../mcp/with-connection.js";
import { printOutput } from "../output/json.js";
import { parseJsonData } from "../util/errors.js";
import { readStdin } from "../util/stdin.js";

interface CommentCreateOptions {
	body?: string;
	discussion?: string;
	data?: string;
}

interface CommentListOptions {
	includeResolved?: boolean;
	data?: string;
}

export function buildCommentCreateCall(
	pageId: string,
	opts: CommentCreateOptions,
): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-create-comment", args: parseJsonData(opts.data) };
	}
	const args: Record<string, unknown> = { page_id: pageId };
	if (opts.body) {
		args.rich_text = [{ type: "text", text: { content: opts.body } }];
	}
	if (opts.discussion) {
		args.discussion_id = opts.discussion;
	}
	return { tool: "notion-create-comment", args };
}

export function buildCommentListCall(
	pageId: string,
	opts: CommentListOptions,
): {
	tool: string;
	args: Record<string, unknown>;
} {
	if (opts.data) {
		return { tool: "notion-get-comments", args: parseJsonData(opts.data) };
	}
	const args: Record<string, unknown> = { page_id: pageId };
	if (opts.includeResolved) {
		args.include_resolved = true;
	}
	return { tool: "notion-get-comments", args };
}

export function registerCommentCommands(program: Command): void {
	const comment = program.command("comment").description("Add or list comments on pages");

	comment
		.command("create")
		.description("Add a comment to a page")
		.argument("<page-id>", "Page ID")
		.option("--body <text>", 'Comment text (use "-" for stdin)')
		.option("--discussion <id>", "Reply to discussion ID")
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.action(async (pageId: string, opts: CommentCreateOptions, cmd: Command) => {
			if (opts.body === "-") {
				opts.body = await readStdin();
			}
			const { tool, args } = buildCommentCreateCall(pageId, opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});

	comment
		.command("list")
		.description("List comments on a page")
		.argument("<page-id>", "Page ID")
		.option("--include-resolved", "Include resolved threads")
		.option("--data <json>", "Raw JSON arguments (overrides other flags)")
		.action(async (pageId: string, opts: CommentListOptions, cmd: Command) => {
			const { tool, args } = buildCommentListCall(pageId, opts);
			await withConnection(async (conn) => {
				const result = await conn.callTool(tool, args);
				printOutput(result as Record<string, unknown>, cmd.optsWithGlobals());
			});
		});
}
