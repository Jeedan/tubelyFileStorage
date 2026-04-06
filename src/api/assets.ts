import { existsSync, mkdirSync } from "fs";

import type { ApiConfig } from "../config";
import { randomBytes } from "crypto";

export function ensureAssetsDir(cfg: ApiConfig) {
	if (!existsSync(cfg.assetsRoot)) {
		mkdirSync(cfg.assetsRoot, { recursive: true });
	}
}

export function generateFileKey(
	contentType: string,
	encoding: BufferEncoding,
): string {
	const extension = contentType.split("/")[1];
	const uniqueName = randomBytes(32).toString(`${encoding}`);
	const key = `${uniqueName}.${extension}`;
	return key;
}

// command:
// ffprobe -v error -print_format json -show_streams samples/boots-video-vertical.mp4
// ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of json samples/boots-video-vertical.mp4
// -select_streams v:0
// -show_entries stream=width,height
export async function getVideoAspectRatio(filePath: string) {
	const proc = Bun.spawn(
		[
			"ffprobe",
			"-v",
			"error",
			"-select_streams",
			"v:0",
			"-show_entries",
			"stream=width,height",
			"-of",
			"json",
			`${filePath}`,
		],
		{
			stderr: "pipe",
			stdout: "pipe",
		},
	);

	const stdoutText = await new Response(proc.stdout).text();
	const stderrText = await new Response(proc.stderr).text();
	const exited = await proc.exited;
	if (exited !== 0) {
		throw new Error(`Process failed: ${stderrText}`);
	}

	const data = JSON.parse(stdoutText);
	const stream = data.streams?.[0];
	const width = stream?.width;
	const height = stream?.height;

	if (!width || !height) {
		throw new Error("Missing width or height fields");
	}

	const aspectRatio = width / height;

	const RATIO_RANGE = 0.03;
	const PORTRAIT_RATIO = 9 / 16;
	const LANDSCAPE_RATIO = 16 / 9;
	const min_portrait = PORTRAIT_RATIO - RATIO_RANGE;
	const max_portrait = PORTRAIT_RATIO + RATIO_RANGE;
	const min_landscape = LANDSCAPE_RATIO - RATIO_RANGE;
	const max_landscape = LANDSCAPE_RATIO + RATIO_RANGE;

	if (aspectRatio >= min_portrait && aspectRatio <= max_portrait) {
		return "portrait";
	} else if (aspectRatio >= min_landscape && aspectRatio <= max_landscape) {
		return "landscape";
	} else {
		return "other";
	}
}

export async function processVideoForFastStart(inputFilePath: string) {
	const outputFilePath = inputFilePath.concat(".processed.mp4");

	const proc = Bun.spawn(
		[
			"ffmpeg",
			"-i",
			inputFilePath,
			"-movflags",
			"faststart",
			"-map_metadata",
			"0",
			"-codec",
			"copy",
			"-f",
			"mp4",
			outputFilePath,
		],
		{ stderr: "pipe" },
	);

	const stderrText = await new Response(proc.stderr).text();
	const exited = await proc.exited;
	if (exited !== 0) {
		throw new Error(`Process failed: ${stderrText}`);
	}

	return outputFilePath;
}
