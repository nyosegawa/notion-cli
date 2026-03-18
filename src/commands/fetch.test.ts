import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildFetchCall, registerFetchCommands } from "./fetch.js";

describe("buildFetchCall", () => {
	it("maps URL to notion-fetch tool", () => {
		const url = "https://www.notion.so/mypage-abc123";
		expect(buildFetchCall(url)).toEqual({
			tool: "notion-fetch",
			args: { id: url },
		});
	});

	it("maps plain ID to notion-fetch tool", () => {
		expect(buildFetchCall("abc123")).toEqual({
			tool: "notion-fetch",
			args: { id: "abc123" },
		});
	});
});

describe("registerFetchCommands", () => {
	it("registers fetch command on program", () => {
		const program = new Command();
		registerFetchCommands(program);
		const cmd = program.commands.find((c) => c.name() === "fetch");
		expect(cmd).toBeDefined();
	});
});
