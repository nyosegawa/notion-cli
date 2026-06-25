import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotionOAuthProvider } from "../auth/provider.js";
import { CliError } from "../util/errors.js";

const mocks = vi.hoisted(() => ({
	callbackStart: vi.fn(),
	callbackStop: vi.fn(),
	callbackWait: vi.fn(),
	clientClose: vi.fn(),
	clientConnect: vi.fn(),
	finishAuth: vi.fn(),
	openBrowser: vi.fn(),
	readClientInfo: vi.fn(),
	callbackPort: 0,
	transportInstances: [] as Array<{ authProvider: unknown; finishAuth: ReturnType<typeof vi.fn> }>,
}));

vi.mock("open", () => ({
	default: mocks.openBrowser,
}));

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => ({
	Client: vi.fn(
		class {
			callTool = vi.fn();
			close = mocks.clientClose;
			connect = mocks.clientConnect;
			listTools = vi.fn();
		},
	),
}));

vi.mock("@modelcontextprotocol/sdk/client/streamableHttp.js", () => ({
	StreamableHTTPClientTransport: vi.fn(
		class {
			authProvider: unknown;
			finishAuth = mocks.finishAuth;

			constructor(_url: URL, opts: { authProvider?: unknown }) {
				this.authProvider = opts.authProvider;
				mocks.transportInstances.push(this);
			}
		},
	),
}));

vi.mock("../auth/callback-server.js", () => ({
	CallbackServer: vi.fn(
		class {
			start = mocks.callbackStart;
			stop = mocks.callbackStop;
			waitForCallback = mocks.callbackWait;

			get port() {
				return mocks.callbackPort;
			}
		},
	),
}));

vi.mock("../auth/token-store.js", () => ({
	TokenStore: vi.fn(
		class {
			readClientInfo = mocks.readClientInfo;
		},
	),
}));

import { extractPortFromClientInfo, MCPConnection } from "./client.js";

beforeEach(() => {
	vi.clearAllMocks();
	mocks.callbackPort = 0;
	mocks.transportInstances.length = 0;
	mocks.callbackStart.mockImplementation(async (preferredPort?: number) => {
		mocks.callbackPort = preferredPort ?? 60000;
	});
	mocks.callbackWait.mockResolvedValue("callback-code");
	mocks.clientClose.mockResolvedValue(undefined);
	mocks.clientConnect.mockResolvedValue(undefined);
	mocks.finishAuth.mockResolvedValue(undefined);
	mocks.openBrowser.mockResolvedValue(undefined);
	mocks.readClientInfo.mockReturnValue({
		client_id: "abc",
		redirect_uris: ["http://127.0.0.1:54975/callback"],
	});
});

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
	it("does not start callback server before a successful SDK connect", async () => {
		const conn = new MCPConnection();

		await conn.connect();

		expect(mocks.callbackStart).not.toHaveBeenCalled();
		expect(mocks.transportInstances[0]?.authProvider).toBeInstanceOf(NotionOAuthProvider);
		await conn.disconnect();
	});

	it("completes UnauthorizedError auth recovery through the provider callback handoff", async () => {
		mocks.clientConnect
			.mockImplementationOnce(async () => {
				const provider = mocks.transportInstances[0]?.authProvider as NotionOAuthProvider;
				await provider.redirectToAuthorization(new URL("https://auth.example/authorize"));
				throw new UnauthorizedError();
			})
			.mockResolvedValueOnce(undefined);
		const conn = new MCPConnection();

		await conn.connect();

		expect(mocks.callbackStart).toHaveBeenCalledWith(54975);
		expect(mocks.callbackWait).toHaveBeenCalled();
		expect(mocks.openBrowser).toHaveBeenCalledWith("https://auth.example/authorize");
		expect(mocks.finishAuth).toHaveBeenCalledWith("callback-code");
		expect(mocks.clientConnect).toHaveBeenCalledTimes(2);
		expect(mocks.transportInstances).toHaveLength(2);
		await conn.disconnect();
	});

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
