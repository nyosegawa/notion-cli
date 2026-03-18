# MCP SDK とエコシステム調査

## 1. MCP TypeScript SDK

### パッケージ情報

- **v1 (現行)**: `@modelcontextprotocol/sdk` v1.27.1
  - 17 dependencies, 4.2 MB
  - Node.js 16+ 対応
- **v2 (プレアルファ)**: `@modelcontextprotocol/client`, `@modelcontextprotocol/server`, `@modelcontextprotocol/core`
  - zod v4 peer dependency
  - Node.js 20+ 必須, ESM-only
  - 2026年3月時点で npm 未公開

> Source: https://www.npmjs.com/package/@modelcontextprotocol/sdk
> Source: https://github.com/modelcontextprotocol/typescript-sdk

### クライアント API (v1)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// クライアント作成
const client = new Client(
  { name: 'notion-cli', version: '1.0.0' },
  { capabilities: {} }
);

// Streamable HTTP 接続 (推奨)
const transport = new StreamableHTTPClientTransport(
  new URL('https://mcp.notion.com/mcp'),
  {
    authProvider: oauthProvider,   // OAuthClientProvider
    reconnectionOptions: {
      initialDelayMs: 100,
      maxDelayMs: 30000,
      backoffMultiplier: 1.5,
      jitterFraction: 0.1
    }
  }
);
await client.connect(transport);

// ツール一覧
const { tools } = await client.request(
  { method: 'tools/list', params: {} },
  ListToolsResultSchema
);

// ツール呼び出し
const result = await client.request(
  { method: 'tools/call', params: { name: 'notion-search', arguments: { query: '...' } } },
  CallToolResultSchema
);
```

> Source: https://github.com/modelcontextprotocol/typescript-sdk
> Source: https://modelcontextprotocol.io/docs/develop/build-client

### OAuthClientProvider インターフェース

```typescript
export interface OAuthClientProvider {
  get redirectUrl(): string | URL | undefined;
  get clientMetadata(): OAuthClientMetadata;
  clientInformation(): OAuthClientInformationMixed | undefined | Promise<...>;
  saveClientInformation?(info: OAuthClientInformationMixed): void | Promise<void>;
  tokens(): OAuthTokens | undefined | Promise<...>;
  saveTokens(tokens: OAuthTokens): void | Promise<void>;
  redirectToAuthorization(authorizationUrl: URL): void | Promise<void>;
  saveCodeVerifier(codeVerifier: string): void | Promise<void>;
  codeVerifier(): string | Promise<string>;
  // 以下オプショナル
  state?(): string | Promise<string>;
  clientMetadataUrl?: string;
  addClientAuthentication?: AddClientAuthentication;
  invalidateCredentials?(scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'): void | Promise<void>;
  saveAuthorizationServerUrl?(url: string): void | Promise<void>;
  authorizationServerUrl?(): string | undefined | Promise<...>;
  saveDiscoveryState?(state: OAuthDiscoveryState): void | Promise<void>;
  discoveryState?(): OAuthDiscoveryState | undefined | Promise<...>;
}
```

> Source: https://github.com/modelcontextprotocol/typescript-sdk (packages/client/src/client/auth.ts)

### OAuth フロー (SDK内蔵)

1. `client.connect(transport)` → サーバーへ POST
2. 401 → `auth()` が OAuth Discovery → Dynamic Client Registration → PKCE生成 → `provider.redirectToAuthorization(url)`
3. `UnauthorizedError` throw
4. 呼び出し側: ブラウザ開く + ローカルコールバックサーバー起動
5. ユーザー認証 → `http://localhost:PORT/callback?code=...`
6. `transport.finishAuth(code)` でトークン交換
7. 再接続: `await client.connect(newTransport)`
8. リフレッシュは自動。`InvalidGrantError` → 再認証フロー

> Source: https://github.com/modelcontextprotocol/typescript-sdk
> Source: https://deepwiki.com/modelcontextprotocol/inspector/3.5-authentication-and-oauth

### トランスポートフォールバックパターン

```typescript
async function connectWithFallback(url: URL, authProvider): Promise<Client> {
  const client = new Client({ name: 'notion-cli', version: '1.0.0' }, { capabilities: {} });
  try {
    const transport = new StreamableHTTPClientTransport(url, { authProvider });
    await client.connect(transport);
    return client;
  } catch (error) {
    const sseTransport = new SSEClientTransport(url);
    await client.connect(sseTransport);
    return client;
  }
}
```

> Source: https://github.com/modelcontextprotocol/typescript-sdk (docs/client.md)

## 2. 既存 MCP CLI ラッパーツール

### mcptools (github.com/f/mcptools) — 最も完成度が高い

- **言語**: Go
- **インストール**: `brew tap f/mcptools && brew install mcp`
- **Stars**: 1.5k
- **トランスポート**: stdio, HTTP SSE, Streamable HTTP (自動検出)
- **コマンド**: `tools`, `resources`, `prompts`, `call`, `shell`, `web`, `proxy`, `alias`
- **出力形式**: table (カラー), JSON, pretty JSON
- **エイリアス**: `$HOME/.mcpt/aliases.json` に保存

> Source: https://github.com/f/mcptools

### mcp-cli (@wong2/mcp-cli)

- **言語**: JavaScript
- **Stars**: 428
- **特徴**: インタラクティブ + 非インタラクティブモード
- **非インタラクティブ**: `npx @wong2/mcp-cli call-tool server:tool_name --args '{}'`
- **OAuth**: SSE/Streamable HTTP 対応
- **トークン管理**: `npx @wong2/mcp-cli purge` で保存トークン削除

> Source: https://github.com/wong2/mcp-cli

### mcp-client-toolkit (github.com/tileshq/mcp-client-toolkit)

- **言語**: TypeScript
- **アーキテクチャ**: 再利用可能ライブラリ + CLI

主要パターン:

```typescript
// MCPClient
const client = new MCPClient({ callbackPort: 8090, oauthHandler: new BrowserOAuthHandler(8090) });
await client.connect('http://localhost:3000/mcp');
const tools = await client.listTools();
const result = await client.callTool('tool-name', { param: 'value' });

// BrowserOAuthHandler
// - ブラウザを開く (open/xdg-open/start)
// - callbackPort で HTTP サーバー起動
// - 5分タイムアウト
// - "Authorization Successful" HTML を返す
```

> Source: https://github.com/tileshq/mcp-client-toolkit

### mcp-remote (npm)

STDIO 互換ブリッジ。Remote MCP を STDIO トランスポートに変換:

```json
{ "mcpServers": { "notion": { "command": "npx", "args": ["-y", "mcp-remote", "https://mcp.notion.com/mcp"] } } }
```

> Source: https://developers.notion.com/guides/mcp/common-mcp-clients.md

## 3. `ntn` CLI の認証方式 (参考)

- **パッケージ**: `ntn` v0.3.0, Node >= 22.0.0
- `ntn login` / `ntn logout` — Notion 内部認証 (Workers + Tokens 用)
- `ntn api` は `NOTION_API_TOKEN` 環境変数 (Integration Token) を使用
- **ソースコード非公開** (バンドル済み)

> Source: https://www.npmjs.com/package/ntn

