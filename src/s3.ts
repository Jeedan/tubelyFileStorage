import type { ApiConfig } from "./config";

type Video = {
	key: string;
	filePath: string;
	contentType: string;
};

export async function uploadVideoToS3(cfg: ApiConfig, video: Video) {
	const s3Client = cfg.s3Client;
	const s3File = s3Client.file(video.key, { bucket: cfg.s3Bucket });
	await s3File.write(Bun.file(video.filePath), { type: video.contentType });
}
