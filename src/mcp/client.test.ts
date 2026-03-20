import { describe, expect, it } from "vitest";
import { CliError } from "../util/errors.js";
import { extractPortFromClientInfo, MCPConnection } from "./client.js";

describe("extractPortFromClientInfo", () => {
	it("extracts port from redirect_uris", () => {
		expect(
			extractPortFromClientInfo({
				redirect_uris: ["http://127.0.0.1:54975/callback"],
				client_id: "abc",
			}),
		).toBe(54975);
	});

	it("returns undefined when info is undefined", () => {
		expect(extractPortFromClientInfo(undefined)).toBeUndefined();
	});

	it("returns undefined when redirect_uris is missing", () => {
		expect(extractPortFromClientInfo({ client_id: "abc" })).toBeUndefined();
	});

	it("returns undefined when redirect_uris is empty", () => {
		expect(extractPortFromClientInfo({ redirect_uris: [] })).toBeUndefined();
	});

	it("returns undefined for URL without explicit port", () => {
		expect(
			extractPortFromClientInfo({ redirect_uris: ["http://127.0.0.1/callback"] }),
		).toBeUndefined();
	});
});

describe("MCPConnection", () => {
	it("throws CliError when calling callTool before connect", async () => {
		const conn = new MCPConnection();
		await expect(conn.callTool("notion-search", { query: "test" })).rejects.toThrow(CliError);
		await expect(conn.callTool("notion-search", { query: "test" })).rejects.toThrow(
			"Not connected",
		);
	});

	it("throws CliError when calling listTools before connect", async () => {
		const conn = new MCPConnection();
		await expect(conn.listTools()).rejects.toThrow(CliError);
		await expect(conn.listTools()).rejects.toThrow("Not connected");
	});

	it("disconnect is safe when not connected", async () => {
		const conn = new MCPConnection();
		await expect(conn.disconnect()).resolves.toBeUndefined();
	});
});
