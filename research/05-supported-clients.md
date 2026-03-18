# Notion MCP 対応クライアント・接続方式

## 対応クライアント一覧

| クライアント | 接続方式 | 備考 |
|---|---|---|
| Claude Code | `claude mcp add --transport http notion https://mcp.notion.com/mcp` | `--scope local` (default), `project`, `user` |
| Cursor | Settings > MCP > URL: `https://mcp.notion.com/mcp` | |
| VS Code | `.vscode/mcp.json` で `type: "http"` 指定 | GitHub Copilot |
| Claude Desktop | Settings > Connectors > URL: `https://mcp.notion.com/mcp` | **Pro/Max/Team/Enterprise のみ** |
| Windsurf | `mcp_config.json` で `serverUrl` 指定 | |
| ChatGPT | Settings > Connectors > URL: `https://mcp.notion.com/mcp` | |
| Codex | `~/.codex/config.toml` + `codex mcp login notion` | |
| Antigravity | `mcp_config.json` で `url` 指定 | |

> Source: https://developers.notion.com/guides/mcp/common-mcp-clients.md

## STDIO 非対応クライアント向けブリッジ

Remote MCP 非対応のクライアントには `mcp-remote` を使用:

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.notion.com/mcp"]
    }
  }
}
```

> Source: https://developers.notion.com/guides/mcp/common-mcp-clients.md

## Notion App 内からの接続

Settings > Connections > Notion MCP > AI ツールを選択

> Source: https://developers.notion.com/guides/mcp/common-mcp-clients.md

## Claude Code Notion Plugin

`makenotion/claude-code-notion-plugin` — Claude Code 向けのプラグイン。

> Source: https://github.com/makenotion/claude-code-notion-plugin
