import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { CallbackServer } from "./callback-server.js";

describe("CallbackServer", () => {
	const servers: CallbackServer[] = [];

	function tracked(server: CallbackServer): CallbackServer {
		servers.push(server);
		return server;
	}

	afterEach(() => {
		for (const s of servers) s.stop();
		servers.length = 0;
	});

	describe("start()", () => {
		it("assigns a port when called without arguments", async () => {
			const server = tracked(new CallbackServer());
			await server.start();
			expect(server.port).toBeGreaterThan(0);
		});

		it("uses the preferred port when available", async () => {
			// Find a free port first
			const tempServer = http.createServer();
			const freePort = await new Promise<number>((resolve) => {
				tempServer.listen(0, "127.0.0.1", () => {
					const addr = tempServer.address();
					resolve(typeof addr === "object" && addr ? addr.port : 0);
				});
			});
			tempServer.close();

			const server = tracked(new CallbackServer());
			await server.start(freePort);
			expect(server.port).toBe(freePort);
		});

		it("falls back to a random port when preferred port is in use", async () => {
			// Occupy a port
			const blocker = http.createServer();
			const occupiedPort = await new Promise<number>((resolve) => {
				blocker.listen(0, "127.0.0.1", () => {
					const addr = blocker.address();
					resolve(typeof addr === "object" && addr ? addr.port : 0);
				});
			});

			try {
				const server = tracked(new CallbackServer());
				await server.start(occupiedPort);
				expect(server.port).toBeGreaterThan(0);
				expect(server.port).not.toBe(occupiedPort);
			} finally {
				blocker.close();
			}
		});
	});
});
