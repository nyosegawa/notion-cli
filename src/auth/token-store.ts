import fs from "node:fs";
import path from "node:path";

export class TokenStore {
	constructor(private configDir: string) {}

	private filePath(name: string): string {
		return path.join(this.configDir, name);
	}

	private ensureDir(): void {
		fs.mkdirSync(this.configDir, { recursive: true });
	}

	private readJson<T>(name: string): T | undefined {
		try {
			const data = fs.readFileSync(this.filePath(name), "utf-8");
			return JSON.parse(data) as T;
		} catch {
			return undefined;
		}
	}

	private writeJson(name: string, data: unknown): void {
		this.ensureDir();
		fs.writeFileSync(this.filePath(name), JSON.stringify(data, null, 2), {
			mode: 0o600,
		});
	}

	private deleteFile(name: string): void {
		try {
			fs.unlinkSync(this.filePath(name));
		} catch {
			// no-op if file doesn't exist
		}
	}

	readTokens(): Record<string, unknown> | undefined {
		return this.readJson("tokens.json");
	}

	saveTokens(tokens: Record<string, unknown>): void {
		this.writeJson("tokens.json", tokens);
	}

	deleteTokens(): void {
		this.deleteFile("tokens.json");
	}

	readClientInfo(): Record<string, unknown> | undefined {
		return this.readJson("client.json");
	}

	saveClientInfo(info: Record<string, unknown>): void {
		this.writeJson("client.json", info);
	}

	deleteClientInfo(): void {
		this.deleteFile("client.json");
	}

	readCodeVerifier(): string | undefined {
		const state = this.readJson<{ codeVerifier: string }>("auth-state.json");
		return state?.codeVerifier;
	}

	saveCodeVerifier(verifier: string): void {
		this.writeJson("auth-state.json", { codeVerifier: verifier });
	}

	deleteCodeVerifier(): void {
		this.deleteFile("auth-state.json");
	}

	deleteAll(): void {
		this.deleteTokens();
		this.deleteClientInfo();
		this.deleteCodeVerifier();
	}
}
