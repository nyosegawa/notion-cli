# @sakasegawa/notion-cli

[![npm version](https://img.shields.io/npm/v/@sakasegawa/notion-cli)](https://www.npmjs.com/package/@sakasegawa/notion-cli)
[![license](https://img.shields.io/npm/l/@sakasegawa/notion-cli)](./LICENSE)
[![node](https://img.shields.io/node/v/@sakasegawa/notion-cli)](https://nodejs.org/)

**[日本語](./README.ja.md)**

CLI wrapper for [Remote Notion MCP](https://mcp.notion.com/mcp) — read and write Notion from the terminal.

Designed for both humans and coding agents (Claude Code, Codex, etc.). All output is structured JSON with recovery hints on errors.

## Features

- Full Notion workspace access: search, pages, databases, views, comments, users, teams, meeting notes
- OAuth 2.0 + PKCE authentication (browser-based, zero-config)
- Agent-first design: `--json` output, structured error hints (What + Why + Hint)
- Escape hatch: `notion api <tool> [json]` for direct MCP tool access
- Single bundled ESM binary, Node.js >= 18

## Install

```bash
npm install -g @sakasegawa/notion-cli
```

## Quick Start

```bash
# Authenticate (opens browser, one-time)
notion login

# Search and fetch
notion search "project plan"
notion fetch <id>

# Create and update pages
notion page create --title "New Page" --parent <page-id>
notion page update <id> --prop "Status=Done"

# Database workflow
notion db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"
notion page create --parent collection://<ds-id> \
  --title "Task 1" --prop "Status=Open"
```

## Commands

| Command | Description |
|---|---|
| `notion login` | Log in to Notion via OAuth |
| `notion logout` | Log out from Notion |
| `notion whoami` | Show current Notion user info |
| `notion search <query>` | Search pages, databases, and users across workspace |
| `notion fetch <url-or-id>` | Retrieve a page, database, or data source by URL or ID |
| `notion page create` | Create a page (with `--title`, `--parent`, `--prop`, `--body`) |
| `notion page update <id>` | Update page properties or content |
| `notion page move <id...> --to <parent>` | Move pages to a new parent |
| `notion page duplicate <id>` | Duplicate a page |
| `notion db create` | Create a database (with `--title`, `--parent`, `--prop`, or `--schema`) |
| `notion db update <id>` | Update database schema or metadata |
| `notion db query <view-url>` | Query a database view |
| `notion view create` | Create a database view (via `--data`) |
| `notion view update` | Update a database view (via `--data`) |
| `notion comment create <id>` | Add a comment to a page |
| `notion comment list <id>` | List comments on a page |
| `notion user list` | List and search workspace users |
| `notion team list` | List and search workspace teams |
| `notion meeting-notes query` | Query meeting notes with filters |
| `notion api <tool> [json]` | Call any MCP tool directly (escape hatch) |

Run `notion <command> --help` for detailed usage, examples, and tips.

## Common Workflows

### Search, fetch, and update

```bash
notion search "Project Plan"               # Find pages/databases
notion fetch <id>                           # Get content and metadata
notion page update <id> --prop "Status=Done"  # Update properties
```

### Create a database and add entries

```bash
# Create a database under a page
notion db create --title "Tasks" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# Response includes data_source_id (collection://...)
# Create entries using that ID
notion page create --parent collection://<ds-id> \
  --title "Task 1" --prop "Status=Open"

# Create a view and query
notion view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'
notion db query "https://www.notion.so/<db-id>?v=<view-id>"
```

### Pipe content from stdin

```bash
echo "# Meeting Notes" | notion page create --title "Notes" --parent <id> --body -
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
- **For databases**: always `notion fetch <db-id>` first to get `data_source_id`

Error example:
```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --data with "parent":{"data_source_id":"<ds-id>",...}.
        Run "notion fetch <db-id>" to get the data_source_id
```

## Escape Hatch

For advanced use or unsupported operations, call any MCP tool directly:

```bash
notion api notion-search '{"query":"test","page_size":3}'
echo '{"query":"test"}' | notion api notion-search
```

## Requirements

- Node.js >= 18
- A Notion account (OAuth authentication via browser)

## License

MIT
