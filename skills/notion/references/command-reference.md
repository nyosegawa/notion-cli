# Command Reference

Complete reference for all ncli commands.

## search

```bash
ncli search "<query>" [--json] [--raw]
```

Search pages and databases in the workspace.

**Output example:**
```json
{
  "results": [
    { "id": "abc123-...", "title": "Weekly Review", "type": "page", "highlight": "...", "timestamp": "2026-03-15T..." }
  ],
  "type": "workspace_search"
}
```

## fetch

```bash
ncli fetch <url-or-id> [--json] [--raw]
```

Get page or database content. Accepts Notion URLs or UUIDs.

**Output example (page):**
```json
{
  "metadata": { "type": "page" },
  "title": "Weekly Review",
  "url": "https://www.notion.so/abc123...",
  "text": "<page url=\"...\">...<content>\n# Agenda\n- Status update\n</content>\n</page>"
}
```

**When fetching a database** — the `text` field contains:
- `<database url="...">` — database_id
- `<data-source url="collection://ds-xxx">` — data_source_id
- View URLs if views exist

## page create

```bash
ncli page create --title "Title" --parent <id> [--prop "Key=Value"...] [--body "content"] [--data '{json}']
```

**Arguments:**
- `--title` — Page title
- `--parent` — Parent page ID. Use `collection://<ds-id>` for databases
- `--prop "Key=Value"` — Properties (can specify multiple)
- `--body "text"` — Body content. `--body -` for stdin
- `--data` — Direct JSON input (overrides all other flags)

**Parent auto-detection:**
- `collection://xxx` → `{ data_source_id: "xxx", type: "data_source_id" }`
- Anything else → `{ page_id: "xxx", type: "page_id" }`

**Output example:**
```json
{
  "pages": [
    { "id": "new-page-id", "url": "https://www.notion.so/...", "properties": { "title": "..." } }
  ]
}
```

## page update

```bash
# Update properties
ncli page update <page-id> --prop "Key=Value" [--title "New Title"]

# Replace content
ncli page update <page-id> --body "# New content"
```

**--prop/--title and --body cannot be used together** (different MCP commands).

**MCP command mapping:**
- `--prop`/`--title` → `command: "update_properties"`
- `--body` → `command: "replace_content"`

## page move

```bash
ncli page move <id...> --to <parent-id>
```

Move one or more pages to a different parent.

**--to auto-detection:**
- `collection://xxx` → data_source_id
- `workspace` → workspace top level
- Anything else → page_id

## page duplicate

```bash
ncli page duplicate <page-id>
```

Duplicate a page.

## db create

```bash
# Using --prop shorthand
ncli db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" \
  --prop "Status:select=Open,Done" \
  --prop "Priority:select=High,Medium,Low"

# Using --schema with SQL DDL
ncli db create --schema 'CREATE TABLE "Tasks" ("Name" TITLE, "Status" SELECT)' --parent <page-id>
```

**--prop format:** `"ColumnName:type=options"`

| Type | Example |
|---|---|
| title | `"Name:title"` |
| rich_text | `"Description:rich_text"` |
| select | `"Status:select=Open,Done"` |
| multi_select | `"Tags:multi_select=Bug,Feature"` |
| number | `"Score:number"` |
| date | `"Due:date"` |
| checkbox | `"Done:checkbox"` |
| url | `"Link:url"` |
| email | `"Contact:email"` |
| phone_number | `"Phone:phone_number"` |

**Output example:**
```
Created database: <database url="https://..."><data-source url="collection://ds-xxx">...</data-source></database>
```

Always extract `database_id` and `data_source_id` from the response.

## db update

```bash
ncli db update <data-source-id> --title "New Title" --statements 'ADD COLUMN "Priority" SELECT'
```

Requires `data_source_id` (get it from `ncli fetch <db-id>`).

## db query

```bash
ncli db query "<view-url>"
```

**Requires a view URL** — cannot query with a DB URL or ID.

How to get a view URL:
1. Check `ncli fetch <db-id>` response
2. If no views exist, create one with `ncli view create`

**Output example:**
```json
{
  "results": [
    { "Status": "Open", "Name": "Task 1", "url": "https://www.notion.so/..." }
  ],
  "has_more": false
}
```

## view create / update

```bash
# Create (both database_id and data_source_id required)
ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'

# Update
ncli view update --data '{"view_id":"<view-id>","name":"Renamed"}'
```

`--data` JSON is recommended. View types: `table`, `board`, `list`, `calendar`, `gallery`, `timeline`

**Output example:**
```
Created view "All" (table) — view://view-xxx
```

## comment create / list

```bash
ncli comment create <page-id> --body "Comment text"
ncli comment list <page-id> [--include-resolved]
```

## user list / team list

```bash
ncli user list [--query "alice"]
ncli team list [--query "engineering"]
```

## meeting-notes query

```bash
ncli meeting-notes query [--data '{"filter":{...}}']
```

Filter has complex nested structure; `--data` recommended.

## api (escape hatch)

```bash
ncli api <tool-name> '{"key":"value"}'
echo '{"query":"test"}' | ncli api notion-search
```

Use for MCP tools not covered by CLI commands or when complex arguments are needed.

## rest (REST API escape hatch)

Requires integration token: `ncli rest login` or `NOTION_API_KEY` env var.

```bash
# Authentication
ncli rest login                    # Save integration token interactively
echo "ntn_..." | ncli rest login   # Pipe token from stdin
ncli rest logout                   # Remove saved token
```

```bash
# API calls
ncli rest GET /users/me
ncli rest GET /pages/<page-id>
ncli rest POST /search '{"query":"test"}'
ncli rest PATCH /databases/<db-id> '{"title":[{"text":{"content":"New Title"}}]}'
ncli rest DELETE /blocks/<block-id>
echo '{"query":"test"}' | ncli rest POST /search
```

**Output example:**
```json
{
  "object": "user",
  "id": "abc123-...",
  "type": "person",
  "name": "Alice",
  "avatar_url": "https://..."
}
```

## file upload

Requires REST API authentication. Uploads file only — attach to page separately.

```bash
ncli file upload <file-path> [--name <display-name>]
```

**Arguments:**
- `<file-path>` — Local file path to upload
- `--name` — Optional display name for the file in Notion

**Examples:**
```bash
ncli file upload ./screenshot.png
ncli file upload ./report.pdf --name "Q1 Report"
```

**Output:** Returns file_upload_id + copy-pastable attach command.

**Full workflow:**
```bash
# 1. Upload
ncli file upload ./image.png
# → file_upload_id: "abc123..."

# 2. Find target block (optional, for specific position)
ncli fetch <page-id> --json
# Or: ncli rest GET /blocks/<page-id>/children

# 3a. Append to end of page
ncli rest PATCH /blocks/<page-id>/children '{"children":[{"type":"file","file":{"type":"file_upload","file_upload":{"id":"abc123..."},"name":"image.png"}}]}'

# 3b. Insert after specific block
ncli rest PATCH /blocks/<page-id>/children '{"position":{"type":"after_block","after_block":{"id":"<block-id>"}},"children":[{"type":"file","file":{"type":"file_upload","file_upload":{"id":"abc123..."},"name":"image.png"}}]}'
```
```

## Error Patterns and Recovery

| Error Situation | Hint |
|---|---|
| Using DB URL for db query | View URL required → `ncli fetch <db-id>` or `ncli view create` |
| Using DB ID as parent for page create | data_source_id required → `ncli fetch <db-id>` |
| data_source_id Required | Run `ncli fetch <db-id>` to find `collection://...` |
| rich_text Required | Use `--body` to specify comment content |
| Tool not found | Check `ncli --help` for available commands |
| JSON parse error | Verify `--data '{"key": "value"}'` syntax |
| --prop and --body used together | Split into separate commands |
| REST API auth failed | Set `NOTION_API_KEY` env var or run `ncli rest login` |
| REST API access denied | Check integration connection at notion.so/profile/integrations |
| File not found | Check the local file path |
