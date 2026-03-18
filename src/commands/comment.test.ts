import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
	buildCommentCreateCall,
	buildCommentListCall,
	registerCommentCommands,
} from "./comment.js";

describe("buildCommentCreateCall", () => {
	it("maps page-id and --body to rich_text", () => {
		const result = buildCommentCreateCall("page-id", { body: "LGTM" });
		expect(result.tool).toBe("notion-create-comment");
		expect(result.args.page_id).toBe("page-id");
		expect(result.args.rich_text).toEqual([{ type: "text", text: { content: "LGTM" } }]);
	});

	it("maps --discussion to discussion_id", () => {
		const result = buildCommentCreateCall("page-id", {
			body: "Reply",
			discussion: "disc-id",
		});
		expect(result.args.discussion_id).toBe("disc-id");
	});

	it("--data overrides all other args", () => {
		const result = buildCommentCreateCall("page-id", {
			body: "Ignored",
			data: '{"custom":"value"}',
		});
		expect(result.tool).toBe("notion-create-comment");
		expect(result.args).toEqual({ custom: "value" });
	});

	it("creates call without --body (minimal)", () => {
		const result = buildCommentCreateCall("page-id", {});
		expect(result.args.page_id).toBe("page-id");
		expect(result.args.rich_text).toBeUndefined();
	});
});

describe("buildCommentListCall", () => {
	it("maps page-id to page_id", () => {
		const result = buildCommentListCall("page-id", {});
		expect(result.tool).toBe("notion-get-comments");
		expect(result.args.page_id).toBe("page-id");
	});

	it("maps --include-resolved flag", () => {
		const result = buildCommentListCall("page-id", { includeResolved: true });
		expect(result.args.include_resolved).toBe(true);
	});

	it("--data overrides all other args", () => {
		const result = buildCommentListCall("page-id", {
			data: '{"custom":"override"}',
		});
		expect(result.args).toEqual({ custom: "override" });
	});
});

describe("registerCommentCommands", () => {
	it("registers comment command group with subcommands", () => {
		const program = new Command();
		registerCommentCommands(program);
		const comment = program.commands.find((c) => c.name() === "comment");
		expect(comment).toBeDefined();

		const subcommandNames = comment?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("create");
		expect(subcommandNames).toContain("list");
	});
});
