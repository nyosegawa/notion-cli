import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildViewCreateCall, buildViewUpdateCall, registerViewCommands } from "./view.js";

describe("buildViewCreateCall", () => {
	it("passes --data as args", () => {
		const data = '{"database_id":"db-id","type":"board","name":"Kanban"}';
		const result = buildViewCreateCall({ data });
		expect(result.tool).toBe("notion-create-view");
		expect(result.args).toEqual({ database_id: "db-id", type: "board", name: "Kanban" });
	});

	it("returns empty args without --data", () => {
		const result = buildViewCreateCall({});
		expect(result.tool).toBe("notion-create-view");
		expect(result.args).toEqual({});
	});
});

describe("buildViewUpdateCall", () => {
	it("passes --data as args", () => {
		const data = '{"view_id":"v-id","name":"Updated"}';
		const result = buildViewUpdateCall({ data });
		expect(result.tool).toBe("notion-update-view");
		expect(result.args).toEqual({ view_id: "v-id", name: "Updated" });
	});

	it("returns empty args without --data", () => {
		const result = buildViewUpdateCall({});
		expect(result.tool).toBe("notion-update-view");
		expect(result.args).toEqual({});
	});
});

describe("registerViewCommands", () => {
	it("registers view command group with subcommands", () => {
		const program = new Command();
		registerViewCommands(program);
		const view = program.commands.find((c) => c.name() === "view");
		expect(view).toBeDefined();

		const subcommandNames = view?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("create");
		expect(subcommandNames).toContain("update");
	});
});
