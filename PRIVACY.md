# Privacy Policy

**ncli** -- an unofficial CLI wrapper for Notion's Remote MCP server

Effective date: 2026-03-19

## What ncli Collects

ncli stores the following data **locally on your machine only**:

| Item | Purpose |
|------|---------|
| `access_token` | Authenticate API requests to Notion |
| `refresh_token` | Obtain a new access token when the current one expires |
| `client_id` | Identify the OAuth application |
| `code_verifier` | Complete the OAuth 2.0 PKCE flow |

No other data is collected, generated, or stored by ncli.

## Storage Location

Tokens are written to a file with permissions `0o600` (owner read/write only) in the OS-appropriate config directory:

| OS | Path |
|----|------|
| macOS | `~/Library/Preferences/ncli/` |
| Linux | `~/.config/ncli/` |

## What ncli Does NOT Collect

- No telemetry or usage analytics
- No Notion page content, database content, or workspace metadata
- No cookies or browser storage
- No tracking identifiers
- No crash reports

## Data Flow

All network communication occurs directly between your machine and Notion's official MCP endpoint:

```
your machine  <──────>  https://mcp.notion.com/mcp
```

There is no intermediary server. ncli does not proxy, intercept, or log any request or response data.

## Third Parties

ncli does not send data to any third party. The only external service ncli communicates with is Notion's MCP endpoint at `https://mcp.notion.com/mcp`.

## How to Delete Your Data

Run the following command to remove all locally stored tokens:

```
ncli logout
```

You may also delete the config directory manually at the paths listed above.

## Changes to This Policy

This policy may be updated from time to time. Changes will be reflected in this file with an updated effective date.
