export interface OutputOptions {
	json?: boolean;
	raw?: boolean;
}

export function extractText(result: Record<string, unknown>): string {
	if (!("content" in result) || !Array.isArray(result.content)) {
		return JSON.stringify(result);
	}
	return (result.content as Array<{ type: string; text?: string }>)
		.filter((c) => c.type === "text" && c.text)
		.map((c) => c.text)
		.join("\n");
}

export function formatOutput(result: Record<string, unknown>, opts: OutputOptions): string {
	if (opts.raw) {
		return JSON.stringify(result, null, 2);
	}
	if (opts.json) {
		const text = extractText(result);
		try {
			const parsed = JSON.parse(text);
			return JSON.stringify(parsed, null, 2);
		} catch {
			return JSON.stringify({ text }, null, 2);
		}
	}
	const text = extractText(result);
	try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return text;
	}
}

export function printOutput(result: Record<string, unknown>, opts: OutputOptions): void {
	console.log(formatOutput(result, opts));
}

export function formatRestOutput(result: Record<string, unknown>, opts: OutputOptions): string {
	if (opts.json) {
		return JSON.stringify(result, null, 2);
	}
	if (opts.raw) {
		return JSON.stringify(result);
	}
	return JSON.stringify(result, null, 2);
}

function isEmptyListResponse(result: Record<string, unknown>): boolean {
	return (
		result.object === "list" &&
		Array.isArray(result.results) &&
		(result.results as unknown[]).length === 0
	);
}

export function printRestOutput(result: Record<string, unknown>, opts: OutputOptions): void {
	console.log(formatRestOutput(result, opts));
	if (isEmptyListResponse(result)) {
		console.error(
			"\nNote: No results found. If you expected results, ensure your integration has access to pages.\n  Go to https://www.notion.so/profile/integrations/internal → select your integration → Content access tab → edit access to add pages.",
		);
	}
}
