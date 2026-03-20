import { TokenStore } from "../auth/token-store.js";
import { CONFIG_DIR, REST_TOKEN_ENV_VAR } from "../util/config.js";
import { CliError, withRetry } from "../util/errors.js";
import { NotionRestClient } from "./client.js";

export function resolveRestToken(): string {
	const envToken = process.env[REST_TOKEN_ENV_VAR];
	if (envToken) {
		return envToken;
	}

	const store = new TokenStore(CONFIG_DIR);
	const storedToken = store.readRestToken();
	if (storedToken) {
		return storedToken;
	}

	throw new CliError(
		"No REST API token configured",
		"Notion REST API requires an integration token (Bearer token)",
		`Set ${REST_TOKEN_ENV_VAR} env var, or run "ncli rest login" to save a token`,
	);
}

export async function withRestClient<T>(fn: (client: NotionRestClient) => Promise<T>): Promise<T> {
	const token = resolveRestToken();
	const client = new NotionRestClient(token);
	try {
		return await withRetry(() => fn(client));
	} catch (error) {
		process.exitCode = 1;
		throw error;
	}
}
