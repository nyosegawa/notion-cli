# Architecture

## 概要

`ncli` は Remote Notion MCP (`https://mcp.notion.com/mcp`) のツールを CLI でラップする。
ツール数はプランにより変動する（個人プランで16ツール実測、Enterprise で追加ツールあり）。
MCP SDK の Client + StreamableHTTPClientTransport を使い、OAuth 2.0 + PKCE で認証する。

## ファイル構造

```
src/
├── index.ts                  # エントリポイント (#!/usr/bin/env node)
├── cli.ts                    # Commander セットアップ、グローバルフラグ (--json, --raw, --verbose, --no-color)
├── commands/
│   ├── login.ts              # login / logout / whoami ✅
│   ├── search.ts             # ncli search ✅
│   ├── fetch.ts              # ncli fetch ✅
│   ├── page.ts               # page {create,update,move,duplicate} ✅
│   ├── db.ts                 # db {create,update,query} ✅
│   ├── view.ts               # view {create,update} ✅
│   ├── comment.ts            # comment {create,list} ✅
│   ├── user.ts               # user list + team list ✅
│   ├── meeting-notes.ts      # meeting-notes query ✅
│   └── api.ts                # ncli api <tool> [json] (escape hatch) ✅
├── mcp/
│   ├── client.ts             # MCPConnection: connect, callTool, listTools, disconnect + MCP エラー→CliError 変換 ✅
│   └── with-connection.ts    # withConnection ヘルパー (connect/callTool/disconnect + retry) ✅
├── auth/
│   ├── provider.ts           # OAuthClientProvider 実装 ✅
│   ├── token-store.ts        # ファイルベーストークン永続化 ✅
│   └── callback-server.ts    # OAuth リダイレクト受信 HTTP サーバー ✅
├── output/
│   └── json.ts               # extractText, formatOutput, printOutput (--json / --raw / pretty-print) ✅
└── util/
    ├── config.ts             # env-paths、定数 ✅
    ├── errors.ts             # CliError (What+Why+Hint)、formatError、parseJsonData、withRetry ✅
    ├── props.ts              # --prop Key=Value パーサー ✅
    ├── db-props.ts           # --prop Name:type=opts → SQL DDL 変換 ✅
    └── stdin.ts              # --body - (stdin) 読み取り ✅
```

> ✅ = 実装済み

## 技術スタック

| 依存 | 用途 | サイズ |
|---|---|---|
| `@modelcontextprotocol/sdk` | MCP Client, Transport, OAuth | ~4.2 MB |
| `commander` | CLI フレームワーク | ~180 KB |
| `open` | ブラウザで OAuth URL を開く | ~50 KB |
| `env-paths` | OS 適切な設定パス | ~5 KB |

Dev: `typescript`, `@types/node`, `tsup`, `vitest`, `@biomejs/biome`, `lefthook`

## 接続方式

**Connect-per-command**: 各 CLI 呼び出しで MCP 接続を開き、コマンド実行後に閉じる。

- CLI は単一プロセスなのでデーモン不要
- ~500ms のオーバーヘッドは CLI 利用に許容範囲
- セッション管理の複雑さを回避

## パッケージ情報

- npm: `ncli`
- bin: `ncli`
- Node.js: >= 18 (native fetch, crypto.subtle, ESM)
- Module: ESM (`"type": "module"`)
