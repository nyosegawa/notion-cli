# `ntn` CLI との比較・差分分析

## `ntn` (Notion CLI) 概要

- **バージョン**: v0.3.0
- **パッケージ**: npm `ntn`, 16.1 MB, Node >= 22.0.0
- **作者**: `jclem-ntn <jclem@makenotion.com>` (Notion 公式)
- **ライセンス**: MIT
- **ソースコード**: 非公開（バンドル済み）

> Source: https://www.npmjs.com/package/ntn

## `ntn` のコマンド体系

```
ntn api      — Public Notion API の呼び出し (beta)
ntn files    — ファイルアップロード管理 (beta)
ntn login    — Notion にログイン
ntn logout   — ログアウト
ntn tokens   — トークン管理
ntn update   — バージョンチェック
ntn workers  — Workers 管理
```

> Source: `ntn --help` 実行結果

## `ntn api` のエンドポイント一覧

```
DELETE /v1/blocks/{block_id}                         Delete a block
GET    /v1/blocks/{block_id}                         Retrieve a block
PATCH  /v1/blocks/{block_id}                         Update a block
GET    /v1/blocks/{block_id}/children                Retrieve block children
PATCH  /v1/blocks/{block_id}/children                Append block children
GET    /v1/comments                                  List comments
POST   /v1/comments                                  Create a comment
GET    /v1/comments/{comment_id}                     Retrieve a comment
POST   /v1/data_sources                              Create a data source
GET    /v1/data_sources/{data_source_id}             Retrieve a data source
PATCH  /v1/data_sources/{data_source_id}             Update a data source
POST   /v1/data_sources/{data_source_id}/query       Query a data source
GET    /v1/data_sources/{data_source_id}/templates   List templates in a data source
POST   /v1/databases                                 Create a database
GET    /v1/databases/{database_id}                   Retrieve a database
PATCH  /v1/databases/{database_id}                   Update a database
GET    /v1/file_uploads                              List file uploads
POST   /v1/file_uploads                              Create a file upload
GET    /v1/file_uploads/{file_upload_id}             Retrieve a file upload
POST   /v1/file_uploads/{file_upload_id}/complete    Complete a multi-part file upload
POST   /v1/file_uploads/{file_upload_id}/send        Upload a file
POST   /v1/pages                                     Create a page
GET    /v1/pages/{page_id}                           Retrieve a page
PATCH  /v1/pages/{page_id}                           Update page
GET    /v1/pages/{page_id}/markdown                  Retrieve a page as markdown
PATCH  /v1/pages/{page_id}/markdown                  Update a page's content as markdown
POST   /v1/pages/{page_id}/move                      Move a page
GET    /v1/pages/{page_id}/properties/{property_id}  Retrieve a page property item
POST   /v1/search                                    Search by title
GET    /v1/users                                     List all users
GET    /v1/users/me                                  Retrieve your token's bot user
GET    /v1/users/{user_id}                           Retrieve a user
```

> Source: `ntn api ls` 実行結果

## `ntn` の認証方式

| コマンド | 認証方式 | 備考 |
|---|---|---|
| `ntn api` | `NOTION_API_TOKEN` 環境変数 | Integration Token。手動でページ接続が必要 |
| `ntn files` | `NOTION_API_TOKEN` 環境変数 | 同上 |
| `ntn workers` | `ntn login` (セッション認証) | OAuth ではない |
| `ntn tokens` | `ntn login` (セッション認証) | Workers 用トークン管理 |

> Source: `ntn --help`, makenotion/skills SKILL.md

## Remote Notion MCP vs `ntn api` 機能比較

| 機能 | Remote MCP | `ntn api` | 備考 |
|---|---|---|---|
| **認証** | OAuth (全ワークスペース) | Integration Token (手動接続) | Remote MCP が圧倒的に楽 |
| **AI 横断検索** (Slack, Drive, Jira) | ✅ `notion-search` | ❌ (タイトル検索のみ) | Remote MCP 独自 |
| **ページ取得** | ✅ `notion-fetch` | ✅ GET /v1/pages + /v1/blocks | |
| **ページ作成** | ✅ `notion-create-pages` | ✅ POST /v1/pages | |
| **ページ更新** | ✅ `notion-update-page` | ✅ PATCH /v1/pages | |
| **ページ移動** | ✅ `notion-move-pages` | ✅ POST /v1/pages/move | |
| **ページ複製** | ✅ `notion-duplicate-page` | ❌ | Remote MCP 独自 |
| **DB 作成** | ✅ `notion-create-database` | ✅ POST /v1/databases | |
| **データソース更新** | ✅ `notion-update-data-source` | ✅ PATCH /v1/data_sources | |
| **ビュー作成** | ✅ `notion-create-view` | ❌ | Remote MCP 独自 |
| **ビュー更新** | ✅ `notion-update-view` | ❌ | Remote MCP 独自 |
| **AI 要約クエリ** | ✅ `notion-query-data-sources` | ❌ | Enterprise + AI |
| **ビュークエリ** | ✅ `notion-query-database-view` | ❌ | Business + AI |
| **コメント作成** | ✅ `notion-create-comment` | ✅ POST /v1/comments | |
| **コメント取得** | ✅ `notion-get-comments` | ✅ GET /v1/comments | |
| **Teams** | ✅ `notion-get-teams` | ❌ | Remote MCP 独自 |
| **Users** | ✅ | ✅ | |
| **Markdown API** | ✅ (fetch/update 内) | ✅ GET/PATCH /v1/pages/markdown | |
| **Block 直接操作** | ❌ (fetch 経由) | ✅ (CRUD) | ntn のみ |
| **ファイルアップロード** | ❌ (ロードマップ) | ✅ `ntn files` | ntn のみ |
| **Workers** | ❌ | ✅ `ntn workers` | ntn のみ |

