# ID Discovery and Threading Patterns

Most notion-cli workflows require extracting IDs from one command's output and passing them to the next. This reference documents the exact patterns.

## ID Types

| ID | Format | How to obtain | Used by |
|---|---|---|---|
| page_id | `abc123-def456` | `search` results, `fetch` response | page update/move/duplicate, comment, parent for page create |
| database_id | `abc123-def456` | `fetch <db>` response, `db create` response | view create |
| data_source_id | `collection://ds-xxx` | `fetch <db>` response, `db create` response | page create (as parent), view create, db update |
| view_url | `view://view-xxx` or full Notion URL with `?v=` | `fetch <db>` response, `view create` response | db query |

## Extracting IDs from `notion fetch`

When fetching a database page:

```bash
notion fetch <db-id> --json
```

The response `text` field contains XML-like markup:

```
<database url="https://www.notion.so/<database_id>">
  <data-source url="collection://<data_source_id>">
    ...
    <view name="All" url="view://<view_id>" type="table">
    ...
  </data-source>
</database>
```

**Extract:**
- `database_id` from the `<database url="...">` attribute (the UUID in the URL)
- `data_source_id` from the `<data-source url="collection://...">` attribute
- `view_url` from the `<view ... url="view://...">` attribute (if views exist)

## Extracting IDs from `notion db create`

```bash
notion db create --title "Tasks" --parent <page-id> --prop "Name:title"
```

Response text:
```
Created database: <database url="https://www.notion.so/<db-id>">...<data-source url="collection://<ds-id>">...</data-source></database>
```

**Extract:**
- `database_id` from the database URL
- `data_source_id` from `collection://...`

## Extracting view_url from `notion view create`

```bash
notion view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'
```

Response text:
```
Created view "All" (table) — view://<view-id>
```

**Extract:** The `view://<view-id>` string. Use it directly in `notion db query`.

## Parent Specification Rules

When using `--parent` flag in `page create` or `--to` in `page move`:

| Input | Resolved as |
|---|---|
| `collection://ds-xxx` | `{ data_source_id: "ds-xxx", type: "data_source_id" }` — for adding pages to a DB |
| `abc123-def456` | `{ page_id: "abc123-def456", type: "page_id" }` — for adding pages under a page |
| `workspace` (move only) | `{ type: "workspace" }` — move to workspace top level |

## Complete Workflow Example: DB Creation to Query

```bash
# 1. Create database
notion db create --title "Sprint Tasks" --parent <page-id> \
  --prop "Name:title" \
  --prop "Status:select=Backlog,Todo,In Progress,Done" \
  --prop "Priority:select=High,Medium,Low" --json

# 2. Extract IDs from response
# → database_id: "abc123..."
# → data_source_id: "collection://ds-xxx"

# 3. Create a view (both IDs required)
notion view create --data '{"database_id":"abc123...","data_source_id":"collection://ds-xxx","type":"table","name":"All Tasks"}' --json

# 4. Extract view URL from response
# → view_url: "view://view-yyy"

# 5. Add pages to DB (use data_source_id as parent)
notion page create --parent collection://ds-xxx --title "Task 1" --prop "Status=Todo" --prop "Priority=High"
notion page create --parent collection://ds-xxx --title "Task 2" --prop "Status=Backlog" --prop "Priority=Medium"

# 6. Query the database (use view URL)
notion db query "view://view-yyy" --json
```

## Common Mistakes

| Mistake | Fix |
|---|---|
| Using DB URL/ID for `db query` | Use view URL instead. Get it from `notion fetch <db-id>` or `notion view create` |
| Using DB ID as parent for `page create` | Use `collection://<data_source_id>` as parent |
| Omitting `database_id` in `view create` | Both `database_id` AND `data_source_id` are required |
| Missing `collection://` prefix | `data_source_id` must include the `collection://` prefix when used as `--parent` |
