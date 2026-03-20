import fs from "node:fs";
import path from "node:path";
import { NOTION_API_BASE_URL, NOTION_API_VERSION } from "../util/config.js";
import { CliError, type RestApiError, restErrorToCliError } from "../util/errors.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const MIME_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
	".pdf": "application/pdf",
	".txt": "text/plain",
	".csv": "text/csv",
	".json": "application/json",
	".mp3": "audio/mpeg",
	".mp4": "video/mp4",
	".zip": "application/zip",
};

export function guessMimeType(fileName: string): string {
	const ext = path.extname(fileName).toLowerCase();
	return MIME_TYPES[ext] || "application/octet-stream";
}

export function buildRestUrl(basePath: string): string {
	const normalized = basePath.startsWith("/") ? basePath : `/${basePath}`;
	return `${NOTION_API_BASE_URL}${normalized}`;
}

export function buildRestHeaders(token: string, contentType?: string): Record<string, string> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${token}`,
		"Notion-Version": NOTION_API_VERSION,
	};
	if (contentType) {
		headers["Content-Type"] = contentType;
	}
	return headers;
}

export class NotionRestClient {
	constructor(private token: string) {}

	async request(
		method: HttpMethod,
		apiPath: string,
		body?: Record<string, unknown>,
	): Promise<Record<string, unknown>> {
		const url = buildRestUrl(apiPath);
		const headers = buildRestHeaders(this.token, body ? "application/json" : undefined);

		const response = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		const json = (await response.json()) as Record<string, unknown>;

		if (!response.ok) {
			throw restErrorToCliError(response.status, json as unknown as RestApiError);
		}

		return json;
	}

	async uploadFile(filePath: string, displayName?: string): Promise<Record<string, unknown>> {
		const absolutePath = path.resolve(filePath);
		if (!fs.existsSync(absolutePath)) {
			throw new CliError(
				"File not found",
				`The file "${filePath}" does not exist`,
				"Check the file path and try again",
			);
		}

		const fileBuffer = fs.readFileSync(absolutePath);
		const fileName = displayName || path.basename(absolutePath);
		const mimeType = guessMimeType(fileName);

		// Step 1: Create file upload
		const createResult = await this.request("POST", "/file_uploads", {
			mode: "single_part",
			filename: fileName,
			content_type: mimeType,
		});
		const fileUploadId = createResult.id as string;

		// Step 2: Send file content
		const formData = new FormData();
		formData.append("file", new Blob([fileBuffer], { type: mimeType }), fileName);

		const sendHeaders = buildRestHeaders(this.token);
		const sendResponse = await fetch(`${NOTION_API_BASE_URL}/file_uploads/${fileUploadId}/send`, {
			method: "POST",
			headers: sendHeaders,
			body: formData,
		});
		const sendResult = (await sendResponse.json()) as Record<string, unknown>;
		if (!sendResponse.ok) {
			throw restErrorToCliError(sendResponse.status, sendResult as unknown as RestApiError);
		}

		return sendResult;
	}
}
