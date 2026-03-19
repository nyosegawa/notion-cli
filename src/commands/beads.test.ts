import { Command } from "commander";
import { describe, expect, it } from "vitest";
import {
	buildBeadsAuthCall,
	buildBeadsCreateCall,
	buildBeadsFetchCall,
	buildBeadsPullCall,
	buildBeadsUpdateCall,
	registerBeadsCommands,
} from "./beads.js";

describe("buildBeadsAuthCall", () => {
	it("targets notion-get-users self lookup", () => {
		expect(buildBeadsAuthCall()).toEqual({
			tool: "notion-get-users",
			args: { user_id: "self" },
		});
	});
});

describe("buildBeadsFetchCall", () => {
	it("maps database id to notion-fetch", () => {
		expect(buildBeadsFetchCall("db-id")).toEqual({
			tool: "notion-fetch",
			args: { id: "db-id" },
		});
	});
});

describe("buildBeadsPullCall", () => {
	it("maps view url to notion-query-database-view", () => {
		expect(buildBeadsPullCall("view://abc")).toEqual({
			tool: "notion-query-database-view",
			args: { view_url: "view://abc" },
		});
	});
});

describe("buildBeadsCreateCall", () => {
	it("creates pages under a data source", () => {
		expect(
			buildBeadsCreateCall("ds-1", [
				{
					id: "bd-1",
					title: "Issue",
					description: null,
					status: "open",
					priority: null,
					type: null,
					issue_type: null,
					assignee: null,
					labels: [],
				},
			]),
		).toEqual({
			tool: "notion-create-pages",
			args: {
				parent: { data_source_id: "ds-1", type: "data_source_id" },
				pages: [
					{
						properties: {
							title: "Issue",
							"Beads ID": "bd-1",
							Status: "Open",
						},
					},
				],
			},
		});
	});
});

describe("buildBeadsUpdateCall", () => {
	it("updates properties on an existing page", () => {
		expect(
			buildBeadsUpdateCall("page-1", {
				id: "bd-1",
				title: "Issue",
				description: null,
				status: null,
				priority: "high",
				type: "bug",
				issue_type: "bug",
				assignee: null,
				labels: [],
			}),
		).toEqual({
			tool: "notion-update-page",
			args: {
				page_id: "page-1",
				command: "update_properties",
				properties: {
					title: "Issue",
					"Beads ID": "bd-1",
					Priority: "High",
					Type: "Bug",
				},
			},
		});
	});
});

describe("registerBeadsCommands", () => {
	it("registers status, pull, and push subcommands", () => {
		const program = new Command();
		registerBeadsCommands(program);
		const beads = program.commands.find((command) => command.name() === "beads");
		expect(beads).toBeDefined();
		expect(beads?.commands.map((command) => command.name())).toEqual(["status", "pull", "push"]);
	});
});
