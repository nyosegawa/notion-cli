import { describe, expect, it, vi } from "vitest";
import {
	CliError,
	formatError,
	isRateLimitError,
	restErrorToCliError,
	withRetry,
} from "./errors.js";

describe("CliError", () => {
	it("stores what, why, hint fields", () => {
		const err = new CliError("Page not found", "The page ID is invalid", "Check the page URL");
		expect(err.what).toBe("Page not found");
		expect(err.why).toBe("The page ID is invalid");
		expect(err.hint).toBe("Check the page URL");
		expect(err.message).toBe("Page not found");
	});

	it("works without hint", () => {
		const err = new CliError("Failed", "Unknown");
		expect(err.hint).toBeUndefined();
	});
});

describe("formatError", () => {
	it("formats CliError with all fields", () => {
		const err = new CliError("Page not found", "ID is invalid", "Run ncli search first");
		const output = formatError(err);
		expect(output).toContain("Page not found");
		expect(output).toContain("ID is invalid");
		expect(output).toContain("Run ncli search first");
	});

	it("formats CliError without hint", () => {
		const err = new CliError("Failed", "Server error");
		const output = formatError(err);
		expect(output).toContain("Failed");
		expect(output).toContain("Server error");
		expect(output).not.toContain("Hint:");
	});

	it("formats generic Error", () => {
		const err = new Error("something broke");
		const output = formatError(err);
		expect(output).toContain("something broke");
	});

	it("formats non-Error values", () => {
		const output = formatError("string error");
		expect(output).toContain("string error");
	});
});

describe("isRateLimitError", () => {
	it("detects rate limit from error message", () => {
		expect(isRateLimitError(new Error("rate limit exceeded"))).toBe(true);
		expect(isRateLimitError(new Error("Rate Limit"))).toBe(true);
		expect(isRateLimitError(new Error("429 Too Many Requests"))).toBe(true);
	});

	it("returns false for other errors", () => {
		expect(isRateLimitError(new Error("not found"))).toBe(false);
		expect(isRateLimitError(new Error("unauthorized"))).toBe(false);
	});

	it("returns false for non-Error values", () => {
		expect(isRateLimitError("string")).toBe(false);
		expect(isRateLimitError(null)).toBe(false);
	});
});

describe("withRetry", () => {
	it("returns result on first success", async () => {
		const fn = vi.fn().mockResolvedValue("ok");
		const result = await withRetry(fn);
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("retries on rate limit error and succeeds", async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error("rate limit exceeded"))
			.mockResolvedValue("ok");
		const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 0 });
		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(2);
	});

	it("throws after max retries exhausted", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));
		await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 0 })).rejects.toThrow("rate limit");
		expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
	});

	it("does not retry non-rate-limit errors", async () => {
		const fn = vi.fn().mockRejectedValue(new Error("not found"));
		await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 0 })).rejects.toThrow("not found");
		expect(fn).toHaveBeenCalledTimes(1);
	});
});

describe("restErrorToCliError", () => {
	const makeApiError = (status: number, code: string, message: string) => ({
		object: "error" as const,
		status,
		code,
		message,
	});

	it("maps 401 to auth hint", () => {
		const err = restErrorToCliError(401, makeApiError(401, "unauthorized", "API token is invalid"));
		expect(err.what).toBe("REST API authentication failed");
		expect(err.hint).toContain("NOTION_API_KEY");
	});

	it("maps 403 to access denied hint", () => {
		const err = restErrorToCliError(403, makeApiError(403, "restricted_resource", "Not allowed"));
		expect(err.what).toBe("REST API access denied");
		expect(err.hint).toContain("integration");
	});

	it("maps 404 to not found hint", () => {
		const err = restErrorToCliError(
			404,
			makeApiError(404, "object_not_found", "Could not find page"),
		);
		expect(err.what).toBe("REST API resource not found");
		expect(err.hint).toContain("integration may not have access");
	});

	it("maps 429 to rate limit hint", () => {
		const err = restErrorToCliError(429, makeApiError(429, "rate_limited", "Rate limited"));
		expect(err.what).toBe("REST API rate limited");
		expect(err.hint).toContain("retry");
	});

	it("maps validation_error code", () => {
		const err = restErrorToCliError(
			400,
			makeApiError(400, "validation_error", "Title is required"),
		);
		expect(err.what).toBe("REST API validation error");
		expect(err.hint).toContain("required fields");
	});

	it("maps unknown errors with status", () => {
		const err = restErrorToCliError(
			500,
			makeApiError(500, "internal_server_error", "Server error"),
		);
		expect(err.what).toBe("REST API error (500)");
		expect(err.hint).toBeUndefined();
	});
});
