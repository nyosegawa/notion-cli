# @sakasegawa/notion-cli

[![npm version](https://img.shields.io/npm/v/@sakasegawa/notion-cli)](https://www.npmjs.com/package/@sakasegawa/notion-cli)
[![license](https://img.shields.io/npm/l/@sakasegawa/notion-cli)](./LICENSE)
[![node](https://img.shields.io/node/v/@sakasegawa/notion-cli)](https://nodejs.org/)

**[English](./README.md)**

[Remote Notion MCP](https://mcp.notion.com/mcp) の CLI ラッパー — ターミナルから Notion を読み書きできます。

人間とコーディングエージェント（Claude Code, Codex 等）の両方に最適化。出力はすべて構造化 JSON、エラーにはリカバリーヒント付き。

## 特徴

- Notion ワークスペースへのフルアクセス: 検索、ページ、データベース、ビュー、コメント、ユーザー、チーム、ミーティングノート
- OAuth 2.0 + PKCE 認証（ブラウザベース、設定不要）
- Agent-first 設計: `--json` 出力、構造化エラーヒント（What + Why + Hint）
- エスケープハッチ: `notion api <tool> [json]` で MCP ツールを直接呼び出し
- 単一バンドル ESM バイナリ、Node.js >= 18

## インストール

```bash
npm install -g @sakasegawa/notion-cli
```

## クイックスタート

```bash
# 認証（ブラウザが開きます、初回のみ）
notion login

# 検索と取得
notion search "プロジェクト計画"
notion fetch <id>

# ページの作成・更新
notion page create --title "新しいページ" --parent <page-id>
notion page update <id> --prop "Status=Done"

# データベースワークフロー
notion db create --title "タスク管理" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"
notion page create --parent collection://<ds-id> \
  --title "タスク1" --prop "Status=Open"
```

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `notion login` | OAuth で Notion にログイン |
| `notion logout` | Notion からログアウト |
| `notion whoami` | 現在のユーザー情報を表示 |
| `notion search <query>` | ワークスペース内のページ・DB・ユーザーを検索 |
| `notion fetch <url-or-id>` | URL または ID でページ・DB・データソースを取得 |
| `notion page create` | ページを作成（`--title`, `--parent`, `--prop`, `--body`） |
| `notion page update <id>` | ページのプロパティまたはコンテンツを更新 |
| `notion page move <id...> --to <parent>` | ページを別の親に移動 |
| `notion page duplicate <id>` | ページを複製 |
| `notion db create` | データベースを作成（`--title`, `--parent`, `--prop`, `--schema`） |
| `notion db update <id>` | データベースのスキーマ・メタデータを更新 |
| `notion db query <view-url>` | データベースビューをクエリ |
| `notion view create` | データベースビューを作成（`--data` で指定） |
| `notion view update` | データベースビューを更新（`--data` で指定） |
| `notion comment create <id>` | ページにコメントを追加 |
| `notion comment list <id>` | ページのコメント一覧を取得 |
| `notion user list` | ワークスペースのユーザーを一覧・検索 |
| `notion team list` | ワークスペースのチームを一覧・検索 |
| `notion meeting-notes query` | ミーティングノートをフィルタ付きでクエリ |
| `notion api <tool> [json]` | MCP ツールを直接呼び出し（エスケープハッチ） |

`notion <command> --help` で詳細な使い方、例、ヒントを確認できます。

## よくあるワークフロー

### 検索 → 取得 → 更新

```bash
notion search "プロジェクト計画"                # ページ・DB を検索
notion fetch <id>                              # 内容とメタデータを取得
notion page update <id> --prop "Status=Done"   # プロパティを更新
```

### データベース作成 → エントリ追加 → クエリ

```bash
# ページ配下にデータベースを作成
notion db create --title "タスク管理" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# レスポンスから data_source_id (collection://...) を取得
# その ID を使ってエントリを作成
notion page create --parent collection://<ds-id> \
  --title "タスク1" --prop "Status=Open"

# ビューを作成してクエリ
notion view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"全件"}'
notion db query "https://www.notion.so/<db-id>?v=<view-id>"
```

### stdin からコンテンツをパイプ

```bash
echo "# 議事録" | notion page create --title "ミーティングノート" --parent <id> --body -
```

## グローバルフラグ

| フラグ | 説明 |
|---|---|
| `--json` | JSON 形式で出力（構造化、パース可能） |
| `--raw` | MCP の生レスポンスを出力（サーバーペイロード全体） |
| `--verbose` | 詳細出力 |
| `--no-color` | カラー表示を無効化 |

## エージェント向けの使い方

この CLI はコーディングエージェントに最適化されています:

- **`--json` を使う** — 構造化された、パース可能な出力
- **エラーにリカバリーヒント付き** — 何が起きたか、なぜ起きたか、次に何をすべきか
- **ワークフロー**: `search` → `fetch`（ID・スキーマ取得）→ `create`/`update`/`query`
- **データベース操作**: 必ず先に `notion fetch <db-id>` で `data_source_id` を取得

エラー例:
```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --data with "parent":{"data_source_id":"<ds-id>",...}.
        Run "notion fetch <db-id>" to get the data_source_id
```

## エスケープハッチ

高度な操作や未対応の操作には、MCP ツールを直接呼び出せます:

```bash
notion api notion-search '{"query":"test","page_size":3}'
echo '{"query":"test"}' | notion api notion-search
```

## 動作要件

- Node.js >= 18
- Notion アカウント（ブラウザ経由の OAuth 認証）

## ライセンス

MIT
