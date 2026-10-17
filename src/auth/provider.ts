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
	/**
	 * True when the callback server could not bind the port recorded in the cached
	 * client registration (`client.json`) and fell back to another port.
	 *
	 * The cached registration is still valid for token refresh — only the
	 * authorization-code flow needs a redirect_uri that matches the live port — so
	 * the registration must not be discarded until a browser login is actually
	 * required. See {@link NotionOAuthProvider.redirectToAuthorization}.
	 */
	redirectPortStale?: boolean;
}

/**
 * Thrown by `redirectToAuthorization()` when the cached client registration points
 * at a redirect port that is not live. The stale registration and its tokens have
 * been removed; the caller should retry the connection so the SDK registers a new
 * client with the live port and starts the login flow.
 */
export class StaleRedirectPortError extends Error {
	constructor() {
		super("Cached OAuth client registration points at an unavailable callback port");
		this.name = "StaleRedirectPortError";
	}
}

export class NotionOAuthProvider implements OAuthClientProvider {
	private readonly redirectPortStale: boolean;

	constructor(
		private tokenStore: TokenStore,
		private callbackServer: CallbackServer,
		options: NotionOAuthProviderOptions = {},
	) {
		this.redirectPortStale = options.redirectPortStale ?? false;
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

	clientInformation(): OAuthClientInformationFull | undefined {
		return this.tokenStore.readClientInfo() as OAuthClientInformationFull | undefined;
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
		if (this.redirectPortStale) {
			// Reaching this point means a browser login is unavoidable (no tokens, or the
			// refresh was rejected). The registration's redirect_uri cannot receive the
			// callback, and the tokens are bound to that client_id — a freshly registered
			// client would be refused with "Client ID mismatch" — so drop both and let the
			// caller start over with a registration that uses the live port.
			this.tokenStore.deleteClientInfo();
			this.tokenStore.deleteTokens();
			throw new StaleRedirectPortError();
		}
		await openBrowser(url.toString());
	}
}
