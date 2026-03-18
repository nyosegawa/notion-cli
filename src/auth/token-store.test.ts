import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TokenStore } from "./token-store.js";

describe("TokenStore", () => {
	let tmpDir: string;
	let store: TokenStore;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "notion-cli-test-"));
		store = new TokenStore(tmpDir);
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	describe("tokens", () => {
		it("returns undefined when no tokens file exists", () => {
			expect(store.readTokens()).toBeUndefined();
		});

		it("saves and reads tokens", () => {
			const tokens = { access_token: "abc", refresh_token: "def", expires_in: 3600 };
			store.saveTokens(tokens);
			expect(store.readTokens()).toEqual(tokens);
		});

		it("deletes tokens", () => {
			store.saveTokens({ access_token: "abc" });
			store.deleteTokens();
			expect(store.readTokens()).toBeUndefined();
		});

		it("delete is no-op when file missing", () => {
			expect(() => store.deleteTokens()).not.toThrow();
		});

		it("writes files with 0o600 permissions", () => {
			store.saveTokens({ access_token: "abc" });
			const stat = fs.statSync(path.join(tmpDir, "tokens.json"));
			expect(stat.mode & 0o777).toBe(0o600);
		});
	});

	describe("clientInfo", () => {
		it("returns undefined when no file exists", () => {
			expect(store.readClientInfo()).toBeUndefined();
		});

		it("saves and reads client info", () => {
			const info = { client_id: "id123", client_secret: "sec456" };
			store.saveClientInfo(info);
			expect(store.readClientInfo()).toEqual(info);
		});

		it("deletes client info", () => {
			store.saveClientInfo({ client_id: "id123" });
			store.deleteClientInfo();
			expect(store.readClientInfo()).toBeUndefined();
		});
	});

	describe("codeVerifier", () => {
		it("returns undefined when no file exists", () => {
			expect(store.readCodeVerifier()).toBeUndefined();
		});

		it("saves and reads code verifier", () => {
			store.saveCodeVerifier("verifier123");
			expect(store.readCodeVerifier()).toBe("verifier123");
		});

		it("deletes code verifier", () => {
			store.saveCodeVerifier("verifier123");
			store.deleteCodeVerifier();
			expect(store.readCodeVerifier()).toBeUndefined();
		});
	});

	describe("deleteAll", () => {
		it("deletes all files", () => {
			store.saveTokens({ access_token: "abc" });
			store.saveClientInfo({ client_id: "id" });
			store.saveCodeVerifier("v");
			store.deleteAll();
			expect(store.readTokens()).toBeUndefined();
			expect(store.readClientInfo()).toBeUndefined();
			expect(store.readCodeVerifier()).toBeUndefined();
		});
	});

	describe("directory creation", () => {
		it("creates nested directories when they dont exist", () => {
			const nestedDir = path.join(tmpDir, "a", "b", "c");
			const nestedStore = new TokenStore(nestedDir);
			nestedStore.saveTokens({ access_token: "abc" });
			expect(nestedStore.readTokens()).toEqual({ access_token: "abc" });
		});
	});
});
