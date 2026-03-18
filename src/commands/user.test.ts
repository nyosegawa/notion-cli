import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
	buildTeamListCall,
	buildUserListCall,
	registerTeamCommands,
	registerUserCommands,
} from "./user.js";

describe("buildUserListCall", () => {
	it("returns notion-get-users with no args by default", () => {
		const result = buildUserListCall({});
		expect(result.tool).toBe("notion-get-users");
		expect(result.args).toEqual({});
	});

	it("maps --query to query arg", () => {
		const result = buildUserListCall({ query: "alice" });
		expect(result.args.query).toBe("alice");
	});

	it("maps --user-id to user_id arg", () => {
		const result = buildUserListCall({ userId: "self" });
		expect(result.args.user_id).toBe("self");
	});

	it("--data overrides all other args", () => {
		const result = buildUserListCall({
			query: "Ignored",
			data: '{"custom":"value"}',
		});
		expect(result.tool).toBe("notion-get-users");
		expect(result.args).toEqual({ custom: "value" });
	});
});

describe("buildTeamListCall", () => {
	it("returns notion-get-teams with no args by default", () => {
		const result = buildTeamListCall({});
		expect(result.tool).toBe("notion-get-teams");
		expect(result.args).toEqual({});
	});

	it("maps --query to query arg", () => {
		const result = buildTeamListCall({ query: "engineering" });
		expect(result.args.query).toBe("engineering");
	});

	it("--data overrides all other args", () => {
		const result = buildTeamListCall({
			query: "Ignored",
			data: '{"custom":"value"}',
		});
		expect(result.tool).toBe("notion-get-teams");
		expect(result.args).toEqual({ custom: "value" });
	});
});

describe("registerUserCommands", () => {
	it("registers user command group with list subcommand", () => {
		const program = new Command();
		registerUserCommands(program);
		const user = program.commands.find((c) => c.name() === "user");
		expect(user).toBeDefined();

		const subcommandNames = user?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("list");
	});
});

describe("registerTeamCommands", () => {
	it("registers team command group with list subcommand", () => {
		const program = new Command();
		registerTeamCommands(program);
		const team = program.commands.find((c) => c.name() === "team");
		expect(team).toBeDefined();

		const subcommandNames = team?.commands.map((c) => c.name());
		expect(subcommandNames).toContain("list");
	});
});
