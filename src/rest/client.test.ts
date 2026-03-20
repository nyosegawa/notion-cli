import { describe, expect, it } from "vitest";
import { buildRestHeaders, buildRestUrl } from "./client.js";

describe("buildRestUrl", () => {
	it("builds URL with leading slash", () => {
		expect(buildRestUrl("/pages/abc123")).toBe("https://api.notion.com/v1/pages/abc123");
	});

	it("adds leading slash if missing", () => {
		expect(buildRestUrl("pages/abc123")).toBe("https://api.notion.com/v1/pages/abc123");
	});

	it("handles root path", () => {
		expect(buildRestUrl("/")).toBe("https://api.notion.com/v1/");
	});

	it("handles nested paths", () => {
		expect(buildRestUrl("/blocks/abc/children")).toBe(
			"https://api.notion.com/v1/blocks/abc/children",
		);
	});
});

describe("buildRestHeaders", () => {
	it("includes auth and version headers", () => {
		const headers = buildRestHeaders("ntn_abc123");
		expect(headers.Authorization).toBe("Bearer ntn_abc123");
		expect(headers["Notion-Version"]).toBe("2026-03-11");
	});

	it("includes content-type when specified", () => {
		const headers = buildRestHeaders("ntn_abc123", "application/json");
		expect(headers["Content-Type"]).toBe("application/json");
	});

	it("omits content-type when not specified", () => {
		const headers = buildRestHeaders("ntn_abc123");
		expect(headers["Content-Type"]).toBeUndefined();
	});
});
