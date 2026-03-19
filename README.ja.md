# ncli

[![npm version](https://img.shields.io/npm/v/@sakasegawa/ncli)](https://www.npmjs.com/package/@sakasegawa/ncli)
[![license](https://img.shields.io/npm/l/@sakasegawa/ncli)](./LICENSE)
[![node](https://img.shields.io/node/v/@sakasegawa/ncli)](https://nodejs.org/)

> **免責事項:** ncli は非公式のコミュニティ製ツールです。Notion Labs, Inc. による開発・推奨・サポートは受けていません。

**[English](./README.md)**

[Remote Notion MCP](https://mcp.notion.com/mcp) の CLI ラッパー — ターミナルから Notion を読み書きできます。

人間とコーディングエージェント（Claude Code, Codex 等）の両方に最適化。出力はすべて構造化 JSON、エラーにはリカバリーヒント付き。

## 特徴

- Notion ワークスペースへのフルアクセス: 検索、ページ、データベース、ビュー、コメント、ユーザー、チーム、ミーティングノート
- 固定 schema の beads 用 DB を同期する `ncli beads` ワークフロー
- OAuth 2.0 + PKCE 認証（ブラウザベース、設定不要）
- Agent-first 設計: `--json` 出力、構造化エラーヒント（What + Why + Hint）
- エスケープハッチ: `ncli api <tool> [json]` で MCP ツールを直接呼び出し
- 単一バンドル ESM バイナリ、Node.js >= 18

## インストール

```bash
npm install -g @sakasegawa/ncli
```

## クイックスタート

```bash
# 認証（ブラウザが開きます、初回のみ）
ncli login

# 検索と取得
ncli search "プロジェクト計画"
ncli fetch <id>

# ページの作成・更新
ncli page create --title "新しいページ" --parent <page-id>
ncli page update <id> --prop "Status=Done"

# データベースワークフロー
ncli db create --title "タスク管理" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"
ncli page create --parent collection://<ds-id> \
  --title "タスク1" --prop "Status=Open"

# Beads ワークフロー
ncli beads status --database-id <db-id> --view-url "view://<view-id>"
ncli beads pull --view-url "view://<view-id>"
ncli beads push --database-id <db-id> --view-url "view://<view-id>" --input issues.json
```

## コマンド一覧

| コマンド | 説明 |
|---|---|
| `ncli login` | OAuth で Notion にログイン |
| `ncli logout` | Notion からログアウト |
| `ncli whoami` | 現在のユーザー情報を表示 |
| `ncli search <query>` | ワークスペース内のページ・DB・ユーザーを検索 |
| `ncli fetch <url-or-id>` | URL または ID でページ・DB・データソースを取得 |
| `ncli beads status` | 認証、DB 接続、beads schema の準備状態を確認 |
| `ncli beads pull` | 専用 Notion beads view を beads 向け issue JSON に正規化 |
| `ncli beads push` | beads issue JSON から Notion 行を作成・更新 |
| `ncli page create` | ページを作成（`--title`, `--parent`, `--prop`, `--body`） |
| `ncli page update <id>` | ページのプロパティまたはコンテンツを更新 |
| `ncli page move <id...> --to <parent>` | ページを別の親に移動 |
| `ncli page duplicate <id>` | ページを複製 |
| `ncli db create` | データベースを作成（`--title`, `--parent`, `--prop`, `--schema`） |
| `ncli db update <id>` | データベースのスキーマ・メタデータを更新 |
| `ncli db query <view-url>` | データベースビューをクエリ |
| `ncli view create` | データベースビューを作成（`--data` で指定） |
| `ncli view update` | データベースビューを更新（`--data` で指定） |
| `ncli comment create <id>` | ページにコメントを追加 |
| `ncli comment list <id>` | ページのコメント一覧を取得 |
| `ncli user list` | ワークスペースのユーザーを一覧・検索 |
| `ncli team list` | ワークスペースのチームを一覧・検索 |
| `ncli meeting-notes query` | ミーティングノートをフィルタ付きでクエリ |
| `ncli api <tool> [json]` | MCP ツールを直接呼び出し（エスケープハッチ） |

`ncli <command> --help` で詳細な使い方、例、ヒントを確認できます。

## よくあるワークフロー

### 検索 → 取得 → 更新

```bash
ncli search "プロジェクト計画"                # ページ・DB を検索
ncli fetch <id>                              # 内容とメタデータを取得
ncli page update <id> --prop "Status=Done"   # プロパティを更新
```

### データベース作成 → エントリ追加 → クエリ

```bash
# ページ配下にデータベースを作成
ncli db create --title "タスク管理" --parent <page-id> \
  --prop "Name:title" --prop "Status:select=Open,Done"

# レスポンスから data_source_id (collection://...) を取得
# その ID を使ってエントリを作成
ncli page create --parent collection://<ds-id> \
  --title "タスク1" --prop "Status=Open"

# ビューを作成してクエリ
ncli view create --data '{"database_id":"<db-id>","data_source_id":"collection://<ds-id>","type":"table","name":"全件"}'
ncli db query "https://www.notion.so/<db-id>?v=<view-id>"
```

### 専用 Beads DB を同期する

`ncli beads` は任意の Notion DB を汎用マッピングするのではなく、固定 schema の beads 用 DB を前提にします。

必須プロパティ:

- `Name`
- `Beads ID`
- `Status` (`Open`, `In Progress`, `Blocked`, `Deferred`, `Closed`)
- `Priority` (`Critical`, `High`, `Medium`, `Low`, `Backlog`)
- `Type` (`Bug`, `Feature`, `Task`, `Epic`, `Chore`)
- `Description`

任意プロパティ:

- `Assignee`
- `Labels`

```bash
# 接続と schema を確認
ncli beads status --database-id <db-id> --view-url "view://<view-id>" --json

# 正規化された issue JSON を pull
ncli beads pull --view-url "view://<view-id>" --json

# issue JSON を Notion に push ("Beads ID" でマッチ)
echo '{"issues":[{"id":"bd-1","title":"Fix login","status":"open"}]}' | \
  ncli beads push --database-id <db-id> --view-url "view://<view-id>" --input -
```

`push` は `Beads ID` をキーに冪等に create/update します。v1 では delete/archive や page body 同期は行いません。

### stdin からコンテンツをパイプ

```bash
echo "# 議事録" | ncli page create --title "ミーティングノート" --parent <id> --body -
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
- **データベース操作**: 必ず先に `ncli fetch <db-id>` で `data_source_id` を取得

エラー例:
```
Error: notion-create-pages failed
  Why: Could not find page with ID: abc123...
  Hint: If adding to a database, use --data with "parent":{"data_source_id":"<ds-id>",...}.
        Run "ncli fetch <db-id>" to get the data_source_id
```

## エスケープハッチ

高度な操作や未対応の操作には、MCP ツールを直接呼び出せます:

```bash
ncli api notion-search '{"query":"test","page_size":3}'
echo '{"query":"test"}' | ncli api notion-search
```

## 動作要件

- Node.js >= 18
- Notion アカウント（ブラウザ経由の OAuth 認証）

## 法的情報

- [利用規約](TERMS.md)
- [プライバシーポリシー](PRIVACY.md)

## ライセンス

MIT
