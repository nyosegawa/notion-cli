export class CliError extends Error {
	constructor(
		public readonly what: string,
		public readonly why: string,
		public readonly hint?: string,
	) {
		super(what);
		this.name = "CliError";
	}
}

export function formatError(error: unknown): string {
	if (error instanceof CliError) {
		const lines = [`Error: ${error.what}`, `  Why: ${error.why}`];
		if (error.hint) {
			lines.push(`  Hint: ${error.hint}`);
		}
		return lines.join("\n");
	}
	if (error instanceof Error) {
		return `Error: ${error.message}`;
	}
	return `Error: ${String(error)}`;
}

export function isRateLimitError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	const msg = error.message.toLowerCase();
	return msg.includes("rate limit") || msg.includes("429");
}

export function parseJsonData(json: string): Record<string, unknown> {
	try {
		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		throw new CliError(
			"Invalid --data JSON",
			"The provided JSON string could not be parsed",
			'Check syntax: --data \'{"key": "value"}\'',
		);
	}
}

export interface RetryOptions {
	maxRetries?: number;
	baseDelayMs?: number;
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
	const { maxRetries = 3, baseDelayMs = 1000 } = opts;
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			if (!isRateLimitError(error) || attempt === maxRetries) {
				throw error;
			}
			const delay = baseDelayMs * 2 ** attempt;
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
	throw lastError;
}
