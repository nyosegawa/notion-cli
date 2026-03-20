import { Command } from "commander";
import { describe, expect, it } from "vitest";
import { buildFileUploadArgs, registerFileCommands } from "./file.js";

describe("buildFileUploadArgs", () => {
	it("maps file path", () => {
		const result = buildFileUploadArgs("./test.png", {});
		expect(result).toEqual({
			filePath: "./test.png",
			displayName: undefined,
		});
	});

	it("includes display name when provided", () => {
		const result = buildFileUploadArgs("./test.png", { name: "Screenshot" });
		expect(result).toEqual({
			filePath: "./test.png",
			displayName: "Screenshot",
		});
	});

	it("throws on empty file path", () => {
		expect(() => buildFileUploadArgs("", {})).toThrow("Missing file path");
	});
});

describe("registerFileCommands", () => {
	it("registers file command group on program", () => {
		const program = new Command();
		registerFileCommands(program);
		const cmd = program.commands.find((c) => c.name() === "file");
		expect(cmd).toBeDefined();
	});

	it("registers upload subcommand", () => {
		const program = new Command();
		registerFileCommands(program);
		const file = program.commands.find((c) => c.name() === "file");
		const upload = file?.commands.find((c) => c.name() === "upload");
		expect(upload).toBeDefined();
	});
});
