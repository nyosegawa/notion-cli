import { createRequire } from "node:module";
import { Command } from "commander";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

import { registerApiCommand } from "./commands/api.js";
import { registerCommentCommands } from "./commands/comment.js";
import { registerDbCommands } from "./commands/db.js";
import { registerFetchCommands } from "./commands/fetch.js";
import { registerFileCommands } from "./commands/file.js";
import { registerLoginCommands } from "./commands/login.js";
import { registerMeetingNotesCommands } from "./commands/meeting-notes.js";
import { registerPageCommands } from "./commands/page.js";
import { registerRestCommands } from "./commands/rest.js";
import { registerSearchCommands } from "./commands/search.js";
import { registerTeamCommands, registerUserCommands } from "./commands/user.js";
import { registerViewCommands } from "./commands/view.js";

const program = new Command()
	.name("ncli")
	.version(version)
	.description(
		"ncli — read and write Notion from the terminal.\nMCP commands use OAuth. REST API commands (rest, file) use integration token.",
	)
	.option("--json", "Output as JSON (structured, parseable)")
	.option("--raw", "Output raw response (full server payload)")
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
Quick start (MCP — OAuth auth):
  ncli search "keyword"                        # Find pages/databases
  ncli fetch <id>                              # Get content (use ID from search results)
  ncli page create --title "New" --parent <id> # Create a page
  ncli page update <id> --prop "Status=Done"   # Update properties

Quick start (REST API — integration token):
  ncli rest login                              # Save integration token (one-time)
  ncli rest GET /users/me                      # Verify auth
  ncli rest GET /pages/<id>                    # Get page via REST API
  ncli file upload <page-id> ./image.png       # Upload a file

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
registerRestCommands(program);
registerFileCommands(program);

export { program };
