import { extractText } from "../output/json.js";
import { CliError } from "./errors.js";

export const BEADS_REQUIRED_PROPERTIES = [
	"Name",
	"Beads ID",
	"Status",
	"Priority",
	"Type",
	"Description",
] as const;

export const BEADS_OPTIONAL_PROPERTIES = ["Assignee", "Labels"] as const;

const STATUS_TO_NOTION = {
	open: "Open",
	in_progress: "In Progress",
	blocked: "Blocked",
	deferred: "Deferred",
	closed: "Closed",
} as const;

const PRIORITY_TO_NOTION = {
	critical: "Critical",
	high: "High",
	medium: "Medium",
	low: "Low",
	backlog: "Backlog",
} as const;

const TYPE_TO_NOTION = {
	bug: "Bug",
	feature: "Feature",
	task: "Task",
	epic: "Epic",
	chore: "Chore",
} as const;

const QUERY_METADATA_KEYS = new Set([
	"id",
	"url",
	"page_id",
	"created_time",
	"last_edited_time",
	"created_at",
	"updated_at",
]);

const PROPERTY_NAME_ALIASES = new Map<string, string>([
	["name", "Name"],
	["title", "Name"],
	["beads_id", "Beads ID"],
	["beadsid", "Beads ID"],
	["status", "Status"],
	["priority", "Priority"],
	["type", "Type"],
	["description", "Description"],
	["assignee", "Assignee"],
	["labels", "Labels"],
]);

type JsonRecord = Record<string, unknown>;

export interface BeadsViewInfo {
	name: string | null;
	url: string;
	type: string | null;
}

export interface BeadsDatabaseInfo {
	database_id: string | null;
	database_url: string | null;
	data_source_id: string | null;
	views: BeadsViewInfo[];
}

export interface BeadsSchemaStatus {
	checked: boolean;
	required: string[];
	optional: string[];
	detected: string[];
	missing: string[];
	optional_missing: string[];
}

export interface BeadsIssue {
	id: string;
	title: string;
	description: string | null;
	status: string | null;
	priority: string | null;
	type: string | null;
	issue_type: string | null;
	assignee: string | null;
	labels: string[];
	external_ref: string;
	notion_page_id: string | null;
	url: string | null;
	created_at: string | null;
	updated_at: string | null;
}

export interface BeadsPushIssue {
	id: string;
	title: string;
	description: string | null;
	status: string | null;
	priority: string | null;
	type: string | null;
	issue_type: string | null;
	assignee: string | null;
	labels: string[];
}

export interface BeadsIssueSet {
	issues: BeadsPushIssue[];
}

export interface BeadsAuthUser {
	id: string | null;
	name: string | null;
	email: string | null;
	type: string | null;
}

function isRecord(value: unknown): value is JsonRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEnumKey(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/&/g, "and")
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "");
}

function extractAttr(tag: string, name: string): string | null {
	const match = new RegExp(`${name}="([^"]+)"`, "i").exec(tag);
	return match?.[1] ?? null;
}

function parseJsonText(text: string, operation: string): JsonRecord {
	try {
		const parsed = JSON.parse(text) as unknown;
		if (isRecord(parsed)) {
			return parsed;
		}
		throw new CliError(
			`Invalid ${operation} JSON`,
			`${operation} returned JSON, but the root value was not an object`,
			"Retry the command with --raw to inspect the full payload",
		);
	} catch (error) {
		if (error instanceof CliError) {
			throw error;
		}
		throw new CliError(
			`Invalid ${operation} response`,
			`${operation} did not return parseable JSON`,
			"Retry the command with --raw to inspect the full payload",
		);
	}
}

function parseAnyJson(text: string, operation: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		throw new CliError(
			`Invalid ${operation} JSON`,
			`${operation} could not be parsed`,
			"Check the JSON syntax and try again",
		);
	}
}

function valueToString(value: unknown): string | null {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed.length > 0 ? trimmed : null;
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	if (Array.isArray(value)) {
		const parts = value
			.map((item) => valueToString(item))
			.filter((item): item is string => item !== null);
		return parts.length > 0 ? parts.join(", ") : null;
	}
	if (isRecord(value)) {
		for (const key of ["plain_text", "text", "name", "url", "id"]) {
			const nested = valueToString(value[key]);
			if (nested) {
				return nested;
			}
		}
	}
	return null;
}

function valueToStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((item) => valueToStringArray(item));
	}
	if (typeof value === "string") {
		return value
			.split(",")
			.map((item) => item.trim())
			.filter((item) => item.length > 0);
	}
	const single = valueToString(value);
	return single ? [single] : [];
}

function pickString(record: JsonRecord, keys: string[]): string | null {
	for (const key of keys) {
		const value = valueToString(record[key]);
		if (value !== null) {
			return value;
		}
	}
	return null;
}

function requireString(record: JsonRecord, keys: string[], label: string, index: number): string {
	const value = pickString(record, keys);
	if (value !== null) {
		return value;
	}
	throw new CliError(
		`Invalid beads row at index ${index}`,
		`Missing required ${label} field`,
		'Use the dedicated beads database schema with "Name" and "Beads ID" properties',
	);
}

function normalizeEnumValue(value: string | null, mapping: Record<string, string>): string | null {
	if (!value) {
		return null;
	}
	const normalized = normalizeEnumKey(value);
	for (const [key, display] of Object.entries(mapping)) {
		if (normalized === key || normalized === normalizeEnumKey(display)) {
			return key;
		}
	}
	return normalized || null;
}

function toNotionEnumValue(
	value: string | null | undefined,
	mapping: Record<string, string>,
	label: string,
): string | null {
	if (!value) {
		return null;
	}
	const normalized = normalizeEnumKey(value);
	for (const [key, display] of Object.entries(mapping)) {
		if (normalized === key || normalized === normalizeEnumKey(display)) {
			return display;
		}
	}
	throw new CliError(
		`Invalid beads ${label}`,
		`Unsupported ${label} value: ${value}`,
		`Use one of: ${Object.keys(mapping).join(", ")}`,
	);
}

function normalizePropertyName(name: string): string | null {
	const normalized = normalizeEnumKey(name);
	if (QUERY_METADATA_KEYS.has(normalized)) {
		return null;
	}
	return PROPERTY_NAME_ALIASES.get(normalized) ?? name;
}

export function extractResultJson(result: JsonRecord, operation: string): JsonRecord {
	if (!("content" in result)) {
		return result;
	}
	const text = extractText(result).trim();
	if (!text) {
		throw new CliError(
			`Invalid ${operation} response`,
			`${operation} returned an empty text payload`,
			"Retry the command with --raw to inspect the full payload",
		);
	}
	return parseJsonText(text, operation);
}

export function extractBeadsDatabaseInfoFromText(text: string): BeadsDatabaseInfo {
	const databaseTag = text.match(/<database\b[^>]*>/i)?.[0] ?? null;
	const dataSourceTag = text.match(/<data-source\b[^>]*>/i)?.[0] ?? null;
	const views = Array.from(text.matchAll(/<view\b[^>]*>/gi)).flatMap((match) => {
		const url = extractAttr(match[0], "url");
		if (!url) {
			return [];
		}
		return [
			{
				name: extractAttr(match[0], "name"),
				url,
				type: extractAttr(match[0], "type"),
			},
		];
	});

	const databaseUrl = databaseTag ? extractAttr(databaseTag, "url") : null;
	return {
		database_id: databaseUrl ? extractPageIdFromUrl(databaseUrl) : null,
		database_url: databaseUrl,
		data_source_id: dataSourceTag
			? (extractAttr(dataSourceTag, "url")?.replace(/^collection:\/\//, "") ?? null)
			: null,
		views,
	};
}

export function extractPageIdFromUrl(url: string): string | null {
	const directMatch = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
	if (directMatch) {
		return directMatch[1];
	}
	const compactMatch = url.match(/([0-9a-f]{32})(?:\?|$)/i);
	if (!compactMatch) {
		return null;
	}
	const compact = compactMatch[1];
	return [
		compact.slice(0, 8),
		compact.slice(8, 12),
		compact.slice(12, 16),
		compact.slice(16, 20),
		compact.slice(20),
	].join("-");
}

export function detectBeadsPropertiesFromQueryPayload(payload: JsonRecord): string[] {
	const results = payload.results;
	if (!Array.isArray(results)) {
		return [];
	}
	const detected = new Set<string>();
	for (const result of results) {
		if (!isRecord(result)) {
			continue;
		}
		for (const key of Object.keys(result)) {
			const propertyName = normalizePropertyName(key);
			if (propertyName) {
				detected.add(propertyName);
			}
		}
	}
	return [...detected].sort((a, b) => a.localeCompare(b));
}

export function assessBeadsSchema(detectedProperties: string[], checked = true): BeadsSchemaStatus {
	const detected = [...detectedProperties].sort((a, b) => a.localeCompare(b));
	const detectedSet = new Set(detected);
	return {
		checked,
		required: [...BEADS_REQUIRED_PROPERTIES],
		optional: [...BEADS_OPTIONAL_PROPERTIES],
		detected,
		missing: BEADS_REQUIRED_PROPERTIES.filter((name) => !detectedSet.has(name)),
		optional_missing: BEADS_OPTIONAL_PROPERTIES.filter((name) => !detectedSet.has(name)),
	};
}

export function normalizeBeadsQueryPayload(payload: JsonRecord): { issues: BeadsIssue[] } {
	const results = payload.results;
	if (!Array.isArray(results)) {
		throw new CliError(
			"Invalid beads pull response",
			"notion-query-database-view did not return a results array",
			"Retry the command with --raw to inspect the payload",
		);
	}
	return {
		issues: results.map((result, index) => {
			if (!isRecord(result)) {
				throw new CliError(
					`Invalid beads row at index ${index}`,
					"Query results must be objects",
					"Retry the command with --raw to inspect the payload",
				);
			}
			const url = pickString(result, ["url"]);
			const notionPageId =
				pickString(result, ["id", "page_id"]) ?? (url ? extractPageIdFromUrl(url) : null);
			const issueType = normalizeEnumValue(pickString(result, ["Type", "type"]), TYPE_TO_NOTION);
			return {
				id: requireString(result, ["Beads ID", "beads_id"], '"Beads ID"', index),
				title: requireString(result, ["Name", "title", "name"], '"Name"', index),
				description: pickString(result, ["Description", "description"]),
				status: normalizeEnumValue(pickString(result, ["Status", "status"]), STATUS_TO_NOTION),
				priority: normalizeEnumValue(
					pickString(result, ["Priority", "priority"]),
					PRIORITY_TO_NOTION,
				),
				type: issueType,
				issue_type: issueType,
				assignee: pickString(result, ["Assignee", "assignee"]),
				labels: valueToStringArray(result.Labels ?? result.labels),
				external_ref: url ?? (notionPageId ? `notion:${notionPageId}` : "notion:unknown"),
				notion_page_id: notionPageId,
				url,
				created_at: pickString(result, ["created_time", "Created time", "created_at"]),
				updated_at: pickString(result, ["last_edited_time", "Updated time", "updated_at"]),
			};
		}),
	};
}

function normalizePushIssue(value: unknown, index: number): BeadsPushIssue {
	if (!isRecord(value)) {
		throw new CliError(
			`Invalid beads issue at index ${index}`,
			"Each issue must be a JSON object",
			'Pass {"issues":[...]} or a JSON array of issue objects',
		);
	}
	const id = pickString(value, ["id", "beads_id"]);
	const title = pickString(value, ["title", "Name"]);
	if (!id) {
		throw new CliError(
			`Invalid beads issue at index ${index}`,
			'Each issue must include "id" (the Beads ID)',
			'Pass {"issues":[{"id":"bd-123","title":"..."}, ...]}',
		);
	}
	if (!title) {
		throw new CliError(
			`Invalid beads issue at index ${index}`,
			'Each issue must include "title"',
			'Pass {"issues":[{"id":"bd-123","title":"..."}, ...]}',
		);
	}
	const issueType = pickString(value, ["type", "issue_type"]);
	return {
		id,
		title,
		description: pickString(value, ["description"]),
		status: normalizeEnumValue(pickString(value, ["status"]), STATUS_TO_NOTION),
		priority: normalizeEnumValue(pickString(value, ["priority"]), PRIORITY_TO_NOTION),
		type: normalizeEnumValue(issueType, TYPE_TO_NOTION),
		issue_type: normalizeEnumValue(issueType, TYPE_TO_NOTION),
		assignee: pickString(value, ["assignee"]),
		labels: valueToStringArray(value.labels),
	};
}

export function normalizeBeadsPushInput(payload: unknown): BeadsIssueSet {
	const root = isRecord(payload) && Array.isArray(payload.issues) ? payload.issues : payload;
	if (!Array.isArray(root)) {
		throw new CliError(
			"Invalid beads input",
			'Expected a JSON array or an object with an "issues" array',
			'Pass {"issues":[{"id":"bd-123","title":"..."}]} or [{"id":"bd-123","title":"..."}]',
		);
	}
	return {
		issues: root.map((issue, index) => normalizePushIssue(issue, index)),
	};
}

export function parseBeadsPushInput(text: string): BeadsIssueSet {
	return normalizeBeadsPushInput(parseAnyJson(text, "beads input"));
}

export function buildBeadsProperties(issue: BeadsPushIssue): JsonRecord {
	const properties: JsonRecord = {
		title: issue.title,
		"Beads ID": issue.id,
	};
	const status = toNotionEnumValue(issue.status, STATUS_TO_NOTION, "status");
	const priority = toNotionEnumValue(issue.priority, PRIORITY_TO_NOTION, "priority");
	const type = toNotionEnumValue(issue.type ?? issue.issue_type, TYPE_TO_NOTION, "type");
	if (status) properties.Status = status;
	if (priority) properties.Priority = priority;
	if (type) properties.Type = type;
	if (issue.description !== null) properties.Description = issue.description;
	if (issue.assignee !== null) properties.Assignee = issue.assignee;
	if (issue.labels.length > 0) properties.Labels = issue.labels;
	return properties;
}

export function extractSelfUserFromPayload(payload: JsonRecord): BeadsAuthUser | null {
	const candidate =
		Array.isArray(payload.results) && payload.results.length > 0 ? payload.results[0] : payload;
	if (!isRecord(candidate)) {
		return null;
	}
	return {
		id: pickString(candidate, ["id"]),
		name: pickString(candidate, ["name"]),
		email: pickString(candidate, ["email"]),
		type: pickString(candidate, ["type"]),
	};
}
