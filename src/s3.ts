import type { ApiConfig } from "./config";

export async function uploadVideoToS3(
	cfg: ApiConfig,
	key: string,
	filePath: string,
	contentType: string,
) {
	const s3Client = cfg.s3Client;
	const s3File = s3Client.file(key, { bucket: cfg.s3Bucket });
	await s3File.write(Bun.file(filePath), { type: contentType });
}
