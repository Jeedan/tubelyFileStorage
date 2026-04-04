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
