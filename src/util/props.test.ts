import { describe, expect, it } from "vitest";
import { parseProps } from "./props.js";

describe("parseProps", () => {
	it("parses single Key=Value", () => {
		expect(parseProps(["Status=Open"])).toEqual({ Status: "Open" });
	});

	it("parses multiple props", () => {
		expect(parseProps(["Status=Open", "Priority=High"])).toEqual({
			Status: "Open",
			Priority: "High",
		});
	});

	it("handles value containing = sign", () => {
		expect(parseProps(["Formula=A=B+C"])).toEqual({ Formula: "A=B+C" });
	});

	it("handles empty value", () => {
		expect(parseProps(["Status="])).toEqual({ Status: "" });
	});

	it("throws on missing = sign", () => {
		expect(() => parseProps(["InvalidProp"])).toThrow('Invalid property format: "InvalidProp"');
	});

	it("throws on empty key", () => {
		expect(() => parseProps(["=Value"])).toThrow('Property key is empty in: "=Value"');
	});

	it("returns empty object for empty array", () => {
		expect(parseProps([])).toEqual({});
	});
});
