import { describe, expect, it } from "vitest";
import { extractText, formatOutput } from "./json.js";

const mcpResult = {
	content: [{ type: "text", text: "Hello world" }],
};

const mcpResultMulti = {
	content: [
		{ type: "text", text: "Line 1" },
		{ type: "text", text: "Line 2" },
	],
};

const mcpResultJsonText = {
	content: [{ type: "text", text: '{"id":"abc","title":"Test"}' }],
};

const mcpResultEmpty = {
	content: [],
};

const mcpResultNoContent = { someKey: "someValue" };

describe("extractText", () => {
	it("extracts text from MCP content array", () => {
		expect(extractText(mcpResult)).toBe("Hello world");
	});

	it("joins multiple text content items with newline", () => {
		expect(extractText(mcpResultMulti)).toBe("Line 1\nLine 2");
	});

	it("returns empty string for empty content array", () => {
		expect(extractText(mcpResultEmpty)).toBe("");
	});

	it("returns JSON.stringify for non-content results", () => {
		expect(extractText(mcpResultNoContent)).toBe('{"someKey":"someValue"}');
	});
});

describe("formatOutput", () => {
	it("default mode returns extractText result", () => {
		expect(formatOutput(mcpResult, {})).toBe("Hello world");
	});

	it("--raw mode returns full JSON envelope", () => {
		const output = formatOutput(mcpResult, { raw: true });
		expect(JSON.parse(output)).toEqual(mcpResult);
	});

	it("--json mode parses text content as JSON and pretty-prints", () => {
		const output = formatOutput(mcpResultJsonText, { json: true });
		expect(JSON.parse(output)).toEqual({ id: "abc", title: "Test" });
	});

	it("--json mode wraps non-JSON text", () => {
		const output = formatOutput(mcpResult, { json: true });
		expect(JSON.parse(output)).toEqual({ text: "Hello world" });
	});

	it("--raw takes precedence over --json", () => {
		const output = formatOutput(mcpResult, { json: true, raw: true });
		expect(JSON.parse(output)).toEqual(mcpResult);
	});
});
