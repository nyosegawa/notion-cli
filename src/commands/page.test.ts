import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
	buildPageCreateCall,
	buildPageDuplicateCall,
	buildPageMoveCall,
	buildPageUpdateCall,
	parseParentRef,
	registerPageCommands,
} from "./page.js";

describe("parseParentRef", () => {
	it("detects collection:// as data_source_id and strips the prefix", () => {
		expect(parseParentRef("collection://abc-123")).toEqual({
			data_source_id: "abc-123",
			type: "data_source_id",
		});
	});

	it("detects workspace literal", () => {
		expect(parseParentRef("workspace")).toEqual({ type: "workspace" });
	});

	it("defaults to page_id for regular IDs", () => {
		expect(parseParentRef("abc-123")).toEqual({ page_id: "abc-123", type: "page_id" });
	});
});

describe("buildPageCreateCall", () => {
	it("maps --title to pages[0].properties.title", () => {
		const result = buildPageCreateCall({ title: "My Page" });
		expect(result.tool).toBe("notion-create-pages");
		const pages = result.args.pages as Record<string, unknown>[];
		expect(pages[0].properties).toEqual({ title: "My Page" });
	});

	it("maps --parent to parent object", () => {
		const result = buildPageCreateCall({ parent: "parent-id" });
		expect(result.args.parent).toEqual({ page_id: "parent-id", type: "page_id" });
	});

	it("maps --parent collection:// to data_source_id parent", () => {
		const result = buildPageCreateCall({ parent: "collection://ds-id" });
		expect(result.args.parent).toEqual({
			data_source_id: "ds-id",
			type: "data_source_id",
		});
	});

	it("rejects --parent workspace for page create", () => {
		expect(() => buildPageCreateCall({ parent: "workspace" })).toThrow(
			'"workspace" is not a valid parent for page create',
		);
	});

	it("maps --prop via parseProps into properties", () => {
		const result = buildPageCreateCall({ props: ["Status=Open", "Priority=High"] });
		const pages = result.args.pages as Record<string, unknown>[];
		expect(pages[0].properties).toEqual({ Status: "Open", Priority: "High" });
	});

	it("maps --body to pages[0].content", () => {
		const result = buildPageCreateCall({ body: "# Hello" });
		const pages = result.args.pages as Record<string, unknown>[];
		expect(pages[0].content).toBe("# Hello");
	});

	it("--data overrides all other args", () => {
		const result = buildPageCreateCall({
			title: "Ignored",
			data: '{"custom":"value"}',
		});
		expect(result.tool).toBe("notion-create-pages");
		expect(result.args).toEqual({ custom: "value" });
	});

	it("minimal call with no options produces empty page", () => {
		const result = buildPageCreateCall({});
		expect(result.tool).toBe("notion-create-pages");
		expect(result.args).toEqual({ pages: [{}] });
	});

	it("combines title, parent, props, and body", () => {
		const result = buildPageCreateCall({
			title: "Bug Report",
			parent: "db-id",
			props: ["Status=Open"],
			body: "Description here",
		});
		expect(result.args).toEqual({
			pages: [
				{
					properties: { title: "Bug Report", Status: "Open" },
					content: "Description here",
				},
			],
			parent: { page_id: "db-id", type: "page_id" },
		});
	});
});

describe("buildPageUpdateCall", () => {
	it("includes page_id in args", () => {
		const result = buildPageUpdateCall("page-id", {});
		expect(result.tool).toBe("notion-update-page");
		expect(result.args.page_id).toBe("page-id");
	});

	it("maps --title to update_properties command", () => {
		const result = buildPageUpdateCall("page-id", { title: "Updated" });
		expect(result.args.command).toBe("update_properties");
		expect(result.args.properties).toEqual({ title: "Updated" });
	});

	it("maps --prop to update_properties command", () => {
		const result = buildPageUpdateCall("page-id", { props: ["Status=Done"] });
		expect(result.args.command).toBe("update_properties");
		expect(result.args.properties).toEqual({ Status: "Done" });
	});

	it("maps --body to replace_content command", () => {
		const result = buildPageUpdateCall("page-id", { body: "New content" });
		expect(result.args.command).toBe("replace_content");
		expect(result.args.new_str).toBe("New content");
	});

	it("throws CliError when --body and --title are both provided", () => {
		expect(() => buildPageUpdateCall("page-id", { title: "T", body: "B" })).toThrow(
			"Cannot use --body with --prop/--title",
		);
	});

	it("throws CliError when --body and --prop are both provided", () => {
		expect(() => buildPageUpdateCall("page-id", { props: ["S=D"], body: "B" })).toThrow(
			"Cannot use --body with --prop/--title",
		);
	});

	it("--data overrides all other args", () => {
		const result = buildPageUpdateCall("page-id", {
			title: "Ignored",
			data: '{"custom":"override"}',
		});
		expect(result.args).toEqual({ custom: "override" });
	});
});

describe("buildPageMoveCall", () => {
	it("maps single id and --to", () => {
		const result = buildPageMoveCall(["page-id"], "target-id");
		expect(result.tool).toBe("notion-move-pages");
		expect(result.args.page_or_database_ids).toEqual(["page-id"]);
		expect(result.args.new_parent).toEqual({ page_id: "target-id", type: "page_id" });
	});

	it("maps multiple ids", () => {
		const result = buildPageMoveCall(["id1", "id2", "id3"], "target-id");
		expect(result.args.page_or_database_ids).toEqual(["id1", "id2", "id3"]);
	});
});

describe("buildPageDuplicateCall", () => {
	it("maps id to notion-duplicate-page", () => {
		const result = buildPageDuplicateCall("page-id");
		expect(result).toEqual({
			tool: "notion-duplicate-page",
			args: { page_id: "page-id" },
		});
	});
});

describe("registerPageCommands", () => {
	it("registers page command group with subcommands", () => {
		const program = new Command();
		registerPageCommands(program);
		const page = program.commands.find((c) => c.name() === "page");
		expect(page).toBeDefined();

		const subcommandNames = page?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("create");
		expect(subcommandNames).toContain("update");
		expect(subcommandNames).toContain("move");
		expect(subcommandNames).toContain("duplicate");
	});
});
