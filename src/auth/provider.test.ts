import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallbackServer } from "./callback-server.js";
import { NotionOAuthProvider, StaleRedirectPortError } from "./provider.js";
import { TokenStore } from "./token-store.js";

const openBrowser = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("open", () => ({ default: openBrowser }));

describe("NotionOAuthProvider", () => {
	let tmpDir: string;
	let store: TokenStore;
	const callbackServer = { port: 54321 } as unknown as CallbackServer;
	const authUrl = new URL("https://mcp.notion.com/authorize?client_id=old");

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ncli-provider-test-"));
		store = new TokenStore(tmpDir);
		store.saveClientInfo({
			client_id: "old",
			redirect_uris: ["http://127.0.0.1:59604/callback"],
		});
		store.saveTokens({ access_token: "a", refresh_token: "r" });
		openBrowser.mockClear();
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("redirectToAuthorization()", () => {
		it("opens the browser when the registered redirect port is live", async () => {
			const provider = new NotionOAuthProvider(store, callbackServer);
			await provider.redirectToAuthorization(authUrl);

			expect(openBrowser).toHaveBeenCalledWith(authUrl.toString());
			expect(store.readClientInfo()).toBeDefined();
			expect(store.readTokens()).toBeDefined();
		});

		it("discards the stale registration instead of opening the browser", async () => {
			const provider = new NotionOAuthProvider(store, callbackServer, {
				redirectPortStale: true,
			});

			await expect(provider.redirectToAuthorization(authUrl)).rejects.toThrow(
				StaleRedirectPortError,
			);
			expect(openBrowser).not.toHaveBeenCalled();
			// Both files are bound to the old client_id: the registration carries the
			// unreachable redirect_uri, and the refresh token would be rejected with
			// "Client ID mismatch" by any newly registered client.
			expect(store.readClientInfo()).toBeUndefined();
			expect(store.readTokens()).toBeUndefined();
		});
	});
});
