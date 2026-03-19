# Commands

## コマンド体系

noun-verb パターン（`gh` CLI スタイル）。頻用コマンドはトップレベル。

```
ncli login / logout / whoami
ncli search <query>
ncli fetch <url-or-id>

ncli page create / update <id> / move <id> / duplicate <id>
ncli db create / update <id> / query <view-url>
ncli view create / update
ncli comment create <id> / list <id>
ncli user list
ncli team list
ncli meeting-notes query

ncli api <tool-name> [json]     # raw escape hatch
```

## MCP ツール → CLI マッピング

> 2026-03-18 時点の `tools/list` 実測に基づく (16ツール)
> 引数名は実際の inputSchema から取得。

| CLI コマンド | MCP Tool | MCP 引数 (required は **太字**) |
|---|---|---|
| `search <query>` | `notion-search` | **`query`**, `query_type`, `content_search_mode`, `page_size`, `filters` |
| `fetch <url-or-id>` | `notion-fetch` | **`id`**, `include_transcript`, `include_discussions` |
| `page create` | `notion-create-pages` | **`pages`** (配列: `{ properties, content, icon, cover }`), `parent` (`{ page_id \| database_id \| data_source_id, type }`) |
| `page update <id>` | `notion-update-page` | **`page_id`**, **`command`** (`update_properties` / `update_content` / `replace_content` / `apply_template` / `update_verification`), `properties`, `new_str`, `content_updates`, `icon`, `cover` |
| `page move <id>...` | `notion-move-pages` | **`page_or_database_ids`** (配列), **`new_parent`** (`{ page_id \| database_id \| data_source_id \| workspace, type }`) |
| `page duplicate <id>` | `notion-duplicate-page` | **`page_id`** |
| `db create` | `notion-create-database` | **`schema`** (SQL DDL), `parent` (`{ page_id, type }`), `title`, `description` |
| `db update <id>` | `notion-update-data-source` | **`data_source_id`**, `statements` (SQL DDL), `title`, `description` |
| `db query <view-url>` | `notion-query-database-view` | **`view_url`** |
| `view create` | `notion-create-view` | **`database_id`**, **`data_source_id`**, `type`, `name` 等 (`--data` 推奨) |
| `view update` | `notion-update-view` | `view_id`, `name` 等 (`--data` 推奨) |
| `comment create <id>` | `notion-create-comment` | **`rich_text`** (配列), **`page_id`**, `discussion_id`, `selection_with_ellipsis` |
| `comment list <id>` | `notion-get-comments` | **`page_id`**, `include_resolved`, `include_all_blocks`, `discussion_id` |
| `team list` | `notion-get-teams` | `query` |
| `user list` | `notion-get-users` | `query`, `user_id` (`"self"` で自分), `page_size`, `start_cursor` |
| `meeting-notes query` | `notion-query-meeting-notes` | `filter` (ネストされたフィルタオブジェクト) |

> `notion-query-data-sources` (Enterprise+AI), `notion-get-user`, `notion-get-self` はドキュメント記載ありだが実測で非存在。
> プラン制限またはサーバー側の変更の可能性。`ncli api` escape hatch で動的にアクセス可能。

## CLI 引数 → MCP 引数マッピング

CLI のフラグは MCP ツールの引数構造に変換される。

### `ncli search <query>`

```
CLI: ncli search "test"
MCP: { query: "test" }
```

### `ncli fetch <url-or-id>`

```
CLI: ncli fetch abc123
MCP: { id: "abc123" }
```

### `ncli page create`

```
CLI: ncli page create --title "Bug" --parent collection://ds-id --prop "Status=Open" --body "# Content"
MCP: {
  pages: [{ properties: { title: "Bug", Status: "Open" }, content: "# Content" }],
  parent: { data_source_id: "ds-id", type: "data_source_id" }
}

# parent は ID のプレフィックスで自動判別 (create では workspace 不可):
#   collection://xxx → { data_source_id: "xxx", type: "data_source_id" }
#   その他           → { page_id: "xxx", type: "page_id" }
```

### `ncli page update <id>`

```
CLI: ncli page update abc123 --prop "Status=Done"
MCP: { page_id: "abc123", command: "update_properties", properties: { Status: "Done" } }

CLI: ncli page update abc123 --body "New content"
MCP: { page_id: "abc123", command: "replace_content", new_str: "New content" }
```

### `ncli page move <id...> --to <parent-id>`

```
CLI: ncli page move id1 id2 --to target-id
MCP: { page_or_database_ids: ["id1", "id2"], new_parent: { page_id: "target-id", type: "page_id" } }

# --to は ID のプレフィックスで自動判別 (move では workspace も有効):
#   collection://xxx → { data_source_id: "collection://xxx", type: "data_source_id" }
#   workspace        → { type: "workspace" }
#   その他           → { page_id: "xxx", type: "page_id" }
```

### `ncli page duplicate <id>`

```
CLI: ncli page duplicate abc123
MCP: { page_id: "abc123" }
```

### `ncli db create`

```
CLI: ncli db create --title "Tasks" --parent page-id --prop "Name:title" --prop "Status:select=Open,Done"
MCP: { schema: "CREATE TABLE \"Tasks\" (\"Name\" TITLE, \"Status\" SELECT('Open','Done'))", parent: { page_id: "page-id", type: "page_id" }, title: "Tasks" }

CLI: ncli db create --schema 'CREATE TABLE "T" ("Name" TITLE)' --parent page-id
MCP: { schema: "CREATE TABLE \"T\" (\"Name\" TITLE)", parent: { page_id: "page-id", type: "page_id" } }
```

### `ncli db update <id>`

```
CLI: ncli db update ds-id --title "New Title" --statements 'ADD COLUMN "Priority" SELECT'
MCP: { data_source_id: "ds-id", title: "New Title", statements: "ADD COLUMN \"Priority\" SELECT" }
```

### `ncli db query <view-url>`

```
CLI: ncli db query "view://view-id"
MCP: { view_url: "view://view-id" }
```

### `ncli comment create <page-id>`

```
CLI: ncli comment create page-id --body "LGTM"
MCP: { page_id: "page-id", rich_text: [{ type: "text", text: { content: "LGTM" } }] }
```

### `ncli comment list <page-id>`

```
CLI: ncli comment list page-id --include-resolved
MCP: { page_id: "page-id", include_resolved: true }
```

### `ncli user list`

```
CLI: ncli user list --query "alice"
MCP: { query: "alice" }
```

### `ncli team list`

```
CLI: ncli team list --query "engineering"
MCP: { query: "engineering" }
```

### `ncli meeting-notes query`

```
CLI: ncli meeting-notes query --data '{"filter":{"operator":"and","filters":[]}}'
MCP: { filter: { operator: "and", filters: [] } }
```

### `ncli view create / update`

```
CLI: ncli view create --data '{"database_id":"db-id","data_source_id":"collection://ds-id","type":"board","name":"Kanban"}'
MCP: { database_id: "db-id", data_source_id: "collection://ds-id", type: "board", name: "Kanban" }
```

## 引数設計

- **頻用パラメータ**: 個別フラグ (`--title`, `--prop Key=Value`, `--parent`)
- **複雑なパラメータ**: `--data '{json}'` でフルJSON渡し（他フラグを上書き）
- **stdin**: `--body -` でパイプ対応 (`echo "# Hello" | ncli page create --title "Test" --body -`)
- **escape hatch**: `ncli api <tool-name> '{"key": "value"}'`

## グローバルフラグ

| フラグ | 説明 |
|---|---|
| `--json` | JSON 出力 |
| `--raw` | MCP 生レスポンス |
| `--verbose, -v` | デバッグ情報 |
| `--no-color` | 色なし |

## 使用例と出力

### 検索

```bash
$ ncli search "週次レビュー"
{
  "results": [
    { "id": "abc123-...", "title": "週次レビュー 3月", "type": "page", "highlight": "週次レビュー...", "timestamp": "2026-03-15T..." },
    { "id": "def456-...", "title": "週次レビューテンプレート", "type": "page", ... }
  ],
  "type": "workspace_search"
}
```

### ページ取得

```bash
$ ncli fetch abc123-def456
{
  "metadata": { "type": "page" },
  "title": "週次レビュー 3月",
  "url": "https://www.notion.so/abc123def456",
  "text": "<page url=\"...\">...<content>\n# 議題\n- 進捗確認\n- 来週の計画\n</content>\n</page>"
}
```

### ページ作成

```bash
$ ncli page create --title "新しい議事録" --parent <page-id> --body "# 議題"
{
  "pages": [
    { "id": "new-page-id", "url": "https://www.notion.so/...", "properties": { "title": "新しい議事録" } }
  ]
}

# DB 配下にプロパティ付きで作成 (data_source_id は ncli fetch <db-id> で取得)
$ ncli page create --parent collection://<ds-id> --title "バグ修正" --prop "Status=Open" --prop "Priority=High"

# stdin からコンテンツ
$ echo "# 本文" | ncli page create --title "ドキュメント" --body -
```

### ページ更新

```bash
$ ncli page update <id> --prop "Status=Done"
{ "page_id": "<id>" }

$ ncli page update <id> --body "# 更新された内容"
{ "page_id": "<id>" }

# --prop/--title と --body は同時に指定できない (別の MCP 操作のため)
$ ncli page update <id> --title "New" --body "Content"
Error: Cannot use --body with --prop/--title in the same command
```

### ページ移動・複製

```bash
$ ncli page move <id> --to <parent-id>
{ "result": "Successfully moved 1 item: <id>" }

$ ncli page duplicate <id>
{ "page_id": "<new-id>", "page_url": "https://www.notion.so/..." }
```

### データベース作成

```bash
# --prop で簡易指定
$ ncli db create --title "タスク管理" --parent <page-id> --prop "Name:title" --prop "Status:select=Open,Done"
{ "result": "Created database: <database url=\"...\">...<data-source url=\"collection://<ds-id>\">..." }

# --schema で SQL DDL 指定
$ ncli db create --schema 'CREATE TABLE "Tasks" ("Name" TITLE, "Status" SELECT)' --parent <page-id>
```

### データベース更新

```bash
# data_source_id は ncli fetch <db-id> のレスポンスから取得
$ ncli db update <data-source-id> --statements 'ADD COLUMN "Priority" SELECT'
{ "result": "Updated data source: ..." }
```

### データベースクエリ

```bash
# view URL が必要 (ncli fetch <db-id> で取得、なければ view create)
$ ncli db query "https://www.notion.so/<db-id>?v=<view-id>"
{
  "results": [
    { "Status": "Open", "Name": "タスク1", "url": "https://www.notion.so/..." }
  ],
  "has_more": false
}
```

### ビュー

```bash
$ ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"全タスク"}'
{ "result": "Created view \"全タスク\" (table) — view://<view-id>\n..." }

$ ncli view update --data '{"view_id":"<view-id>","name":"名前変更"}'
{ "result": "Updated view \"名前変更\" — view://<view-id>\n..." }
```

### コメント

```bash
$ ncli comment create <page-id> --body "LGTM"
{ "result": { "status": "success", "id": "<comment-id>" } }

$ ncli comment list <page-id>
{ "text": "<discussions total-count=\"1\" ...>...</discussions>" }
```

### ユーザー・チーム

```bash
$ ncli user list
{
  "results": [
    { "type": "person", "id": "...", "name": "Alice", "email": "alice@example.com" },
    { "type": "bot", "id": "...", "name": "Notion MCP" }
  ],
  "has_more": false
}

$ ncli team list
{ "joinedTeams": [{ "type": "team", "name": "Engineering", "role": "owner" }], ... }
```

### ミーティングノート

```bash
$ ncli meeting-notes query
{ "results": [...], "has_more": false }

# 過去1週間のミーティング
$ ncli meeting-notes query --data '{"filter":{"operator":"and","filters":[{"property":"created_time","filter":{"operator":"date_is_within","value":{"type":"relative","value":"the_past_week"}}}]}}'
```

### Escape hatch

```bash
$ ncli api notion-search '{"query":"test","page_size":3}'
{ "results": [...], "type": "workspace_search" }

$ echo '{"query":"test"}' | ncli api notion-search
```

### グローバルフラグ

```bash
ncli search "test" --json       # 構造化 JSON 出力
ncli fetch <id> --raw           # MCP 生レスポンス (isError フラグ等を含む)
```

### エラー出力例

```bash
$ ncli db query "https://www.notion.so/invalid-url"
Error: notion-query-database-view failed
  Why: Invalid database view URL: https://www.notion.so/invalid-url
  Hint: Use a view URL with ?v= parameter. Run "ncli fetch <db-id>" to find view URLs, or create one with "ncli view create"

# --json 時のエラー
$ ncli page create --data '{bad}' --json
{ "error": "Invalid --data JSON", "why": "The provided JSON string could not be parsed", "hint": "Check syntax: --data '{\"key\": \"value\"}'" }
```

### 典型的なワークフロー

```bash
# 1. 検索 → ページ取得 → 更新
ncli search "プロジェクト計画"               # → results[].id を取得
ncli fetch <id>                              # → 内容を確認
ncli page update <id> --prop "Status=Done"   # → プロパティ更新

# 2. DB 作成 → ページ追加 → クエリ
ncli db create --title "タスク" --parent <page-id> --prop "Name:title" --prop "Status:select=Open,Done"
# → レスポンスから data_source_id (collection://...) を取得
ncli page create --data '{"pages":[{"properties":{"Name":"タスク1","Status":"Open"}}],"parent":{"data_source_id":"<ds-id>","type":"data_source_id"}}'
ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"All"}'
# → レスポンスから view URL (view://...) を取得
ncli db query "https://www.notion.so/<db-id>?v=<view-id>"
```
