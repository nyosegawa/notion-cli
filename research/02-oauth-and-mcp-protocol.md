# OAuth 2.0 + PKCE フローと MCP プロトコル詳細

## 1. OAuth 2.0 認証フロー

### Step 1: OAuth Discovery

2段階のメタデータ発見（RFC 9470 → RFC 8414）。

**1A. Protected Resource Metadata (RFC 9470):**

```
GET https://mcp.notion.com/.well-known/oauth-protected-resource

Response:
{
  "authorization_servers": ["https://..."]
}
```

**1B. Authorization Server Metadata (RFC 8414):**

```
GET {authorization_server}/.well-known/oauth-authorization-server

Response:
{
  "issuer": "string",
  "authorization_endpoint": "string",
  "token_endpoint": "string",
  "registration_endpoint": "string",   // Dynamic Client Registration用
  "code_challenge_methods_supported": ["S256"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "response_types_supported": ["code"],
  "scopes_supported": ["string"]
}
```

MCP仕様: MCPサーバーURLからpath部分を除去したものがauthorization base URL。
`https://mcp.notion.com/mcp` → `https://mcp.notion.com`

フォールバック（メタデータ発見が404の場合）:
- Authorization: `/authorize`
- Token: `/token`
- Registration: `/register`

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md
> Source: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization

### Step 2: PKCE パラメータ生成

```typescript
import { randomBytes, createHash } from "crypto"

function base64URLEncode(str: Buffer): string {
  return str.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")
}

function generateCodeVerifier(): string {
  return base64URLEncode(randomBytes(32))  // 32 bytes → ~43 chars
}

function generateCodeChallenge(verifier: string): string {
  return base64URLEncode(createHash("sha256").update(verifier).digest())
}
```

PKCE は全クライアントで**必須**（MCP仕様）。S256 メソッドのみ。

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md
> Source: RFC 7636

### Step 3: Dynamic Client Registration (RFC 7591)

```
POST {registration_endpoint}
Content-Type: application/json

{
  "client_name": "notion-cli",
  "redirect_uris": ["http://localhost:PORT/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}

Response:
{
  "client_id": "string",
  "client_secret": "string (optional)",
  "client_id_issued_at": number,
  "client_secret_expires_at": number
}
```

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

### Step 4: 認可URL構築

| パラメータ | 値 | 備考 |
|---|---|---|
| `response_type` | `code` | 必須 |
| `client_id` | 登録済みID | 必須 |
| `redirect_uri` | HTTPS URL (本番) / localhost (開発) | 登録と一致必須 |
| `scope` | スペース区切り | 任意だが推奨 |
| `state` | ランダム32バイトhex | CSRF防止、必須 |
| `code_challenge` | Base64url SHA256 | PKCE |
| `code_challenge_method` | `S256` | 必須 |
| `prompt` | `consent` | 推奨 |

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

### Step 5: コールバック処理

認可コードは単回使用、通常10分で失効。
- `?code=...&state=...` → state検証 → コード取得
- `?error=...&error_description=...` → エラーハンドリング

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

### Step 6: トークン交換

```
POST {token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code={authorization_code}
&client_id={client_id}
&redirect_uri={redirect_uri}
&code_verifier={code_verifier}

Response:
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "string",
  "scope": "string"
}
```

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

## 2. トークン管理

### Notion 固有の挙動 (Cloudflare workers-oauth-provider)

- **アクセストークン失効**: 1時間 (3600秒)
- **リフレッシュトークンローテーション**: 任意時点で最大2つの有効リフレッシュトークンが存在可能。使用すると古い方が無効化され、新しいトークンが発行される。
- **`invalid_grant` エラー**: 再認証が必要
  - 原因: ローテーション後の古いトークン使用、トークン失効、認証情報不一致、ユーザーによるアクセス取消、並行リフレッシュ
- **運用ガイダンス**: 失効5-10分前にプロアクティブにリフレッシュ

### トークンリフレッシュ

```
POST {token_endpoint}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={client_id}
```

新しい `refresh_token` が返された場合は必ず保存すること。

> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

## 3. MCP トランスポートプロトコル

### Streamable HTTP (推奨)

サーバーは単一HTTPエンドポイントでPOSTとGETをサポート。

**POST (クライアント→サーバー):**
- JSON-RPC メッセージを送信
- `Accept: application/json, text/event-stream` ヘッダー必須
- レスポンス: `Content-Type: application/json` または `text/event-stream` (SSEストリーム)

**GET (サーバー→クライアント通知):**
- SSEストリームを開きサーバー起点のメッセージを受信
- `Accept: text/event-stream` ヘッダー必須

**セッション管理:**
- サーバーが InitializeResult レスポンスで `Mcp-Session-Id` を返す
- 以降の全リクエストにこのヘッダーを含める
- セッション切れ: 404 → 新規セッション開始

**再接続:**
- SSE イベントに `id` フィールド付与 → `Last-Event-ID` で再開可能
- デフォルト指数バックオフ: `delay = min(100ms * 1.5^attempts, 30000ms) ± jitter`

> Source: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
> Source: https://developers.notion.com/guides/mcp/build-mcp-client.md

## 4. MCP 初期化ライフサイクル

### Initialize Request (クライアント→サーバー)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "roots": {}, "sampling": {} },
    "clientInfo": { "name": "notion-cli", "version": "1.0.0" }
  }
}
```

### Initialize Response (サーバー→クライアント)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "capabilities": { "tools": { "listChanged": true } },
    "serverInfo": { "name": "NotionMCP", "version": "..." },
    "instructions": "..."
  }
}
```

### Initialized Notification (クライアント→サーバー)

```json
{ "jsonrpc": "2.0", "method": "notifications/initialized" }
```

> Source: https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle

## 5. ツール呼び出しプロトコル

### tools/list

```json
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": { "cursor": "optional" } }

// Response
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "tools": [{
      "name": "notion-search",
      "description": "...",
      "inputSchema": { "type": "object", "properties": {...}, "required": [...] }
    }],
    "nextCursor": "..."
  }
}
```

パラメータの JSON Schema は `tools/list` で**動的取得**する（ドキュメント非公開）。

### tools/call

```json
// Request
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call",
  "params": { "name": "notion-search", "arguments": { "query": "..." } } }

// Response (成功)
{ "jsonrpc": "2.0", "id": 2,
  "result": { "content": [{ "type": "text", "text": "..." }], "isError": false } }

// Response (ツール実行エラー)
{ "jsonrpc": "2.0", "id": 2,
  "result": { "content": [{ "type": "text", "text": "Error: ..." }], "isError": true } }

// Response (プロトコルエラー)
{ "jsonrpc": "2.0", "id": 2,
  "error": { "code": -32602, "message": "Unknown tool: ..." } }
```

> Source: https://modelcontextprotocol.io/specification/2025-03-26/server/tools

## 6. セキュリティ要件

### MCP仕様

- PKCE 必須 (S256)
- 全認証エンドポイントは HTTPS
- リダイレクト URI は localhost または HTTPS
- `Origin` ヘッダー検証 (DNS rebinding 防止)
- 無効/失効トークン → HTTP 401

### Notion 固有

- `https://mcp.notion.com/mcp` または `https://mcp.notion.com/sse` のみ信頼
- MCP 接続時、AI システムにユーザーの Notion アカウント権限と同等のアクセスを付与
- プロンプトインジェクションリスク: 悪意ある指示でプライベートページのコピーが起こり得る
- トークンは暗号化して保存

> Source: https://developers.notion.com/guides/mcp/mcp-security-best-practices.md
> Source: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
