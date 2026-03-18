import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { registerLoginCommands } from "./login.js";

describe("registerLoginCommands", () => {
	it("registers login, logout, and whoami commands", () => {
		const program = new Command();
		registerLoginCommands(program);
		const names = program.commands.map((c) => c.name());
		expect(names).toContain("login");
		expect(names).toContain("logout");
		expect(names).toContain("whoami");
	});
});
