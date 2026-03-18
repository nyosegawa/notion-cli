# Implementation Phases

フェーズ ID を指定して実装を依頼する。各フェーズは自己完結。

## PHASE-1: Foundation ✅

プロジェクトスキャフォールド + harness + auth + MCP 接続。

**成果物:**
- [x] `package.json` (ESM, `@sakasegawa/notion-cli`, bin: `notion`, Node >= 18)
- [x] `tsconfig.json` (strict, ESM, outDir: dist)
- [x] `biome.json` (format + lint)
- [x] `lefthook.yml` (pre-commit: biome check + vitest run)
- [x] `.claude/settings.json` (PostToolUse hook: biome)
- [x] `src/util/config.ts` — env-paths, 定数
- [x] `src/auth/token-store.ts` — ファイルベーストークン永続化
- [x] `src/auth/callback-server.ts` — ローカル HTTP サーバー (OAuth redirect)
- [x] `src/auth/provider.ts` — OAuthClientProvider 実装
- [x] `src/mcp/client.ts` — MCPConnection (connect, callTool, listTools, disconnect)
- [x] `src/commands/login.ts` — `notion login` / `logout` / `whoami`
- [x] `src/cli.ts` — Commander ルート (login のみ登録)
- [x] `src/index.ts` — エントリポイント

**テスト:**
- [x] `src/auth/token-store.test.ts` — read/write/delete, パーミッション (16テスト)
- [x] `src/mcp/client.test.ts` — 未接続時エラー、disconnect安全性 (3テスト)

**検証:**
- [x] `npm run build` → dist/ 生成
- [x] `npm run typecheck` → エラーなし
- [x] `npm run lint` → パス
- [x] `npm test` → 全テストパス
- [x] `notion login` → ブラウザ OAuth → 認証成功
- [x] `notion whoami` → ユーザー情報表示

**備考:**
- 実測ツール数は16 (ドキュメント上は18)。`notion-get-self`, `notion-get-user` は非存在。`notion-query-meeting-notes` を新規発見。詳細は `research/01-notion-remote-mcp-tools.md` 参照。
- hooks はプロジェクトディレクトリで `claude` を起動した場合のみ有効。

---

## PHASE-2: Core Commands ✅

search, fetch, page CRUD を実装。

**成果物:**
- [x] `src/commands/search.ts` — `notion search <query>`
- [x] `src/commands/fetch.ts` — `notion fetch <url-or-id>`
- [x] `src/commands/page.ts` — `page create / update / move / duplicate`
- [x] `src/output/json.ts` — `--json` / `--raw` 出力ユーティリティ
- [x] `cli.ts` 更新 — グローバルフラグ + コマンド登録

**テスト:**
- [x] 各コマンドの引数パース → MCP ツール名・引数へのマッピング
- [x] `--prop Key=Value` パーサー
- [x] `--body -` (stdin) 処理

**検証:**
- [x] `npm run typecheck` → エラーなし
- [x] `npm run lint` → パス
- [x] `npm test` → 全テストパス
- [x] `notion search "test"` → 結果表示
- [x] `notion search "test" --json | jq .` → パース成功
- [x] `notion fetch <page-url>` → ページ内容表示
- [x] `notion page create --title "Test" --parent <id>` → ページ作成

**備考:**
- MCP ツールの引数名はドキュメント非公開。`tools/list` で実際の inputSchema を取得して実装を修正。詳細は `research/01-notion-remote-mcp-tools.md` に記録。
- `notion-create-pages` は `pages` 配列 + `parent` オブジェクト構造。`notion-update-page` は `command` フィールド必須。`notion-fetch` は `id` 引数。
- 追加ユーティリティ: `src/util/props.ts` (--prop パーサー), `src/util/stdin.ts` (stdin読み取り), `src/mcp/with-connection.ts` (接続ヘルパー)

---

## PHASE-3: Database & View Commands ✅

残りの全コマンドを実装。全16ツール到達。

**成果物:**
- [x] `src/commands/db.ts` — `db create / update / query`
- [x] `src/commands/view.ts` — `view create / update`
- [x] `src/commands/comment.ts` — `comment create / list`
- [x] `src/commands/user.ts` — `user list` + `team list`
- [x] `src/commands/meeting-notes.ts` — `meeting-notes query`

**テスト:**
- [x] 各コマンドの引数パース・マッピング
- [x] `--prop Name:type=options` パーサー (db create 用)

**検証:**
- [x] `npm run typecheck` → エラーなし
- [x] `npm run lint` → パス
- [x] `npm test` → 全テストパス (14ファイル, 105テスト)
- [x] `notion tools` 相当の確認で全16ツールに CLI コマンドが対応

> ツール数はプランにより変動。`notion api` escape hatch で未知ツールにもアクセス可能。

**備考:**
- `view create/update` はスキーマが大きく詳細未公開のため `--data` を主インターフェースとした。
- `meeting-notes query` も `filter` が複雑なネスト構造のため `--data` のみで対応。
- `db create` は `--schema` (生 SQL DDL) と `--prop Name:type=opts` (便利フラグ) の2系統を提供。`--schema` が優先。
- DDL の SELECT オプション構文は `SELECT OPTIONS 'a','b'` ではなく `SELECT('a','b')` が正。手動検証で発見・修正。
- `notion-create-view` は `database_id` と `data_source_id` が両方必須 (実測で判明)。
- 追加ユーティリティ: `src/util/db-props.ts` (`--prop` → SQL DDL 変換パーサー)

---

## PHASE-4: Output & DX ✅

出力整形、エラーハンドリング、ディスカバリコマンド。

**成果物:**
- [x] `src/util/errors.ts` — CliError (What+Why+Hint)、formatError、parseJsonData、withRetry
- [x] `src/commands/api.ts` — `notion api <tool> [json]` (escape hatch)
- [x] `src/output/json.ts` 改善 — デフォルト出力で JSON テキストを pretty-print
- [x] `src/index.ts` — グローバルエラーハンドラ (`--json` 時は JSON 構造化エラー)
- [x] `src/mcp/client.ts` — MCP `isError` → CliError 変換 + パターンマッチヒント
- [x] `src/cli.ts` — Quick start ガイド、Commander エラーに `--help` 案内、`--help` description 改善
- [x] 全コマンドの `--data` を `parseJsonData()` に統一
- [x] 全コマンドの `--help` にワークフローヒント (`addHelpText`)

**削除 (設計見直し):**
- `src/commands/tools.ts` — ディスカバリは `--help` に一本化。専用コマンドは不要
- `src/mcp/tool-registry.ts` — tools.ts 専用だったため不要
- `src/output/formatter.ts` — tools.ts 専用だったため不要
- `chalk`, `ora` 依存 — 未使用のため削除

**テスト:**
- [x] エラーハンドリング (rate limit, auth error, tool error)
- [x] `notion api` の引数パース

**検証:**
- [x] `npm run typecheck` → エラーなし
- [x] `npm run lint` → パス
- [x] `npm test` → 全テストパス
- [x] `notion api notion-search '{"query":"test"}'` → 結果返却
- [x] 全コマンドの E2E 手動検証完了

**備考:**
- プロダクションコードに `new Error()` はゼロ — 全て CliError。
- MCP エラーはパターンマッチで agent-recoverable なヒントを自動付与 (DB URL, data_source_id, rich_text 等)。
- Commander エラー (unknown command, missing arg) にも `--help` への案内を統一追加。
- `notion --help` に Quick start セクション: 基本ワークフロー、DB のコツ、`--json` 推奨、per-command --help 案内。
- Agent-first 設計原則の詳細は `docs/agent-first-design.md` に記録。

---

## PHASE-5: Polish & Release ✅

README、npm publish 準備。

**成果物:**
- [x] `README.md` — インストール、使い方、全コマンド一覧
- [x] `LICENSE` (MIT, 2026 Sakasegawa)
- [x] `.npmignore` / `package.json files` 設定 — `"files": ["dist"]` で十分、`.npmignore` 不要
- [x] npm publish 準備 — `prepublishOnly` スクリプト追加、keywords/author/homepage 追加

**検証:**
- [x] `npm run typecheck` → エラーなし
- [x] `npm run lint` → パス
- [x] `npm test` → 全テストパス (17ファイル, 133テスト)
- [x] `npm pack` → ローカルインストール → 全コマンド動作確認 (5ファイル, 11.9kB)

**備考:**
- `.npmignore` は不要。`"files": ["dist"]` ホワイトリストで十分。npm は README.md, LICENSE を自動包含。
- README は英語（public npm package 向け）。Agent-first 設計の説明、全コマンドテーブル、ワークフロー例を含む。
- `prepublishOnly` で build + typecheck + lint + test を自動実行。
- 実際の publish は `npm publish --access public` で手動実行。
