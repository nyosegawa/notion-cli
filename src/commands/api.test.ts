import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildApiCall, registerApiCommand } from "./api.js";

describe("buildApiCall", () => {
	it("maps tool name with JSON args", () => {
		const result = buildApiCall("notion-search", '{"query":"test"}');
		expect(result).toEqual({
			tool: "notion-search",
			args: { query: "test" },
		});
	});

	it("maps tool name without args", () => {
		const result = buildApiCall("notion-search");
		expect(result).toEqual({
			tool: "notion-search",
			args: {},
		});
	});

	it("maps tool name with empty string args", () => {
		const result = buildApiCall("notion-search", "");
		expect(result).toEqual({
			tool: "notion-search",
			args: {},
		});
	});

	it("throws CliError on invalid JSON", () => {
		expect(() => buildApiCall("notion-search", "{invalid}")).toThrow("Invalid JSON");
	});

	it("throws CliError when JSON is not an object", () => {
		expect(() => buildApiCall("notion-search", '"string"')).toThrow("Invalid argument type");
	});

	it("throws CliError when JSON is an array", () => {
		expect(() => buildApiCall("notion-search", "[1,2]")).toThrow("Invalid argument type");
	});
});

describe("registerApiCommand", () => {
	it("registers api command on program", () => {
		const program = new Command();
		registerApiCommand(program);
		const cmd = program.commands.find((c) => c.name() === "api");
		expect(cmd).toBeDefined();
	});
});
