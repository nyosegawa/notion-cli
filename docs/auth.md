# Authentication

## 概要

OAuth 2.0 + PKCE で Remote Notion MCP に認証。MCP SDK の内蔵 OAuth フローを活用。

## 認証フロー

### 初回（自動トリガー or `ncli login`）

```
ncli search "hello"
  │
  ▼
MCPConnection.connect()
  ├── client.json の redirect_uris からポート導出
  ├── CallbackServer.start(savedPort) → ポート確定
  │   ├── savedPort あり → そのポートで listen (競合時は listen(0) にフォールバック)
  │   └── savedPort なし → listen(0) でランダムポート
  ├── ポート不一致 → client.json 破棄 (再登録)
  ├── StreamableHTTPClientTransport + OAuthClientProvider 作成
  ├── client.connect(transport) → POST to https://mcp.notion.com/mcp
  │
  ├── 401 Unauthorized
  │   ├── SDK: OAuth Discovery (RFC 9470 → RFC 8414)
  │   ├── SDK: Dynamic Client Registration (RFC 7591)
  │   ├── SDK: PKCE 生成 (S256)
  │   ├── provider.saveClientInformation() → client.json に保存
  │   ├── provider.saveCodeVerifier() → auth-state.json に保存
  │   └── provider.redirectToAuthorization(url)
  │       └── ブラウザで認可 URL を開く (サーバーは起動済み)
  │
  ├── UnauthorizedError throw → MCPConnection がキャッチ
  │
  ├── コールバック待機 (120s timeout)
  │   └── http://localhost:PORT/callback?code=... 受信
  │
  ├── transport.finishAuth(code)
  │   ├── SDK: code → token 交換
  │   └── provider.saveTokens() → tokens.json に保存 (0o600)
  │
  └── 新 transport で再接続 → セッション確立
```

### 2回目以降

```
ncli search "hello"
  │
  ▼
MCPConnection.connect()
  ├── provider.tokens() → tokens.json から読み込み
  ├── Authorization: Bearer <access_token> で POST
  │
  ├── 200 → セッション確立、コマンド実行
  ├── 401 + refresh_token あり → SDK が自動リフレッシュ → リトライ
  └── 401 + invalid_grant → 再認証フロー（初回と同じ）
```

## トークン保存

`env-paths` で OS 適切なパスを取得:

```
macOS:  ~/Library/Preferences/ncli/
Linux:  ~/.config/ncli/
Windows: %APPDATA%\ncli\Config\

├── client.json           # OAuth client registration (client_id, redirect_uris, etc.)
├── tokens.json           # access_token, refresh_token, expires_at
└── auth-state.json       # codeVerifier (一時、logout 時にクリア)
```

全ファイル `0o600` (owner read/write only)。

## Notion 固有の挙動

- **アクセストークン失効**: 1時間
- **リフレッシュトークンローテーション**: 使用すると古いトークンが無効化、新しいものが発行
- **`invalid_grant`**: 再認証が必要（トークン失効、並行リフレッシュ、ユーザー取消等）

## OAuthClientProvider 実装ポイント

SDK の `OAuthClientProvider` インターフェースを実装する。主要メソッド:

| メソッド | 実装 |
|---|---|
| `redirectUrl` | `http://127.0.0.1:{port}/callback` (保存済みポート or ランダム) |
| `clientMetadata` | `{ client_name: "ncli", grant_types: [...], token_endpoint_auth_method: "none" }` |
| `tokens()` / `saveTokens()` | TokenStore 経由で tokens.json を読み書き |
| `clientInformation()` / `saveClientInformation()` | TokenStore 経由で client.json を読み書き |
| `redirectToAuthorization(url)` | `open(url)` (CallbackServer は事前に起動済み) |
| `codeVerifier()` / `saveCodeVerifier()` | TokenStore 経由で auth-state.json を読み書き |
| `invalidateCredentials()` | 未実装 (SDK が呼ぶが no-op。logout は TokenStore.deleteAll() で処理) |

`CallbackServer` は `MCPConnection` が所有し、provider に参照を渡す（共有状態パターン）。

## コールバックポートの再利用

Dynamic Client Registration で登録される `redirect_uris` にはコールバックサーバーのポートが含まれる。`client.json` にキャッシュされた `client_id` を再利用する場合、同じポートで listen しないと OAuth サーバーが redirect_uri 不一致で拒否する。

**対策**: `connect()` が `client.json` の `redirect_uris` からポートを導出し、同じポートで `CallbackServer.start()` を呼ぶ。追加のファイルは不要。

- ポート競合時は `listen(0)` にフォールバックし、`client.json` を破棄して再登録
- `redirect_uris` がない（旧バージョンの `client.json`）場合はランダムポートで起動し、ポート不一致で自動再登録

## REST API 認証

### 概要

REST API コマンド (`ncli rest`, `ncli file`) は Integration Token (Bearer token) で認証。
MCP の OAuth とは別系統。

### トークン解決順序

1. `NOTION_API_KEY` 環境変数（最優先 — CI/CD・エージェント向け）
2. `rest-token.json` ファイル (`CONFIG_DIR` 内)
3. エラー + ヒント: `Set NOTION_API_KEY or run "ncli rest login"`

### トークン保存

```
macOS:  ~/Library/Preferences/ncli/rest-token.json
Linux:  ~/.config/ncli/rest-token.json
```

ファイル権限 `0o600` (owner read/write only)。

### MCP 認証との違い

| 項目 | MCP (OAuth) | REST API (Token) |
|---|---|---|
| 認証方式 | OAuth 2.0 + PKCE | Integration Token (Bearer) |
| セットアップ | `ncli login` (ブラウザ) | `ncli rest login` or `NOTION_API_KEY` env var |
| トークン | access_token + refresh_token | 単一の integration token |
| 自動リフレッシュ | ✅ (SDK 内蔵) | ❌ (トークンは無期限) |
| 用途 | 検索、ページ、DB、ビュー等 | 任意の REST API 呼び出し、ファイルアップロード |
