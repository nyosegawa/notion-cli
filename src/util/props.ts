import { CliError } from "./errors.js";

export function parseProps(props: string[]): Record<string, string> {
	const result: Record<string, string> = {};
	for (const prop of props) {
		const eqIndex = prop.indexOf("=");
		if (eqIndex === -1) {
			throw new CliError(
				`Invalid property format: "${prop}"`,
				"Expected Key=Value format",
				'Use --prop "Status=Done" or --data for complex values',
			);
		}
		const key = prop.substring(0, eqIndex);
		const value = prop.substring(eqIndex + 1);
		if (!key) {
			throw new CliError(
				`Property key is empty in: "${prop}"`,
				"Key cannot be empty before =",
				'Use --prop "Key=Value"',
			);
		}
		result[key] = value;
	}
	return result;
}
