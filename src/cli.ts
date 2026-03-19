import { Command } from "commander";
import { registerApiCommand } from "./commands/api.js";
import { registerBeadsCommands } from "./commands/beads.js";
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
	.name("ncli")
	.version("0.2.0")
	.description(
		"ncli — read and write Notion from the terminal.\nAll commands support --json and --raw for structured output.",
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
					'Run "ncli --help" for usage, or "ncli <command> --help" for details.\n',
				);
			}
		},
	})
	.addHelpText(
		"after",
		`
Quick start:
  ncli search "keyword"                        # Find pages/databases
  ncli fetch <id>                              # Get content (use ID from search results)
  ncli page create --title "New" --parent <id> # Create a page
  ncli page update <id> --prop "Status=Done"   # Update properties

Workflow: search → fetch (get IDs/schema) → create/update/query
For databases: always "ncli fetch <db-id>" first to get data_source_id.
Use --json for structured output. Errors include recovery hints.
Run "ncli <command> --help" for details, examples, and tips (e.g. "ncli db create --help").`,
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
registerBeadsCommands(program);

export { program };
