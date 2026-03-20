# End User Terms of Use

**ncli** -- an unofficial CLI wrapper for Notion's Remote MCP server

Effective date: 2026-03-19

## 1. Unofficial Tool Disclaimer

ncli is an independent, open-source project. It is **not** affiliated with, endorsed by, or sponsored by Notion Labs, Inc. "Notion" is a trademark of Notion Labs, Inc.

## 2. Notion Terms of Service

Your use of Notion's services through ncli remains subject to Notion's own Terms of Service (<https://www.notion.so/terms>). You are responsible for reviewing and complying with those terms. ncli does not modify, extend, or override any obligation you have under Notion's terms.

## 3. Authentication and Token Storage

ncli authenticates with Notion via OAuth 2.0 with PKCE through your web browser. The resulting tokens (access token and refresh token) are stored **locally on your machine only**, in your OS config directory with file permissions restricted to your user account (0o600). ncli does not transmit tokens to any server other than Notion's official MCP endpoint at `https://mcp.notion.com/mcp`.

For REST API commands (`ncli rest`, `ncli file`), ncli uses a Notion integration token (Bearer token). This token can be provided via the `NOTION_API_KEY` environment variable or stored locally by running `ncli rest login`. Stored tokens are saved in the same config directory with restricted permissions (0o600).

You can delete all locally stored tokens at any time by running:

```
ncli logout          # Remove OAuth tokens (MCP)
ncli rest logout     # Remove REST API integration token
```

## 4. Data Handling

ncli does **not** cache, store, index, or retain any Notion content. All data flows directly between your machine and Notion's servers at `https://mcp.notion.com/mcp` (MCP commands) and `https://api.notion.com/v1` (REST API commands). There is no intermediary server.

## 5. User Responsibility

You are solely responsible for the actions you perform through ncli, including any modifications to your Notion workspace. ncli executes commands on your behalf using the permissions granted through your OAuth token.

## 6. No Warranty

ncli is provided under the MIT License (see [LICENSE](./LICENSE)).

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. The full limitation of liability is set out in the LICENSE file. Use ncli at your own risk.

## 7. Changes to These Terms

These terms may be updated from time to time. Changes will be reflected in this file with an updated effective date.
