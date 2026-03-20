import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildRestCall, registerRestCommands } from "./rest.js";

describe("buildRestCall", () => {
	it("maps GET request without body", () => {
		const result = buildRestCall("GET", "/pages/abc123");
		expect(result).toEqual({
			method: "GET",
			path: "/pages/abc123",
		});
	});

	it("maps POST request with JSON body", () => {
		const result = buildRestCall("POST", "/pages", '{"parent":{"page_id":"abc"}}');
		expect(result).toEqual({
			method: "POST",
			path: "/pages",
			body: { parent: { page_id: "abc" } },
		});
	});

	it("normalizes method to uppercase", () => {
		const result = buildRestCall("get", "/users/me");
		expect(result.method).toBe("GET");
	});

	it("adds leading slash if missing", () => {
		const result = buildRestCall("GET", "pages/abc123");
		expect(result.path).toBe("/pages/abc123");
	});

	it("handles PATCH method", () => {
		const result = buildRestCall("PATCH", "/databases/abc", '{"title":[]}');
		expect(result.method).toBe("PATCH");
		expect(result.body).toEqual({ title: [] });
	});

	it("handles DELETE method", () => {
		const result = buildRestCall("DELETE", "/blocks/abc");
		expect(result.method).toBe("DELETE");
	});

	it("throws on invalid HTTP method", () => {
		expect(() => buildRestCall("PUT", "/pages")).toThrow("Invalid HTTP method");
	});

	it("throws on invalid JSON body", () => {
		expect(() => buildRestCall("POST", "/pages", "{invalid}")).toThrow("Invalid --data JSON");
	});

	it("treats empty JSON string as no body", () => {
		const result = buildRestCall("GET", "/pages/abc", "");
		expect(result.body).toBeUndefined();
	});

	it("treats whitespace-only JSON as no body", () => {
		const result = buildRestCall("GET", "/pages/abc", "   ");
		expect(result.body).toBeUndefined();
	});
});

describe("registerRestCommands", () => {
	it("registers rest command group on program", () => {
		const program = new Command();
		registerRestCommands(program);
		const cmd = program.commands.find((c) => c.name() === "rest");
		expect(cmd).toBeDefined();
	});

	it("registers login subcommand", () => {
		const program = new Command();
		registerRestCommands(program);
		const rest = program.commands.find((c) => c.name() === "rest");
		const login = rest?.commands.find((c) => c.name() === "login");
		expect(login).toBeDefined();
	});

	it("registers logout subcommand", () => {
		const program = new Command();
		registerRestCommands(program);
		const rest = program.commands.find((c) => c.name() === "rest");
		const logout = rest?.commands.find((c) => c.name() === "logout");
		expect(logout).toBeDefined();
	});

	it("registers call subcommand", () => {
		const program = new Command();
		registerRestCommands(program);
		const rest = program.commands.find((c) => c.name() === "rest");
		const call = rest?.commands.find((c) => c.name() === "call");
		expect(call).toBeDefined();
	});
});
