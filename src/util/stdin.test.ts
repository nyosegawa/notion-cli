import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { readStdin } from "./stdin.js";

describe("readStdin", () => {
	it("reads data from stdin", async () => {
		const mockStdin = Readable.from([Buffer.from("hello world")]);
		vi.spyOn(process, "stdin", "get").mockReturnValue(mockStdin as typeof process.stdin);

		const result = await readStdin();
		expect(result).toBe("hello world");

		vi.restoreAllMocks();
	});

	it("reads multi-chunk input", async () => {
		const mockStdin = Readable.from([Buffer.from("chunk1"), Buffer.from("chunk2")]);
		vi.spyOn(process, "stdin", "get").mockReturnValue(mockStdin as typeof process.stdin);

		const result = await readStdin();
		expect(result).toBe("chunk1chunk2");

		vi.restoreAllMocks();
	});

	it("returns empty string for empty stdin", async () => {
		const mockStdin = Readable.from([]);
		vi.spyOn(process, "stdin", "get").mockReturnValue(mockStdin as typeof process.stdin);

		const result = await readStdin();
		expect(result).toBe("");

		vi.restoreAllMocks();
	});
});
