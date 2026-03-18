import http from "node:http";
import { URL } from "node:url";
import { AUTH_TIMEOUT_MS, CALLBACK_PATH } from "../util/config.js";
import { CliError } from "../util/errors.js";

const SUCCESS_HTML = `<!DOCTYPE html>
<html><body>
<h1>Authorization Successful</h1>
<p>You can close this tab and return to the terminal.</p>
</body></html>`;

export class CallbackServer {
	private server: http.Server | null = null;
	private _port = 0;

	get port(): number {
		return this._port;
	}

	waitForCallback(timeoutMs = AUTH_TIMEOUT_MS): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			const server = http.createServer((req, res) => {
				if (!req.url) return;

				const url = new URL(req.url, `http://localhost:${this._port}`);
				if (url.pathname !== CALLBACK_PATH) {
					res.writeHead(404);
					res.end("Not Found");
					return;
				}

				const code = url.searchParams.get("code");
				const error = url.searchParams.get("error");

				if (error) {
					const description = url.searchParams.get("error_description") || error;
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end(`<h1>Authorization Failed</h1><p>${description}</p>`);
					reject(
						new CliError("OAuth authorization failed", description, "Run notion login to retry"),
					);
					return;
				}

				if (!code) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end("<h1>Missing authorization code</h1>");
					reject(
						new CliError(
							"Missing authorization code",
							"OAuth callback did not include a code parameter",
							"Run notion login to retry",
						),
					);
					return;
				}

				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(SUCCESS_HTML);
				resolve(code);
			});

			this.server = server;

			server.listen(0, "127.0.0.1", () => {
				const addr = server.address();
				if (addr && typeof addr === "object") {
					this._port = addr.port;
				}
			});

			const timer = setTimeout(() => {
				reject(
					new CliError(
						"OAuth callback timed out",
						`No response received within ${timeoutMs / 1000} seconds`,
						"Run notion login to retry",
					),
				);
				this.stop();
			}, timeoutMs);

			server.on("close", () => clearTimeout(timer));
		});
	}

	stop(): void {
		if (this.server) {
			this.server.close();
			this.server = null;
		}
	}
}
