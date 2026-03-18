import { describe, expect, it } from "vitest";
import { parseDbProps } from "./db-props.js";

describe("parseDbProps", () => {
	it("parses title type", () => {
		expect(parseDbProps(["Name:title"])).toBe('"Name" TITLE');
	});

	it("parses simple types (date, number, checkbox, url, email, phone)", () => {
		expect(parseDbProps(["DueDate:date"])).toBe('"DueDate" DATE');
		expect(parseDbProps(["Count:number"])).toBe('"Count" NUMBER');
		expect(parseDbProps(["Done:checkbox"])).toBe('"Done" CHECKBOX');
	});

	it("parses select with options", () => {
		expect(parseDbProps(["Status:select=Open,Done"])).toBe("\"Status\" SELECT('Open','Done')");
	});

	it("parses multi_select with options", () => {
		expect(parseDbProps(["Tags:multi_select=Bug,Feature"])).toBe(
			"\"Tags\" MULTI_SELECT('Bug','Feature')",
		);
	});

	it("combines multiple props with commas", () => {
		const result = parseDbProps(["Name:title", "Status:select=Open,Done", "DueDate:date"]);
		expect(result).toBe('"Name" TITLE, "Status" SELECT(\'Open\',\'Done\'), "DueDate" DATE');
	});

	it("throws on missing type separator", () => {
		expect(() => parseDbProps(["Name"])).toThrow();
	});

	it("throws on empty name", () => {
		expect(() => parseDbProps([":title"])).toThrow();
	});
});
