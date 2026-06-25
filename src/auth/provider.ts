import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import openBrowser from "open";
import { CALLBACK_PATH, CLIENT_NAME } from "../util/config.js";
import { CliError } from "../util/errors.js";
import type { CallbackServer } from "./callback-server.js";
import type { TokenStore } from "./token-store.js";

export interface NotionOAuthProviderOptions {
	preferredPort?: number;
}

export class NotionOAuthProvider implements OAuthClientProvider {
	private callbackStartPromise: Promise<void> | null = null;
	private callbackPromise: Promise<string> | null = null;
	private refreshFailed = false;
	private readonly preferredPort?: number;

	constructor(
		private tokenStore: TokenStore,
		private callbackServer: CallbackServer,
		options: NotionOAuthProviderOptions = {},
	) {
		this.preferredPort = options.preferredPort;
	}

	get redirectUrl(): string {
		return `http://127.0.0.1:${this.callbackServer.port}${CALLBACK_PATH}`;
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: CLIENT_NAME,
			redirect_uris: [this.redirectUrl],
			grant_types: ["authorization_code", "refresh_token"],
			response_types: ["code"],
			token_endpoint_auth_method: "none",
		};
	}

	async clientInformation(): Promise<OAuthClientInformationFull | undefined> {
		const clientInfo = this.tokenStore.readClientInfo() as OAuthClientInformationFull | undefined;

		if (!clientInfo) {
			// First-time auth: start server for registration
			await this.ensureCallbackServerStarted();
			return undefined;
		}

		if (!this.refreshFailed) {
			// First call: let the SDK try refresh with the saved client info.
			// No server needed yet — refresh doesn't use redirect_uri.
			return clientInfo;
		}

		// Refresh failed: start the server for browser authorization.
		await this.ensureCallbackServerStarted();
		if (this.preferredPort !== undefined && this.callbackServer.port !== this.preferredPort) {
			// Port changed — saved redirect_uri is stale, force re-registration
			this.tokenStore.deleteClientInfo();
			return undefined;
		}
		return clientInfo;
	}

	async saveClientInformation(info: OAuthClientInformationFull): Promise<void> {
		this.tokenStore.saveClientInfo(info as unknown as Record<string, unknown>);
	}

	tokens(): OAuthTokens | undefined {
		return this.tokenStore.readTokens() as OAuthTokens | undefined;
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		this.tokenStore.saveTokens(tokens as unknown as Record<string, unknown>);
	}

	codeVerifier(): string {
		const verifier = this.tokenStore.readCodeVerifier();
		if (!verifier) {
			throw new CliError(
				"No code verifier saved",
				"OAuth state is corrupted",
				"Run ncli login to re-authenticate",
			);
		}
		return verifier;
	}

	async saveCodeVerifier(verifier: string): Promise<void> {
		this.tokenStore.saveCodeVerifier(verifier);
	}

	async redirectToAuthorization(url: URL): Promise<void> {
		await this.ensureCallbackServerStarted();
		this.beginCallbackWait();
		await openBrowser(url.toString());
	}

	async waitForCallback(): Promise<string> {
		if (!this.callbackPromise) {
			throw new CliError(
				"OAuth callback not started",
				"The authorization flow did not start before waiting for the callback",
				"Run ncli login to retry",
			);
		}
		return this.callbackPromise;
	}

	async invalidateCredentials(
		scope: "all" | "client" | "tokens" | "verifier" | "discovery",
	): Promise<void> {
		switch (scope) {
			case "all":
				this.tokenStore.deleteOAuthState();
				this.refreshFailed = false;
				break;
			case "client":
				this.tokenStore.deleteClientInfo();
				break;
			case "tokens":
				this.tokenStore.deleteTokens();
				this.refreshFailed = true;
				break;
			case "verifier":
				this.tokenStore.deleteCodeVerifier();
				break;
			case "discovery":
				break;
		}
	}

	private async ensureCallbackServerStarted(): Promise<void> {
		if (this.callbackServer.port > 0) return;
		this.callbackStartPromise ??= this.callbackServer.start(this.preferredPort);
		await this.callbackStartPromise;
	}

	private beginCallbackWait(): Promise<string> {
		if (this.callbackPromise) return this.callbackPromise;

		const callbackPromise = this.callbackServer.waitForCallback().catch((error: unknown) => {
			if (this.callbackPromise === callbackPromise) {
				this.callbackPromise = null;
			}
			throw error;
		});
		this.callbackPromise = callbackPromise;
		return callbackPromise;
	}
}
