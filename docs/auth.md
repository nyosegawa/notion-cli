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
  ├── client.json の redirect_uris からポート導出（保存のみ。ここでは listen しない）
  ├── StreamableHTTPClientTransport + OAuthClientProvider 作成
  ├── client.connect(transport) → POST to https://mcp.notion.com/mcp
  │
  ├── 401 Unauthorized
  │   ├── SDK: OAuth Discovery (RFC 9470 → RFC 8414)
  │   ├── provider.clientInformation()
  │   │   └── client.json なし → CallbackServer.start() → undefined を返す
  │   ├── SDK: Dynamic Client Registration (RFC 7591)
  │   ├── SDK: PKCE 生成 (S256)
  │   ├── provider.saveClientInformation() → client.json に保存
  │   ├── provider.saveCodeVerifier() → auth-state.json に保存
  │   └── provider.redirectToAuthorization(url)
  │       ├── callback 待機を開始
  │       └── ブラウザで認可 URL を開く
  │
  ├── UnauthorizedError throw → MCPConnection がキャッチ
  │
  ├── provider.waitForCallback() (120s timeout)
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
  ├── CallbackServer はまだ起動しない
  ├── provider.tokens() → tokens.json から読み込み
  ├── Authorization: Bearer <access_token> で POST
  │
  ├── 200 → セッション確立、コマンド実行
  ├── 401 → SDK auth flow 開始
  │   ├── provider.clientInformation() → 保存済み client info を返す（server 不起動）
  │   ├── refresh_token あり → SDK が自動リフレッシュ → リトライ
  │   ├── refresh 失敗 → InvalidGrantError → SDK が invalidateCredentials('tokens') 呼び出し
  │   ├── SDK が authInternal() を再実行
  │   │   └── provider.clientInformation() 2回目
  │   │       ├── CallbackServer.start(savedPort)
  │   │       ├── ポート一致 → 保存済み client info を返す
  │   │       └── ポート競合 → client.json 削除 → undefined 返す → 再登録
  │   └── browser auth → 起動済み callback port で認可
  └── token 交換 → セッション確立
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
| `redirectUrl` | `http://127.0.0.1:{port}/callback` (callback server 起動後のポート) |
| `clientMetadata` | `{ client_name: "ncli", grant_types: [...], token_endpoint_auth_method: "none" }` |
| `tokens()` / `saveTokens()` | TokenStore 経由で tokens.json を読み書き |
| `clientInformation()` / `saveClientInformation()` | TokenStore 経由で client.json を読み書き。初回・refresh 失敗後のみ CallbackServer を起動 |
| `redirectToAuthorization(url)` | callback 待機を開始してから `open(url)` |
| `codeVerifier()` / `saveCodeVerifier()` | TokenStore 経由で auth-state.json を読み書き |
| `invalidateCredentials()` | SDK の invalid client/grant 通知に応じて状態をクリア。`tokens` scope は refresh 失敗フラグを立てる |

`CallbackServer` は `MCPConnection` が所有し、provider に参照を渡す（共有状態パターン）。通常接続では起動せず、ブラウザ認可が必要な時だけ provider が起動する。

## コールバックポートの再利用

Dynamic Client Registration で登録される `redirect_uris` にはコールバックサーバーのポートが含まれる。`client.json` にキャッシュされた `client_id` を再利用してブラウザ認可に進む場合、同じポートで listen できると redirect_uri mismatch を避けられる。

**対策**: `connect()` は `client.json` の `redirect_uris` から保存済みポートを導出するが、通常接続では `CallbackServer` を起動しない。SDK が保存済み token で接続できる場合、callback port は不要。

- SDK が refresh 失敗した後に初めて `CallbackServer.start(savedPort)` を呼ぶ
- ポート一致 → 保存済み `client_id` でそのままブラウザ認可
- ポート競合 → `client.json` 削除、新ポートで Dynamic Client Registration し直す
- `redirect_uris` がない（旧バージョンの `client.json`）場合はランダムポートで起動

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
