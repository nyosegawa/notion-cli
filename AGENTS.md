# notion-cli

Remote Notion MCP (`https://mcp.notion.com/mcp`) の CLI ラッパー。

## Commands

```bash
npm run build && npm run typecheck && npm run lint && npm test
```

## Structure

- `docs/` — 設計 (architecture, commands, auth, design-decisions, agent-first-design)
- `docs/agent-first-design.md` — Agent-first CLI 設計思想 (出力・ディスカバリ・エラーの設計原則)
- `research/` — 調査結果 (事実のみ)
- `skills/` — Agent Skills (`skills/notion/` — notion-cli 活用スキル)
- `PHASE.md` — フェーズ計画 (チェックボックスで進捗追跡)

## Phase Workflow

`PHASE-N` 指定時:
1. `PHASE.md` 読み → 未完了項目確認 (前フェーズの備考も必読)
2. `docs/commands.md` で CLI 仕様確認
3. `research/01-notion-remote-mcp-tools.md` で MCP ツールの実際の inputSchema を確認 (引数名はここが正)
4. 既存コマンド (`src/commands/search.ts` 等) のパターンを踏襲:
   - `buildXxxCall()` 純粋関数で CLI→MCP 引数マッピング
   - `withConnection()` ヘルパーで接続ボイラープレート
   - `printOutput()` + `cmd.optsWithGlobals()` で `--json`/`--raw` 対応
   - `--data` フラグで JSON 直接指定 (他フラグを上書き)
5. テスト先行 → 実装 → `npm run build && npm run typecheck && npm run lint && npm test` 通過
6. 完了項目を `[x]` に更新、全完了でフェーズ見出しに ✅
7. 変更を commit & push (コミットメッセージは変更内容を要約)

## Rules

- `biome.json` を編集しない
- `--no-verify` を使わない
- テストを書いてから実装 (テストが仕様)
- `notion api` escape hatch を常に維持
- エラーは `CliError` (What + Why + Hint パターン)。プロダクションコードで `new Error()` は使わない
- 出力は `--json` / `--raw` 対応必須。デフォルトは JSON テキストを pretty-print
- MCP の `isError` レスポンスは `CliError` に変換 (agent-recoverable なヒント付き)
- `--data` の JSON パースエラーは `parseJsonData()` ヘルパー経由で CliError に統一
- MCP ツール引数名は公式ドキュメントではなく `research/01-notion-remote-mcp-tools.md` の inputSchema が正
- MCP ツール名を CLI のインターフェースとして露出しない（`notion api` の escape hatch のみ）
- 設計原則の詳細は `docs/agent-first-design.md` を参照

## Testing

- `vitest` (`src/**/*.test.ts`)、引数パース・マッピング優先
- MCP 接続はモック (E2E は PHASE-5)

## Harness

- PostToolUse: `biome check --fix` 自動実行
- PreToolUse: `biome.json` / `.claude/settings.json` 編集ブロック
- Lefthook: pre-commit で lint + test
