---
name: notion
description: >
  Operate Notion workspaces via ncli.
  Covers page search/create/update, database create/query, view management, comments, and more.
  Use when user asks to "Notion に書いて", "ページ作って", "タスク管理", "DB 作成",
  "Notion で検索", "議事録", "create a Notion page", "track tasks in Notion",
  or any Notion workspace operation. Also triggers on "notion" keyword in requests.
compatibility: Requires ncli installed and authenticated (ncli login). Claude Code only.
metadata:
  author: sakasegawa
  version: 1.0.0
---

# Notion CLI Skill

Guide for operating Notion workspaces using ncli.

## Prerequisites

Verify authentication before any operation:

```bash
ncli whoami
```

If this fails, run `ncli login` to complete OAuth authentication in the browser.

## Core Pattern: Search → Fetch → Act

Almost every workflow follows these three steps:

1. **Search** — `ncli search "<query>" --json` to find pages/databases
2. **Fetch** — `ncli fetch <id> --json` to get details and extract IDs
3. **Act** — Use the extracted IDs to create/update/query

### ID Types

| ID | Format | Purpose |
|---|---|---|
| page_id | `abc123-def456` | Target for page operations, parent for page create |
| database_id | `abc123-def456` | Required for view create |
| data_source_id | `collection://ds-xxx` | Parent for adding pages to DB, view create, db update |
| view_url | `view://view-xxx` or `https://...?v=xxx` | Target for db query |

`ncli fetch <db-id>` response contains `data_source_id` and `view_url`.
See `references/id-patterns.md` for detailed extraction patterns.

## Command Quick Reference

### Authentication
| Command | Description |
|---|---|
| `ncli login` | OAuth login |
| `nclilogout` | Log out |
| `ncli whoami` | Show current user |

### Search & Fetch
| Command | Description |
|---|---|
| `ncli search "<query>"` | Search pages/databases |
| `ncli fetch <url-or-id>` | Get page/database content |

### Page Operations
| Command | Description |
|---|---|
| `nclipage create --title "T" --parent <id>` | Create page |
| `nclipage update <id> --prop "Key=Value"` | Update properties |
| `nclipage update <id> --body "content"` | Replace content |
| `nclipage move <id> --to <parent-id>` | Move page |
| `nclipage duplicate <id>` | Duplicate page |

### Database Operations
| Command | Description |
|---|---|
| `nclidb create --title "T" --parent <page-id> --prop "Name:title" --prop "Status:select=A,B"` | Create database |
| `nclidb update <ds-id> --statements 'ADD COLUMN "Col" TYPE'` | Alter schema |
| `nclidb query "<view-url>"` | Query database (view URL required) |

### Views, Comments & More
| Command | Description |
|---|---|
| `ncliview create --data '{...}'` | Create view (JSON required) |
| `ncliview update --data '{...}'` | Update view |
| `nclicomment create <page-id> --body "text"` | Add comment |
| `nclicomment list <page-id>` | List comments |
| `ncliuser list` | List users |
| `ncliteam list` | List teams |
| `nclimeeting-notes query` | Query meeting notes |
| `ncliapi <tool> '{json}'` | Call any MCP tool directly (escape hatch) |

See `references/command-reference.md` for detailed arguments and output examples.

### Global Flags

- `--json` — Structured JSON output (always use this for programmatic access)
- `--raw` — Raw MCP response
- `--data '{json}'` — Override all flags with direct JSON input

## Common Workflows

### 1. Search, Fetch, and Update a Page

```bash
# Search
ncli search "project plan" --json
# → Pick page_id from results[].id

# View content
ncli fetch <page-id> --json

# Update properties
ncli page update <page-id> --prop "Status=Done"

# Update content (separate command from properties)
ncli page update <page-id> --body "# Updated content"
```

### 2. Create New Pages

```bash
# Create under a parent page
ncli page create --title "Meeting Notes 3/18" --parent <page-id> --body "# Agenda\n- Status update"

# Pipe long content via stdin
echo "# Long document..." | ncli page create --title "Document" --parent <page-id> --body -

# Create in a database (requires data_source_id)
ncli page create --parent collection://<ds-id> --title "Task 1" --prop "Status=Open" --prop "Priority=High"
```

### 3. Database Creation to Query (Full Lifecycle)

```bash
# Step 1: Create database
ncli db create --title "Task Tracker" --parent <page-id> \
  --prop "Name:title" \
  --prop "Status:select=Backlog,Todo,In Progress,Done" \
  --prop "Priority:select=High,Medium,Low" \
  --prop "Assignee:rich_text" \
  --prop "Due:date"
# → Extract database_id and data_source_id (collection://...) from response

# Step 2: Create view (both database_id and data_source_id required)
ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All Tasks"}'
# → Extract view_url (view://...) from response

# Step 3: Add tasks
ncli page create --parent collection://<ds-id> --title "Implement feature" --prop "Status=Todo" --prop "Priority=High"

# Step 4: Query (view URL required)
ncli db query "<view-url>"
```

### 4. Information Lookup

```bash
# Workspace search
ncli search "weekly review" --json

# Get page content
ncli fetch <page-id> --json

# List database entries
ncli db query "<view-url>" --json

# Check comments
ncli comment list <page-id> --json
```

### 5. Organize Content

```bash
# Move page to a different parent
ncli page move <page-id> --to <new-parent-id>

# Bulk move multiple pages
ncli page move <id1> <id2> <id3> --to <parent-id>

# Duplicate a page
ncli page duplicate <page-id>
```

## Important Notes

1. **`page update` has separate operations for properties and content**
   - `--prop`/`--title` and `--body` cannot be used together
   - Properties: `ncli page update <id> --prop "K=V"`
   - Content: `ncli page update <id> --body "..."`

2. **`db query` requires a view URL** (not a DB URL/ID)
   - Check `ncli fetch <db-id>` for existing view URLs
   - If none exist, create one with `ncli view create`

3. **`view create` requires both `database_id` AND `data_source_id`**
   - Get both from `ncli fetch <db-id>`

4. **Adding pages to a DB requires `collection://` prefixed data_source_id as `--parent`**
   - Example: `--parent collection://<ds-id>`

5. **`--data` overrides all flags with direct JSON** — use for complex operations

6. **Follow error Hints** — the CLI returns structured errors (What + Why + Hint) where Hint guides the next action

7. **`ncli api <tool> '{json}'` calls any MCP tool directly** — escape hatch for operations not covered by CLI commands
