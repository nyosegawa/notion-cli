# ncli

[![npm version](https://img.shields.io/npm/v/@sakasegawa/ncli)](https://www.npmjs.com/package/@sakasegawa/ncli)
[![license](https://img.shields.io/npm/l/@sakasegawa/ncli)](./LICENSE)
[![node](https://img.shields.io/node/v/@sakasegawa/ncli)](https://nodejs.org/)

> **Disclaimer:** ncli is an unofficial, community-built tool. It is not developed, endorsed, or supported by Notion Labs, Inc.

**[日本語](./README.ja.md)**

CLI for Notion — MCP + REST API support. Read and write Notion from the terminal.

Designed for both humans and coding agents (Claude Code, Codex, etc.). All output is structured JSON with recovery hints on errors.

## Features

- Full Notion workspace access: search, pages, databases, views, comments, users, teams, meeting notes
- REST API direct access: `ncli rest` for arbitrary Notion API calls
- File upload: `ncli file upload` for attaching files to pages
- Dual auth: OAuth (MCP commands) + integration token (`NOTION_API_KEY` env var or `ncli rest login`)
- OAuth 2.0 + PKCE authentication (browser-based, zero-config)
- Agent-first design: `--json` output, structured error hints (What + Why + Hint)
- Escape hatch: `ncli api <tool> [json]` for direct MCP tool access
- Single bundled ESM binary, Node.js >= 18

## Install

```bash
npm install -g @sakasegawa/ncli
```

## Quick Start

```bash
# Authenticate (opens browser, one-time)
ncli login

# Search and fetch
ncli search "project plan"
ncli fetch <id>

# Create and update pages
ncli page create --title "New Page" --parent <page-id>
ncli page update <id> --prop "Status=Done"

# Database workflow
ncli db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"
ncli page create --parent collection://<ds-id> \
  --title "Task 1" --prop "Status=Open"
```

### REST API

```bash
# REST API setup (integration token)
ncli rest login

# Call REST API directly
ncli rest GET /users/me
ncli rest GET /pages/<page-id>

# Upload a file
ncli file upload ./image.png
```

## Commands

| Command | Description |
|---|---|
| `ncli login` | Log in to Notion via OAuth |
| `ncli logout` | Log out from Notion |
| `ncli whoami` | Show current Notion user info |
| `ncli search <query>` | Search pages, databases, and users across workspace |
| `ncli fetch <url-or-id>` | Retrieve a page, database, or data source by URL or ID |
| `ncli page create` | Create a page (with `--title`, `--parent`, `--prop`, `--body`) |
| `ncli page update <id>` | Update page properties or content |
| `ncli page move <id...> --to <parent>` | Move pages to a new parent |
| `ncli page duplicate <id>` | Duplicate a page |
| `ncli db create` | Create a database (with `--title`, `--parent`, `--prop`, or `--schema`) |
| `ncli db update <id>` | Update database schema or metadata |
| `ncli db query <view-url>` | Query a database view |
| `ncli view create` | Create a database view (via `--data`) |
| `ncli view update` | Update a database view (via `--data`) |
| `ncli comment create <id>` | Add a comment to a page |
| `ncli comment list <id>` | List comments on a page |
| `ncli user list` | List and search workspace users |
| `ncli team list` | List and search workspace teams |
| `ncli meeting-notes query` | Query meeting notes with filters |
| `ncli rest login` | Save REST API integration token |
| `ncli rest logout` | Remove saved REST API token |
| `ncli rest <METHOD> <path> [json]` | Call any Notion REST API endpoint directly |
| `ncli file upload <file-path>` | Upload a file (returns file_upload_id for attaching to pages) |
| `ncli api <tool> [json]` | Call any MCP tool directly (escape hatch) |

Run `ncli <command> --help` for detailed usage, examples, and tips.

## Common Workflows

### Search, fetch, and update

```bash
ncli search "Project Plan"               # Find pages/databases
ncli fetch <id>                           # Get content and metadata
ncli page update <id> --prop "Status=Done"  # Update properties
```

### Create a database and add entries

```bash
# Create a database under a page
ncli db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# Response includes data_source_id (collection://...)
# Create entries using that ID
ncli page create --parent collection://<ds-id> \
  --title "Task 1" --prop "Status=Open"

# Create a view and query
ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'
ncli db query "https://www.notion.so/<db-id>?v=<view-id>"
```

### Pipe content from stdin

```bash
echo "# Meeting Notes" | ncli page create --title "Notes" --parent <id> --body -
```

## Global Flags

| Flag | Description |
|---|---|
| `--json` | Output as JSON (structured, parseable) |
| `--raw` | Output raw MCP response (full server payload) |
| `--verbose` | Verbose output |
| `--no-color` | Disable colors |

## Agent Usage

This CLI is optimized for coding agents. Key patterns:

- **Use `--json`** for structured, parseable output
- **Errors include recovery hints**: What happened, Why, and what to do next
- **Workflow**: `search` → `fetch` (get IDs/schema) → `create`/`update`/`query`
- **For databases**: always `ncli fetch <db-id>` first to get `data_source_id`

Error example:
```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --data with "parent":{"data_source_id":"<ds-id>",...}.
        Run "ncli fetch <db-id>" to get the data_source_id
```

## Escape Hatch

For advanced use or unsupported operations, call any MCP tool directly:

```bash
ncli api notion-search '{"query":"test","page_size":3}'
echo '{"query":"test"}' | ncli api notion-search
```

## Requirements

- Node.js >= 18
- A Notion account (OAuth authentication via browser)
- Notion integration token (for REST API commands — get at https://www.notion.so/profile/integrations)

## Legal

- [Terms of Use](TERMS.md)
- [Privacy Policy](PRIVACY.md)

## License

MIT
