---
name: notion
description: >
  Operate Notion workspaces via notion-cli.
  Covers page search/create/update, database create/query, view management, comments, and more.
  Use when user asks to "Notion に書いて", "ページ作って", "タスク管理", "DB 作成",
  "Notion で検索", "議事録", "create a Notion page", "track tasks in Notion",
  or any Notion workspace operation. Also triggers on "notion" keyword in requests.
compatibility: Requires notion-cli installed and authenticated (notion login). Claude Code only.
metadata:
  author: sakasegawa
  version: 1.0.0
---

# Notion CLI Skill

Guide for operating Notion workspaces using notion-cli.

## Prerequisites

Verify authentication before any operation:

```bash
notion whoami
```

If this fails, run `notion login` to complete OAuth authentication in the browser.

## Core Pattern: Search → Fetch → Act

Almost every workflow follows these three steps:

1. **Search** — `notion search "<query>" --json` to find pages/databases
2. **Fetch** — `notion fetch <id> --json` to get details and extract IDs
3. **Act** — Use the extracted IDs to create/update/query

### ID Types

| ID | Format | Purpose |
|---|---|---|
| page_id | `abc123-def456` | Target for page operations, parent for page create |
| database_id | `abc123-def456` | Required for view create |
| data_source_id | `collection://ds-xxx` | Parent for adding pages to DB, view create, db update |
| view_url | `view://view-xxx` or `https://...?v=xxx` | Target for db query |

`notion fetch <db-id>` response contains `data_source_id` and `view_url`.
See `references/id-patterns.md` for detailed extraction patterns.

## Command Quick Reference

### Authentication
| Command | Description |
|---|---|
| `notion login` | OAuth login |
| `notion logout` | Log out |
| `notion whoami` | Show current user |

### Search & Fetch
| Command | Description |
|---|---|
| `notion search "<query>"` | Search pages/databases |
| `notion fetch <url-or-id>` | Get page/database content |

### Page Operations
| Command | Description |
|---|---|
| `notion page create --title "T" --parent <id>` | Create page |
| `notion page update <id> --prop "Key=Value"` | Update properties |
| `notion page update <id> --body "content"` | Replace content |
| `notion page move <id> --to <parent-id>` | Move page |
| `notion page duplicate <id>` | Duplicate page |

### Database Operations
| Command | Description |
|---|---|
| `notion db create --title "T" --parent <page-id> --prop "Name:title" --prop "Status:select=A,B"` | Create database |
| `notion db update <ds-id> --statements 'ADD COLUMN "Col" TYPE'` | Alter schema |
| `notion db query "<view-url>"` | Query database (view URL required) |

### Views, Comments & More
| Command | Description |
|---|---|
| `notion view create --data '{...}'` | Create view (JSON required) |
| `notion view update --data '{...}'` | Update view |
| `notion comment create <page-id> --body "text"` | Add comment |
| `notion comment list <page-id>` | List comments |
| `notion user list` | List users |
| `notion team list` | List teams |
| `notion meeting-notes query` | Query meeting notes |
| `notion api <tool> '{json}'` | Call any MCP tool directly (escape hatch) |

See `references/command-reference.md` for detailed arguments and output examples.

### Global Flags

- `--json` — Structured JSON output (always use this for programmatic access)
- `--raw` — Raw MCP response
- `--data '{json}'` — Override all flags with direct JSON input

## Common Workflows

### 1. Search, Fetch, and Update a Page

```bash
# Search
notion search "project plan" --json
# → Pick page_id from results[].id

# View content
notion fetch <page-id> --json

# Update properties
notion page update <page-id> --prop "Status=Done"

# Update content (separate command from properties)
notion page update <page-id> --body "# Updated content"
```

### 2. Create New Pages

```bash
# Create under a parent page
notion page create --title "Meeting Notes 3/18" --parent <page-id> --body "# Agenda\n- Status update"

# Pipe long content via stdin
echo "# Long document..." | notion page create --title "Document" --parent <page-id> --body -

# Create in a database (requires data_source_id)
notion page create --parent collection://<ds-id> --title "Task 1" --prop "Status=Open" --prop "Priority=High"
```

### 3. Database Creation to Query (Full Lifecycle)

```bash
# Step 1: Create database
notion db create --title "Task Tracker" --parent <page-id> \
  --prop "Name:title" \
  --prop "Status:select=Backlog,Todo,In Progress,Done" \
  --prop "Priority:select=High,Medium,Low" \
  --prop "Assignee:rich_text" \
  --prop "Due:date"
# → Extract database_id and data_source_id (collection://...) from response

# Step 2: Create view (both database_id and data_source_id required)
notion view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All Tasks"}'
# → Extract view_url (view://...) from response

# Step 3: Add tasks
notion page create --parent collection://<ds-id> --title "Implement feature" --prop "Status=Todo" --prop "Priority=High"

# Step 4: Query (view URL required)
notion db query "<view-url>"
```

### 4. Information Lookup

```bash
# Workspace search
notion search "weekly review" --json

# Get page content
notion fetch <page-id> --json

# List database entries
notion db query "<view-url>" --json

# Check comments
notion comment list <page-id> --json
```

### 5. Organize Content

```bash
# Move page to a different parent
notion page move <page-id> --to <new-parent-id>

# Bulk move multiple pages
notion page move <id1> <id2> <id3> --to <parent-id>

# Duplicate a page
notion page duplicate <page-id>
```

## Important Notes

1. **`page update` has separate operations for properties and content**
   - `--prop`/`--title` and `--body` cannot be used together
   - Properties: `notion page update <id> --prop "K=V"`
   - Content: `notion page update <id> --body "..."`

2. **`db query` requires a view URL** (not a DB URL/ID)
   - Check `notion fetch <db-id>` for existing view URLs
   - If none exist, create one with `notion view create`

3. **`view create` requires both `database_id` AND `data_source_id`**
   - Get both from `notion fetch <db-id>`

4. **Adding pages to a DB requires `collection://` prefixed data_source_id as `--parent`**
   - Example: `--parent collection://<ds-id>`

5. **`--data` overrides all flags with direct JSON** — use for complex operations

6. **Follow error Hints** — the CLI returns structured errors (What + Why + Hint) where Hint guides the next action

7. **`notion api <tool> '{json}'` calls any MCP tool directly** — escape hatch for operations not covered by CLI commands
