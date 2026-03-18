import { CliError } from "./errors.js";

/**
 * Parse --prop "Name:type=options" flags into SQL DDL column definitions
 * for notion-create-database schema.
 *
 * Examples:
 *   "Name:title"                → "Name" TITLE
 *   "Status:select=Open,Done"   → "Status" SELECT('Open','Done')
 */
export function parseDbProps(props: string[]): string {
	return props.map(parseSingleDbProp).join(", ");
}

function parseSingleDbProp(prop: string): string {
	const colonIdx = prop.indexOf(":");
	if (colonIdx === -1) {
		throw new CliError(
			`Invalid db prop format: "${prop}"`,
			'Expected "Name:type" or "Name:type=opt1,opt2"',
			'Use --prop "Status:select=Open,Done" or --schema for raw DDL',
		);
	}
	const name = prop.slice(0, colonIdx);
	if (!name) {
		throw new CliError(
			`Empty property name in: "${prop}"`,
			"Name before : cannot be empty",
			'Use --prop "Name:title"',
		);
	}
	const rest = prop.slice(colonIdx + 1);
	const eqIdx = rest.indexOf("=");

	if (eqIdx === -1) {
		const type = rest.toUpperCase();
		return `"${name}" ${type}`;
	}

	const type = rest.slice(0, eqIdx).toUpperCase();
	const options = rest
		.slice(eqIdx + 1)
		.split(",")
		.map((o) => `'${o}'`)
		.join(",");
	return `"${name}" ${type}(${options})`;
}
