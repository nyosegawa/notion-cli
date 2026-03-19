import { describe, expect, it, vi } from "vitest";
import { CliError, formatError, isRateLimitError, withRetry } from "./errors.js";

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
