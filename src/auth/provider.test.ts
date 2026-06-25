import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallbackServer } from "./callback-server.js";
import { NotionOAuthProvider } from "./provider.js";
import { TokenStore } from "./token-store.js";

describe("NotionOAuthProvider", () => {
	let tmpDir: string;
	let store: TokenStore;
	const callbackServers: CallbackServer[] = [];
	const blockers: http.Server[] = [];

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncli-provider-test-"));
		store = new TokenStore(tmpDir);
	});

	afterEach(async () => {
		for (const server of callbackServers) server.stop();
		callbackServers.length = 0;

		await Promise.all(
			blockers.map(
				(server) =>
					new Promise<void>((resolve) => {
						server.close(() => resolve());
					}),
			),
		);
		blockers.length = 0;

		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	function trackedCallbackServer(): CallbackServer {
		const server = new CallbackServer();
		callbackServers.push(server);
		return server;
	}

	function fakeCallbackServer(options: {
		port?: number;
		start?: (preferredPort?: number) => Promise<void>;
		waitForCallback?: () => Promise<string>;
	}): CallbackServer {
		return {
			get port() {
				return options.port ?? 0;
			},
			start: options.start ?? vi.fn(async () => undefined),
			waitForCallback: options.waitForCallback ?? vi.fn(async () => "callback-code"),
			stop: vi.fn(),
		} as unknown as CallbackServer;
	}

	async function occupyPort(): Promise<number> {
		const blocker = http.createServer();
		blockers.push(blocker);
		return await new Promise<number>((resolve) => {
			blocker.listen(0, "127.0.0.1", () => {
				const addr = blocker.address();
				resolve(typeof addr === "object" && addr ? addr.port : 0);
			});
		});
	}

	it("reads saved tokens without starting the callback server", () => {
		const tokens = {
			access_token: "access-token",
			token_type: "Bearer",
			refresh_token: "refresh-token",
		};
		store.saveTokens(tokens);
		const callbackServer = trackedCallbackServer();
		const provider = new NotionOAuthProvider(store, callbackServer, {
			preferredPort: 54975,
		});

		expect(provider.tokens()).toEqual(tokens);
		expect(callbackServer.port).toBe(0);
	});

	it("returns saved client info without starting the server when refresh has not failed", async () => {
		const clientInfo = {
			client_id: "client-id",
			redirect_uris: ["http://127.0.0.1:54975/callback"],
		};
		store.saveClientInfo(clientInfo);
		const callbackServer = trackedCallbackServer();
		const provider = new NotionOAuthProvider(store, callbackServer, {
			preferredPort: 54975,
		});

		await expect(provider.clientInformation()).resolves.toEqual(clientInfo);
		expect(callbackServer.port).toBe(0);
	});

	it("starts the server and returns undefined when no saved client info exists", async () => {
		const callbackServer = trackedCallbackServer();
		const provider = new NotionOAuthProvider(store, callbackServer);

		await expect(provider.clientInformation()).resolves.toBeUndefined();
		expect(callbackServer.port).toBeGreaterThan(0);
	});

	it("returns saved client info after refresh failure when port matches", async () => {
		const preferredPort = await occupyPort();
		// Free the port so it can be reused
		const blocker = blockers.pop();
		await new Promise<void>((resolve) => blocker?.close(() => resolve()));

		const clientInfo = {
			client_id: "client-id",
			redirect_uris: [`http://127.0.0.1:${preferredPort}/callback`],
		};
		store.saveClientInfo(clientInfo);
		const callbackServer = trackedCallbackServer();
		const provider = new NotionOAuthProvider(store, callbackServer, {
			preferredPort,
		});

		// Simulate SDK refresh failure path
		await provider.invalidateCredentials("tokens");

		await expect(provider.clientInformation()).resolves.toEqual(clientInfo);
		expect(callbackServer.port).toBe(preferredPort);
	});

	it("deletes client info and returns undefined after refresh failure with port conflict", async () => {
		const occupiedPort = await occupyPort();
		const clientInfo = {
			client_id: "client-id",
			redirect_uris: [`http://127.0.0.1:${occupiedPort}/callback`],
		};
		store.saveClientInfo(clientInfo);

		const callbackServer = trackedCallbackServer();
		const provider = new NotionOAuthProvider(store, callbackServer, {
			preferredPort: occupiedPort,
		});

		// Simulate SDK refresh failure path
		await provider.invalidateCredentials("tokens");

		await expect(provider.clientInformation()).resolves.toBeUndefined();
		expect(callbackServer.port).toBeGreaterThan(0);
		expect(callbackServer.port).not.toBe(occupiedPort);
		expect(store.readClientInfo()).toBeUndefined();
	});

	it("throws when waitForCallback is called before redirectToAuthorization", async () => {
		const callbackServer = fakeCallbackServer({ port: 60000 });
		const provider = new NotionOAuthProvider(store, callbackServer);

		await expect(provider.waitForCallback()).rejects.toThrow("OAuth callback not started");
	});

	it("creates a fresh callback wait after a rejected callback promise", async () => {
		let rejectCallback: (err: Error) => void;
		const firstPromise = new Promise<string>((_, reject) => {
			rejectCallback = reject;
		});
		const waitForCallback = vi
			.fn<() => Promise<string>>()
			.mockReturnValueOnce(firstPromise)
			.mockResolvedValueOnce("callback-code");
		const callbackServer = fakeCallbackServer({ port: 60000, waitForCallback });
		const provider = new NotionOAuthProvider(store, callbackServer);

		// First: redirectToAuthorization starts a callback wait
		vi.mock("open", () => ({ default: vi.fn() }));
		await provider.redirectToAuthorization(new URL("https://example.com/auth"));
		const firstWait = provider.waitForCallback();

		// Reject after waitForCallback() has captured the promise
		rejectCallback?.(new Error("timeout"));
		await expect(firstWait).rejects.toThrow("timeout");

		// Second: a new redirectToAuthorization starts a fresh wait
		await provider.redirectToAuthorization(new URL("https://example.com/auth"));
		await expect(provider.waitForCallback()).resolves.toBe("callback-code");

		expect(waitForCallback).toHaveBeenCalledTimes(2);
	});
});
