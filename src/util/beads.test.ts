import { describe, expect, it } from "vitest";
import {
	assessBeadsSchema,
	buildBeadsProperties,
	detectBeadsPropertiesFromQueryPayload,
	extractBeadsDatabaseInfoFromText,
	extractPageIdFromUrl,
	normalizeBeadsPushInput,
	normalizeBeadsQueryPayload,
} from "./beads.js";

describe("extractBeadsDatabaseInfoFromText", () => {
	it("extracts database, data source, and views from fetch text", () => {
		const info = extractBeadsDatabaseInfoFromText(`
			<database url="https://www.notion.so/123456781234123412341234567890ab">
				<data-source url="collection://ds-123">
					<view name="All" url="view://view-1" type="table">
					<view name="Open" url="view://view-2" type="board">
				</data-source>
			</database>
		`);

		expect(info.database_id).toBe("12345678-1234-1234-1234-1234567890ab");
		expect(info.data_source_id).toBe("ds-123");
		expect(info.views).toEqual([
			{ name: "All", url: "view://view-1", type: "table" },
			{ name: "Open", url: "view://view-2", type: "board" },
		]);
	});
});

describe("extractPageIdFromUrl", () => {
	it("normalizes compact Notion ids", () => {
		expect(
			extractPageIdFromUrl("https://www.notion.so/Task-123456781234123412341234567890ab"),
		).toBe("12345678-1234-1234-1234-1234567890ab");
	});
});

describe("detectBeadsPropertiesFromQueryPayload", () => {
	it("keeps only schema properties from query results", () => {
		const detected = detectBeadsPropertiesFromQueryPayload({
			results: [
				{
					id: "page-1",
					url: "https://www.notion.so/page-1",
					Name: "Issue one",
					"Beads ID": "bd-1",
					Status: "Open",
					Priority: "High",
					Type: "Bug",
					Description: "desc",
				},
			],
		});

		expect(detected).toEqual(["Beads ID", "Description", "Name", "Priority", "Status", "Type"]);
	});
});

describe("assessBeadsSchema", () => {
	it("reports missing required and optional properties", () => {
		const schema = assessBeadsSchema(["Name", "Beads ID", "Status"], true);
		expect(schema.missing).toEqual(["Priority", "Type", "Description"]);
		expect(schema.optional_missing).toEqual(["Assignee", "Labels"]);
	});
});

describe("normalizeBeadsQueryPayload", () => {
	it("normalizes query results into beads issue JSON", () => {
		const payload = normalizeBeadsQueryPayload({
			results: [
				{
					id: "page-1",
					url: "https://www.notion.so/Task-123456781234123412341234567890ab",
					Name: "Fix login",
					"Beads ID": "bd-42",
					Status: "In Progress",
					Priority: "High",
					Type: "Bug",
					Description: "Handle the edge case",
					Assignee: "osamu",
					Labels: ["backend", "auth"],
					created_time: "2026-03-19T00:00:00Z",
					last_edited_time: "2026-03-19T01:00:00Z",
				},
			],
		});

		expect(payload).toEqual({
			issues: [
				{
					id: "bd-42",
					title: "Fix login",
					description: "Handle the edge case",
					status: "in_progress",
					priority: "high",
					type: "bug",
					issue_type: "bug",
					assignee: "osamu",
					labels: ["backend", "auth"],
					external_ref: "https://www.notion.so/Task-123456781234123412341234567890ab",
					notion_page_id: "page-1",
					url: "https://www.notion.so/Task-123456781234123412341234567890ab",
					created_at: "2026-03-19T00:00:00Z",
					updated_at: "2026-03-19T01:00:00Z",
				},
			],
		});
	});
});

describe("normalizeBeadsPushInput", () => {
	it("accepts both object and array roots", () => {
		expect(
			normalizeBeadsPushInput({
				issues: [{ id: "bd-1", title: "Issue", status: "open", labels: "a, b" }],
			}),
		).toEqual({
			issues: [
				{
					id: "bd-1",
					title: "Issue",
					description: null,
					status: "open",
					priority: null,
					type: null,
					issue_type: null,
					assignee: null,
					labels: ["a", "b"],
				},
			],
		});
	});
});

describe("buildBeadsProperties", () => {
	it("maps normalized beads issue values back to Notion properties", () => {
		expect(
			buildBeadsProperties({
				id: "bd-7",
				title: "Ship it",
				description: "Release checklist",
				status: "closed",
				priority: "critical",
				type: "feature",
				issue_type: "feature",
				assignee: "osamu",
				labels: ["release"],
			}),
		).toEqual({
			title: "Ship it",
			"Beads ID": "bd-7",
			Status: "Closed",
			Priority: "Critical",
			Type: "Feature",
			Description: "Release checklist",
			Assignee: "osamu",
			Labels: ["release"],
		});
	});
});
