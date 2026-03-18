# Notion Remote MCP — サポートツール一覧

> Source: https://developers.notion.com/guides/mcp/mcp-supported-tools.md
> Source: https://developers.notion.com/guides/mcp/mcp.md
> inputSchema: `tools/list` 実測 (2026-03-18)

## 概要

Notion MCP は Notion がホストするリモート MCP サーバー。AI ツールに対して Notion ワークスペースへのセキュアアクセスを提供する。

- エンドポイント (Streamable HTTP, 推奨): `https://mcp.notion.com/mcp`
- エンドポイント (SSE, フォールバック): `https://mcp.notion.com/sse`
- 認証: OAuth 2.0 + PKCE（ユーザーとしてログイン、全ワークスペースにアクセス可能）

> Source: https://developers.notion.com/docs/mcp

## ツール一覧

> **注意**: 公式ドキュメント (2026-03) では18ツールと記載されているが、実際に `tools/list` で返るのは16ツール。
> `notion-get-self`, `notion-get-user` は存在せず、`notion-query-data-sources` はプラン制限で非表示の可能性がある。
> 代わりに `notion-query-meeting-notes` というドキュメント未記載のツールが存在する。
> 以下は **2026-03-18 時点の実測結果** に基づく。inputSchema は `tools/list` から取得した実データ。

### 1. `notion-search`

検索。Notion ワークスペースおよび接続ツール（Slack, Google Drive, Jira 等）を横断検索。

- **プラン要件**: Notion AI アクセス必須（なければ Notion 内のみ）
- **レート制限**: 30 リクエスト/分（他ツールより厳しい）

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `query` | string | Yes | 検索クエリ (minLength: 1) |
| `query_type` | enum | No | `"internal"` \| `"user"` |
| `content_search_mode` | enum | No | `"workspace_search"` \| `"ai_search"` |
| `data_source_url` | string | No | データソースURL内を検索 |
| `page_url` | string | No | ページURL/ID内を検索 |
| `teamspace_id` | string | No | チームスペースID内に限定 |
| `filters` | object | No | `created_date_range`, `created_by_user_ids` |
| `page_size` | integer | No | 結果数 (1-25, default: 10) |
| `max_highlight_length` | integer | No | ハイライト文字数 (max: 500, default: 200, 0で非表示) |

### 2. `notion-fetch`

ページ、データベース、データソースの内容を URL または ID で取得。データソース ID (`collection://...`) でスキーマ・プロパティも取得可能。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | Yes | Notion URL、notion.site URL、UUID、collection:// URL |
| `include_transcript` | boolean | No | トランスクリプトを含める |
| `include_discussions` | boolean | No | ディスカッションを含める |

### 3. `notion-create-pages`

1つ以上のページをバッチ作成。プロパティ、コンテンツ、アイコン、カバー画像を指定可能。parent 未指定時はプライベートページとして作成。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `pages` | array (max: 100) | Yes | ページ定義の配列 |
| `pages[].properties` | object | No | プロパティ (key → string/number/null) |
| `pages[].content` | string | No | Notion Markdown でのコンテンツ |
| `pages[].template_id` | string | No | テンプレートID (content と排他) |
| `pages[].icon` | string | No | emoji / `:name:` / 外部URL / `"none"` |
| `pages[].cover` | string | No | 外部画像URL / `"none"` |
| `parent` | object | No | `{ page_id, type: "page_id" }` / `{ database_id, type: "database_id" }` / `{ data_source_id, type: "data_source_id" }` |

### 4. `notion-update-page`

ページのプロパティ、コンテンツ、アイコン、カバーを更新。command フィールドで操作を指定。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `page_id` | string | Yes | ページID (ダッシュあり/なし) |
| `command` | enum | Yes | `"update_properties"` / `"update_content"` / `"replace_content"` / `"apply_template"` / `"update_verification"` |
| `properties` | object | No | `update_properties` 用。key → string/number/null |
| `new_str` | string | No | `replace_content` 用。置換後のコンテンツ全体 |
| `content_updates` | array (max: 100) | No | `update_content` 用。`{ old_str, new_str, replace_all_matches? }` |
| `allow_deleting_content` | boolean | No | コンテンツ削除の許可 |
| `template_id` | string | No | `apply_template` 用 |
| `verification_status` | enum | No | `"verified"` / `"unverified"` |
| `verification_expiry_days` | integer | No | 検証期限 (日数) |
| `icon` | string | No | emoji / `:name:` / 外部URL / `"none"` |
| `cover` | string | No | 外部画像URL / `"none"` |

### 5. `notion-move-pages`

1つ以上のページまたはデータベースを新しい親に移動。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `page_or_database_ids` | array (1-100) | Yes | 移動するページ/DB IDの配列 |
| `new_parent` | object | Yes | `{ page_id, type: "page_id" }` / `{ database_id, type: "database_id" }` / `{ data_source_id, type: "data_source_id" }` / `{ type: "workspace" }` |

### 6. `notion-duplicate-page`

ページを複製。**非同期処理**（ツールは複製完了前に返る）。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `page_id` | string | Yes | ページID (UUIDv4, ダッシュあり/なし) |

### 7. `notion-create-database`

新規データベースを SQL DDL スキーマ定義で作成。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `schema` | string | Yes | SQL DDL CREATE TABLE 文。カラム名はダブルクォート。SELECT/MULTI_SELECT のオプションは `SELECT('opt1','opt2')` 構文 (例: `CREATE TABLE "T" ("Status" SELECT('Open','Done'))`) |
| `parent` | object | No | `{ page_id, type: "page_id" }`。省略時はプライベートページ |
| `title` | string | No | データベースタイトル |
| `description` | string | No | データベース説明 |

### 8. `notion-update-data-source`

データソースのスキーマ、名前、説明を更新。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `data_source_id` | string | Yes | `collection://` URI、UUID、またはDB ID |
| `statements` | string | No | SQL DDL 文 (ADD/DROP/RENAME/ALTER COLUMN) |
| `title` | string | No | 新しいタイトル |
| `description` | string | No | 新しい説明 |
| `is_inline` | boolean | No | インライン表示 |
| `in_trash` | boolean | No | ゴミ箱に移動 |

### 9. `notion-create-view`

データベースにビューを作成。対応ビュータイプ: table, board, list, calendar, timeline, gallery, form, chart, map, dashboard。

> スキーマが大きいため全詳細は `notion api` で `tools/list` を参照。

**必須フィールド (実測):**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `database_id` | string | Yes | データベース ID |
| `data_source_id` | string | Yes | データソース ID (`collection://...`) |
| `type` | string | No | ビュータイプ (`table`, `board` 等) |
| `name` | string | No | ビュー名 |

### 10. `notion-update-view`

ビューの名前、フィルタ、ソート、表示設定を更新。

> スキーマが大きいため詳細は `notion api` で `tools/list` を参照。

### 11. `notion-query-database-view`

既存ビューの URL を指定してクエリ。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `view_url` | string | Yes | ビューURL (例: `https://notion.so/workspace/db-id?v=view-id`) または `view://` URL (例: `view://7c69e8d9-...`) |

- **プラン要件**: Business 以上 + Notion AI（ドキュメント記載）

### 12. `notion-query-meeting-notes`

ドキュメント未記載のツール。実測で存在を確認 (2026-03-18)。フィルタオブジェクトを受け取る。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `filter` | object | No | ネストされたフィルタ (`{ operator: "and"/"or", filters: [...] }`) |

> Source: `tools/list` 実測 (2026-03-18)

### ~~`notion-query-data-sources`~~ (実測で非存在)

ドキュメントでは「Enterprise + Notion AI」プラン要件と記載。
実測環境 (個人プラン) では `tools/list` に含まれなかった。プラン制限で非表示の可能性。

> Source: https://developers.notion.com/guides/mcp/mcp-supported-tools.md

### 13. `notion-create-comment`

ページまたは特定コンテンツにコメント・返信を追加。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `rich_text` | array (max: 100) | Yes | リッチテキストオブジェクト配列 (text / mention / equation) |
| `page_id` | string | Yes | コメント対象のページID |
| `discussion_id` | string | No | 返信先ディスカッションID / `discussion://` URL |
| `selection_with_ellipsis` | string | No | コメント対象テキスト範囲 (例: `"# Section...paragraph."`) |

### 14. `notion-get-comments`

ページの全コメント・ディスカッションを一覧取得。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `page_id` | string | Yes | ページID |
| `include_resolved` | boolean | No | 解決済みスレッドを含める |
| `include_all_blocks` | boolean | No | 全ブロックのコメントを含める |
| `discussion_id` | string | No | 特定ディスカッションのみ取得 |

### 15. `notion-get-teams`

ワークスペース内のチーム（teamspace）一覧を取得。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `query` | string | No | チーム名フィルタ (大文字小文字不問, 1-100文字) |

### 16. `notion-get-users`

ワークスペースの全ユーザーとその詳細を一覧取得。

**inputSchema:**

| 引数 | 型 | 必須 | 説明 |
|---|---|---|---|
| `query` | string | No | 名前/メールでフィルタ (大文字小文字不問, 1-100文字) |
| `user_id` | string | No | 特定ユーザーID (`"self"` で自分) |
| `start_cursor` | string | No | ページネーションカーソル |
| `page_size` | integer | No | 1ページあたり件数 (1-100, default: 100) |

### ~~`notion-get-user`~~ (実測で非存在)

ドキュメントでは記載あり。実測では `tools/list` に含まれなかった。
`notion-get-users` の `user_id` パラメータで代替可能。

### ~~`notion-get-self`~~ (実測で非存在)

ドキュメントでは記載あり。実測では `tools/list` に含まれなかった。
`notion-get-users` の `user_id: "self"` で代替可能。

## レート制限

- **一般**: 180 リクエスト/分（平均 3 リクエスト/秒）
- **`notion-search`**: 30 リクエスト/分
- HTTP 429 レスポンス + `Retry-After` ヘッダーで制限通知

> Source: https://developers.notion.com/guides/mcp/mcp-supported-tools.md

## 現在の制限事項

- ファイルアップロード非対応（ロードマップに記載）
- Bearer Token 認証非対応（OAuth 必須、完全自動化ワークフローには不向き）
- ヘッドレス/自動アクセス不可
- ~~ツールパラメータの JSON Schema はドキュメント非公開~~ → `tools/list` で取得済み (本ドキュメントに記録)

> Source: https://developers.notion.com/guides/mcp/mcp-supported-tools.md
> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

## OSS版 (notion-mcp-server) との比較

OSS 版は**アクティブメンテナンス終了**。将来 sunset の可能性あり。

> We may sunset this local MCP server repository in the future.
> Issues and pull requests here are not actively monitored.

| 機能 | Remote MCP (16ツール実測) | OSS版 (22ツール) |
|---|---|---|
| 認証 | OAuth（全ワークスペース） | Integration Token（手動接続） |
| 検索 | AI横断検索 (Slack, Drive等) | タイトル検索のみ |
| ページ複製 | ✅ | ❌ |
| ビュー作成/更新 | ✅ | ❌ |
| AI要約クエリ | ✅ (Enterprise) | ❌ |
| Teams取得 | ✅ | ❌ |
| Block直接操作 | ❌ (fetch経由) | ✅ (CRUD) |
| ファイルアップロード | ❌ | ❌ |

> Source: https://github.com/makenotion/notion-mcp-server (README.md)
> Source: https://developers.notion.com/guides/mcp/hosting-open-source-mcp.md
