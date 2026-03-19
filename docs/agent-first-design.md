# Agent-first CLI Design

この CLI の主なユーザーは Coding Agent (Claude Code, Codex など)。
設計のすべてを Agent の生産性に最適化する。

## Agent の導線

Agent がこの CLI を初めて使うときの想定フロー:

1. `ncli --help` → コマンド一覧 + Quick start（基本ワークフロー・DB のコツ・`--json` 推奨）
2. いきなり実行する（Agent は `--help` を深掘りせず試す）
3. エラーが出たら Hint に従って修正する
4. 複雑な操作は `ncli <command> --help` で例とヒントを確認する

**Agent は `--help` を読むが、サブコマンドの `--help` は読まない。** エラーの Hint が実質的なガイドになる。

## 設計原則

### 1. 出力は Agent が読みやすい形式

- デフォルト出力は MCP レスポンスの JSON テキストを自動検出して pretty-print
- 人間向けの装飾（色、罫線、スピナー等）は TTY 検出で自動制御し、パイプ時は除去
- `--json` で構造化データ、`--raw` で MCP 生レスポンスも取得可能
- `--json` 時のエラーも JSON 構造化出力 (`{ "error", "why", "hint" }`)

### 2. ディスカバリは `--help` + エラーヒント

**`--help` の3レイヤー:**

- `ncli --help` → 全コマンド一覧 + Quick start (ワークフロー・基本例・`--json` 推奨・per-command --help への案内)
- `ncli page --help` → サブコマンド一覧
- `ncli db create --help` → フラグ・例・前提条件・次のステップ (`addHelpText` で付加)

**エラーヒント（実質的なメインガイド）:**

Agent は試行錯誤で学ぶ。エラーの Hint が次のアクションを直接案内する:

```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --data with "parent":{"data_source_id":"<ds-id>",...}. Run "ncli fetch <db-id>" to get the data_source_id
```

MCP エラーをパターンマッチしてツール固有のヒントを付与:

| パターン | ヒント |
|---|---|
| DB URL で query | view URL が必要 → fetch か view create |
| page create で DB ID を parent に | data_source_id が必要 → fetch で取得 |
| data_source_id が Required | fetch <db-id> で collection://... を探す |
| rich_text が Required | --body でコメント内容を指定 |
| ツールが見つからない | --help でコマンド一覧を確認 |
| バリデーションエラー（汎用） | --data で直接制御するか --help で確認 |

各コマンドの description は Agent が読んで即座に判断できるレベルにキュレーションする。
MCP ツール名や MCP の内部構造は Agent に見せない（`ncli api` で必要な場合のみ）。

### 3. エラーは What + Why + Hint

Agent がエラーから自己回復できるよう、構造化されたエラーメッセージを返す。

```
Error: Invalid --data JSON
  Why: The provided JSON string could not be parsed
  Hint: Check syntax: --data '{"key": "value"}'
```

- What: 何が起きたか
- Why: なぜ起きたか
- Hint: 次に何をすべきか

全エラー源で統一:
- CLI 引数パースエラー → `CliError` (props, db-props, api JSON)
- MCP `isError` レスポンス → パターンマッチで `CliError` に変換
- OAuth エラー → `CliError`
- `--json` 時 → `{ "error", "why", "hint" }` の JSON を stderr に出力

### 4. Escape hatch

CLI にまだ対応していないツールや複雑な引数構造には `ncli api` で対応。

```bash
ncli api <tool-name> '{"key": "value"}'
echo '{"query":"test"}' | ncli api notion-search
```

Agent は `ncli --help` でコマンド一覧を確認し、CLI コマンドが不十分なら `ncli api` にフォールバックできる。

## 反面教師: 避けるべきパターン

| パターン | 問題 |
|---|---|
| MCP ツール名を CLI のインターフェースとして露出 | Agent が知る必要のない内部実装の漏洩 |
| 専用ディスカバリコマンド (`tools` 等) | `--help` で十分。余分なコマンドは認知負荷 |
| サブコマンドの `--help` に重要情報を隠す | Agent はサブコマンドの help を読まない。エラーヒントのほうが届く |
| 人間向けの装飾表示のみ | パイプ時にパースしにくい |
| エラーメッセージが単一文字列 | Agent が原因特定・回復できない |
| エラーで「何をすべきか」がない | Hint がないと Agent は同じミスを繰り返す |
