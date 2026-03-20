---
name: notion
description: >
  Operate Notion workspaces via ncli (MCP + REST API).
  Covers page search/create/update, database create/query, view management, comments, file upload, and direct REST API access.
  Use when user asks to "Notion に書いて", "ページ作って", "タスク管理", "DB 作成",
  "Notion で検索", "議事録", "ファイルアップロード", "create a Notion page", "track tasks in Notion",
  "upload file to Notion", or any Notion workspace operation. Also triggers on "notion" keyword in requests.
compatibility: Requires ncli installed and authenticated (ncli login for MCP, ncli rest login for REST API). Claude Code only.
metadata:
  author: sakasegawa
  version: 2.0.0
---

# Notion CLI Skill

Operate Notion workspaces using ncli. Two backends:
- **MCP** (OAuth) — search, pages, databases, views, comments, users, teams
- **REST API** (integration token) — file upload, block operations, any REST endpoint

## Prerequisites

```bash
# MCP auth (required for most commands)
ncli whoami                    # Check auth status
ncli login                     # If not authenticated

# REST API auth (required for ncli rest / ncli file commands)
ncli rest login                # Save integration token (one-time)
```

REST API requires integration access to target pages:
  Go to https://www.notion.so/profile/integrations/internal
  → select your integration → Content access → add pages.

## Core Pattern: Search → Fetch → Act

1. **Search** — `ncli search "<query>" --json` to find pages/databases
2. **Fetch** — `ncli fetch <id> --json` to get details and extract IDs
3. **Act** — Use the extracted IDs to create/update/query

See `references/id-patterns.md` for ID extraction patterns.

## Key Commands

### MCP Commands (OAuth)

| Command | Description |
|---|---|
| `ncli search "<query>"` | Search pages/databases |
| `ncli fetch <url-or-id>` | Get page/database content |
| `ncli page create --title "T" --parent <id>` | Create page |
| `ncli page update <id> --prop "Key=Value"` | Update properties |
| `ncli page update <id> --body "content"` | Replace content |
| `ncli page move <id> --to <parent-id>` | Move page |
| `ncli page duplicate <id>` | Duplicate page |
| `ncli db create --title "T" --parent <id> --prop "Name:title"` | Create database |
| `ncli db query "<view-url>"` | Query database (view URL required) |
| `ncli comment create <page-id> --body "text"` | Add comment |
| `ncli api <tool> '{json}'` | Call any MCP tool directly |

### REST API Commands (Integration Token)

| Command | Description |
|---|---|
| `ncli file upload <file-path>` | Upload file (returns file_upload_id) |
| `ncli rest GET <path>` | GET request |
| `ncli rest POST <path> '{json}'` | POST request |
| `ncli rest PATCH <path> '{json}'` | PATCH request |
| `ncli rest DELETE <path>` | DELETE request |

See `references/command-reference.md` for full arguments and examples.

### Global Flags

- `--json` — Structured JSON output (always use for programmatic access)
- `--raw` — Raw response
- `--data '{json}'` — Override all flags with direct JSON input

## Common Workflows

### 1. Search, Fetch, and Update

```bash
ncli search "project plan" --json       # → results[].id
ncli fetch <page-id> --json             # → content
ncli page update <page-id> --prop "Status=Done"
```

### 2. Database Lifecycle

```bash
# Create DB → extract data_source_id (collection://...) from response
ncli db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# Create view → extract view_url
ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'

# Add entries
ncli page create --parent collection://<ds-id> --title "Task 1" --prop "Status=Open"

# Query
ncli db query "<view-url>"
```

### 3. File Upload (REST API)

```bash
# Step 1: Upload file → returns file_upload_id + attach hint
ncli file upload ./screenshot.png

# Step 2: Fetch page to find block IDs (MCP or REST)
ncli fetch <page-id> --json
# Or: ncli rest GET /blocks/<page-id>/children

# Step 3: Attach to page (append to end)
ncli rest PATCH /blocks/<page-id>/children '{"children":[{"type":"file","file":{"type":"file_upload","file_upload":{"id":"<file_upload_id>"},"name":"screenshot.png"}}]}'

# Or: Insert after a specific block
ncli rest PATCH /blocks/<page-id>/children '{"position":{"type":"after_block","after_block":{"id":"<block-id>"}},"children":[...]}'
```

### 4. Direct REST API Access

```bash
ncli rest GET /users/me                 # Verify auth
ncli rest GET /pages/<page-id>          # Get page
ncli rest POST /search '{"query":"x"}'  # Search
ncli rest PATCH /blocks/<id>/children '{"children":[...]}' # Add blocks
```

## Important Notes

1. **`page update`: properties and content are separate commands** — `--prop`/`--title` and `--body` cannot be combined
2. **`db query` requires a view URL** — run `ncli fetch <db-id>` to get it, or create one with `ncli view create`
3. **`view create` requires both `database_id` AND `data_source_id`** — get both from `ncli fetch <db-id>`
4. **DB page parent uses `collection://` prefix** — `--parent collection://<ds-id>`
5. **`ncli file upload` returns file_upload_id** — attach to page via `ncli rest PATCH` (the command prints the exact attach command)
6. **REST API requires separate auth from MCP** — `ncli rest login` or `NOTION_API_KEY` env var
7. **REST API requires page access** — add pages via integration settings at https://www.notion.so/profile/integrations/internal
8. **Errors include recovery hints** — follow the Hint to self-recover

## Troubleshooting

### MCP auth failed
```
Error: Not connected to Notion
```
Run `ncli login` to authenticate via browser.

### REST API: No token
```
Error: No REST API token configured
  Hint: Set NOTION_API_KEY env var, or run "ncli rest login"
```
Run `ncli rest login` or set `NOTION_API_KEY`.

### REST API: Empty search results
```
Note: No results found. If you expected results, ensure your integration has access to pages.
```
Go to https://www.notion.so/profile/integrations/internal → select integration → Content access → add pages.

### REST API: 404 on page access
```
Error: REST API resource not found
  Hint: The integration may not have access to this page.
```
The integration needs explicit access to the page. Add it via integration settings, or use MCP commands which have workspace-wide OAuth access.

### File upload: attach fails
If `ncli file upload` succeeds but `ncli rest PATCH` to attach fails with 404, the integration doesn't have access to the target page. Add access via integration settings.
