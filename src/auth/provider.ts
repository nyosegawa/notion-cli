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

export class NotionOAuthProvider implements OAuthClientProvider {
	constructor(
		private tokenStore: TokenStore,
		private callbackServer: CallbackServer,
	) {}

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
		await openBrowser(url.toString());
	}
}
