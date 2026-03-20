import path from "node:path";
import type { Command } from "commander";
import { printRestOutput } from "../output/json.js";
import { withRestClient } from "../rest/with-rest-client.js";
import { CliError } from "../util/errors.js";

export function buildFileUploadArgs(
	filePath: string,
	opts: { name?: string },
): { filePath: string; displayName?: string } {
	if (!filePath) {
		throw new CliError(
			"Missing file path",
			"A local file path is required",
			"Usage: ncli file upload <file-path>",
		);
	}
	return { filePath, displayName: opts.name };
}

function buildAttachHint(fileUploadId: string, fileName: string): string {
	const block = JSON.stringify({
		children: [
			{
				type: "file",
				file: {
					type: "file_upload",
					file_upload: { id: fileUploadId },
					name: fileName,
				},
			},
		],
	});
	return `\nAttach to a page (appends to end):\n  ncli rest PATCH /blocks/<page-id>/children '${block}'\n\nInsert after a specific block:\n  ncli rest PATCH /blocks/<page-id>/children '{"position":{"type":"after_block","after_block":{"id":"<block-id>"}},"children":[...]}'
  Use "ncli fetch <page-id>" or "ncli rest GET /blocks/<page-id>/children" to find block IDs.`;
}

export function registerFileCommands(program: Command): void {
	const file = program.command("file").description("Upload files to Notion (REST API)");

	file
		.command("upload")
		.description("Upload a file to Notion (returns file_upload_id for attaching to pages)")
		.argument("<file-path>", "Local file path to upload")
		.option("--name <display-name>", "Display name for the file in Notion")
		.addHelpText(
			"after",
			`
Examples:
  ncli file upload ./screenshot.png
  ncli file upload ./report.pdf --name "Q1 Report"

Requires REST API authentication:
  ncli rest login              # Save integration token (one-time)
  NOTION_API_KEY=ntn_...       # Or set env var

After uploading, attach the file to a page:
  ncli rest PATCH /blocks/<page-id>/children '{"children":[{"type":"file","file":{"type":"file_upload","file_upload":{"id":"<file_upload_id>"},"name":"file.png"}}]}'

Insert after a specific block:
  ncli rest PATCH /blocks/<page-id>/children '{"position":{"type":"after_block","after_block":{"id":"<block-id>"}},"children":[...]}'
  Use "ncli fetch <page-id>" or "ncli rest GET /blocks/<page-id>/children" to find block IDs.`,
		)
		.action(async (filePath: string, opts: { name?: string }, cmd: Command) => {
			const args = buildFileUploadArgs(filePath, opts);
			await withRestClient(async (client) => {
				const result = await client.uploadFile(args.filePath, args.displayName);
				printRestOutput(result, cmd.optsWithGlobals());
				const fileUploadId = result.id as string;
				const fileName = args.displayName || path.basename(args.filePath);
				console.error(buildAttachHint(fileUploadId, fileName));
			});
		});
}
