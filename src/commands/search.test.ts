import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildSearchCall, registerSearchCommands } from "./search.js";

describe("buildSearchCall", () => {
	it("maps query to notion-search tool", () => {
		expect(buildSearchCall("test")).toEqual({
			tool: "notion-search",
			args: { query: "test" },
		});
	});

	it("handles query with special characters", () => {
		expect(buildSearchCall("quarterly review & notes")).toEqual({
			tool: "notion-search",
			args: { query: "quarterly review & notes" },
		});
	});

	it("handles empty query string", () => {
		expect(buildSearchCall("")).toEqual({
			tool: "notion-search",
			args: { query: "" },
		});
	});
});

describe("registerSearchCommands", () => {
	it("registers search command on program", () => {
		const program = new Command();
		registerSearchCommands(program);
		const cmd = program.commands.find((c) => c.name() === "search");
		expect(cmd).toBeDefined();
	});
});
