import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildMeetingNotesQueryCall, registerMeetingNotesCommands } from "./meeting-notes.js";

describe("buildMeetingNotesQueryCall", () => {
	it("returns notion-query-meeting-notes with no args by default", () => {
		const result = buildMeetingNotesQueryCall({});
		expect(result.tool).toBe("notion-query-meeting-notes");
		expect(result.args).toEqual({});
	});

	it("--data passes filter args", () => {
		const data = '{"filter":{"operator":"and","filters":[]}}';
		const result = buildMeetingNotesQueryCall({ data });
		expect(result.tool).toBe("notion-query-meeting-notes");
		expect(result.args).toEqual({ filter: { operator: "and", filters: [] } });
	});
});

describe("registerMeetingNotesCommands", () => {
	it("registers meeting-notes command group with query subcommand", () => {
		const program = new Command();
		registerMeetingNotesCommands(program);
		const mn = program.commands.find((c) => c.name() === "meeting-notes");
		expect(mn).toBeDefined();

		const subcommandNames = mn?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("query");
	});
});
