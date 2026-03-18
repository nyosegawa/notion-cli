import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
	buildDbCreateCall,
	buildDbQueryCall,
	buildDbUpdateCall,
	registerDbCommands,
} from "./db.js";

describe("buildDbCreateCall", () => {
	it("maps --schema to schema arg", () => {
		const result = buildDbCreateCall({ schema: 'CREATE TABLE "T" ("Name" TITLE)' });
		expect(result.tool).toBe("notion-create-database");
		expect(result.args.schema).toBe('CREATE TABLE "T" ("Name" TITLE)');
	});

	it("maps --title to title arg", () => {
		const result = buildDbCreateCall({ title: "Tasks", schema: '"Name" TITLE' });
		expect(result.args.title).toBe("Tasks");
	});

	it("maps --parent to parent object", () => {
		const result = buildDbCreateCall({ parent: "page-id", schema: '"Name" TITLE' });
		expect(result.args.parent).toEqual({ page_id: "page-id", type: "page_id" });
	});

	it("maps --description to description arg", () => {
		const result = buildDbCreateCall({ description: "My DB", schema: '"Name" TITLE' });
		expect(result.args.description).toBe("My DB");
	});

	it("maps --prop to schema via parseDbProps", () => {
		const result = buildDbCreateCall({
			title: "Tasks",
			props: ["Name:title", "Status:select=Open,Done"],
		});
		expect(result.args.schema).toBe(
			'CREATE TABLE "Tasks" ("Name" TITLE, "Status" SELECT(\'Open\',\'Done\'))',
		);
	});

	it("--schema takes precedence over --prop", () => {
		const result = buildDbCreateCall({
			schema: 'CREATE TABLE "T" ("X" TEXT)',
			props: ["Name:title"],
		});
		expect(result.args.schema).toBe('CREATE TABLE "T" ("X" TEXT)');
	});

	it("--data overrides all other args", () => {
		const result = buildDbCreateCall({
			title: "Ignored",
			data: '{"custom":"value"}',
		});
		expect(result.tool).toBe("notion-create-database");
		expect(result.args).toEqual({ custom: "value" });
	});

	it("uses default table name when --prop without --title", () => {
		const result = buildDbCreateCall({ props: ["Name:title"] });
		expect(result.args.schema).toBe('CREATE TABLE "Untitled" ("Name" TITLE)');
	});
});

describe("buildDbUpdateCall", () => {
	it("maps id to data_source_id", () => {
		const result = buildDbUpdateCall("db-id", {});
		expect(result.tool).toBe("notion-update-data-source");
		expect(result.args.data_source_id).toBe("db-id");
	});

	it("maps --title to title arg", () => {
		const result = buildDbUpdateCall("db-id", { title: "New Title" });
		expect(result.args.title).toBe("New Title");
	});

	it("maps --statements to statements arg", () => {
		const result = buildDbUpdateCall("db-id", { statements: 'ADD COLUMN "X" TEXT' });
		expect(result.args.statements).toBe('ADD COLUMN "X" TEXT');
	});

	it("maps --description to description arg", () => {
		const result = buildDbUpdateCall("db-id", { description: "Updated desc" });
		expect(result.args.description).toBe("Updated desc");
	});

	it("--data overrides all other args", () => {
		const result = buildDbUpdateCall("db-id", {
			title: "Ignored",
			data: '{"custom":"override"}',
		});
		expect(result.args).toEqual({ custom: "override" });
	});
});

describe("buildDbQueryCall", () => {
	it("maps view-url to view_url arg", () => {
		const result = buildDbQueryCall("https://notion.so/ws/db?v=view-id");
		expect(result.tool).toBe("notion-query-database-view");
		expect(result.args.view_url).toBe("https://notion.so/ws/db?v=view-id");
	});
});

describe("registerDbCommands", () => {
	it("registers db command group with subcommands", () => {
		const program = new Command();
		registerDbCommands(program);
		const db = program.commands.find((c) => c.name() === "db");
		expect(db).toBeDefined();

		const subcommandNames = db?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("create");
		expect(subcommandNames).toContain("update");
		expect(subcommandNames).toContain("query");
	});
});
