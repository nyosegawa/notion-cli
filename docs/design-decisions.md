# Design Decisions

## 判断一覧

| 判断 | 選択 | 根拠 |
|---|---|---|
| コマンド構造 | noun-verb (grouped) | コマンド数が多い flat list は help が読みにくい。`gh` パターンに倣う |
| 引数 | ハードコード + escape hatch | DX (tab completion, validation) と柔軟性の両立 |
| 認証トリガー | 初回自動 | ゼロフリクション。`notion login` も明示的に可能 |
| 接続方式 | connect-per-command | CLI は単一プロセス。デーモンは複雑さに見合わない |
| CLI フレームワーク | Commander.js | 0 deps, 180KB, 最小オーバーヘッド, TypeScript 型定義内蔵 |
| トークン保存 | ファイルベース (env-paths) | CLI で最も一般的。キーチェーンは OS 依存が大きい |
| リンター | Biome | PostToolUse hook 向けに高速 (ESLint 比 50-100x)。format + lint 一体 |
| テスト | vitest | ESM ネイティブ、TypeScript サポート、高速 |
| パッケージ名 | `@sakasegawa/notion-cli` | npm `notion-cli` / `notion` は既存プレースホルダーあり。scoped で安全 |
| バイナリ名 | `notion` | シンプルで覚えやすい |
| Node.js | >= 18 | native fetch, crypto.subtle, ESM |
| Module | ESM | MCP SDK が ESM。CJS は非推奨方向 |

## トレードオフ

### Flat vs Grouped コマンド

Flat (`notion search`, `notion create-page`) は実装が簡単だが、多数のコマンドが `--help` で一列に並ぶ。
Grouped (`notion page create`) はディスカバラビリティが高く、新ツール追加時にスケールする。

### 引数: ハードコード vs 動的スキーマ

MCP の `tools/list` からパラメータスキーマを動的取得すれば常に最新だが、tab completion やバリデーションが効かない。
ハードコードは DX が良いが、サーバー変更時に更新が必要。`notion api` で動的 escape hatch を提供して両立。

### Connect-per-command vs デーモン

デーモンなら2回目以降の接続が高速だが、プロセス管理 (PID, socket, timeout) の複雑さが大きい。
CLI の 500ms オーバーヘッドはユーザー体感で問題にならない。

### ファイルベース vs キーチェーン

キーチェーンは安全だが macOS/Linux/Windows で API が異なり、ネイティブモジュールが必要。
ファイルベース + `0o600` パーミッションは gh CLI のフォールバックと同じアプローチ。

## 出力設計: Agent-first

→ 詳細は [`docs/agent-first-design.md`](agent-first-design.md) を参照。
