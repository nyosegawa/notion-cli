import { Command } from "commander";
import { registerApiCommand } from "./commands/api.js";
import { registerCommentCommands } from "./commands/comment.js";
import { registerDbCommands } from "./commands/db.js";
import { registerFetchCommands } from "./commands/fetch.js";
import { registerLoginCommands } from "./commands/login.js";
import { registerMeetingNotesCommands } from "./commands/meeting-notes.js";
import { registerPageCommands } from "./commands/page.js";
import { registerSearchCommands } from "./commands/search.js";
import { registerTeamCommands, registerUserCommands } from "./commands/user.js";
import { registerViewCommands } from "./commands/view.js";

const program = new Command()
	.name("notion")
	.version("0.1.0")
	.description(
		"Notion CLI — read and write Notion from the terminal.\nAll commands support --json and --raw for structured output.",
	)
	.option("--json", "Output as JSON (structured, parseable)")
	.option("--raw", "Output raw MCP response (full server payload)")
	.option("--verbose", "Verbose output")
	.option("--no-color", "Disable colors")
	.configureOutput({
		writeErr: (str) => {
			process.stderr.write(str);
			if (str.includes("error:")) {
				process.stderr.write(
					'Run "notion --help" for usage, or "notion <command> --help" for details.\n',
				);
			}
		},
	})
	.addHelpText(
		"after",
		`
Quick start:
  notion search "keyword"                        # Find pages/databases
  notion fetch <id>                              # Get content (use ID from search results)
  notion page create --title "New" --parent <id> # Create a page
  notion page update <id> --prop "Status=Done"   # Update properties

Workflow: search → fetch (get IDs/schema) → create/update/query
For databases: always "notion fetch <db-id>" first to get data_source_id.
Use --json for structured output. Errors include recovery hints.
Run "notion <command> --help" for details, examples, and tips (e.g. "notion db create --help").`,
	);

registerLoginCommands(program);
registerSearchCommands(program);
registerFetchCommands(program);
registerPageCommands(program);
registerDbCommands(program);
registerViewCommands(program);
registerCommentCommands(program);
registerUserCommands(program);
registerTeamCommands(program);
registerMeetingNotesCommands(program);
registerApiCommand(program);

export { program };
