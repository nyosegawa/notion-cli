#!/usr/bin/env node
import { program } from "./cli.js";
import { CliError, formatError } from "./util/errors.js";

program.parseAsync().catch((error) => {
	if (process.exitCode !== 0) {
		// withConnection already set exitCode; avoid double-printing
		// unless the error was not yet displayed
	}
	const opts = program.opts();
	if (opts.json) {
		const payload: Record<string, string> = {
			error:
				error instanceof CliError
					? error.what
					: error instanceof Error
						? error.message
						: String(error),
		};
		if (error instanceof CliError) {
			payload.why = error.why;
			if (error.hint) payload.hint = error.hint;
		}
		console.error(JSON.stringify(payload, null, 2));
	} else {
		console.error(formatError(error));
	}
	process.exitCode = 1;
});
