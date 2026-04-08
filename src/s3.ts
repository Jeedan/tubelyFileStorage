import type { ApiConfig } from "./config";
import type { Video } from "./db/videos";

type UploadVideo = {
	key: string;
	filePath: string;
	contentType: string;
};

export async function uploadVideoToS3(cfg: ApiConfig, video: UploadVideo) {
	const s3Client = cfg.s3Client;
	const s3File = s3Client.file(video.key, { bucket: cfg.s3Bucket });
	await s3File.write(Bun.file(video.filePath), { type: video.contentType });
}

function generatePresignedURL(cfg: ApiConfig, key: string, expireTime: number) {
	const s3Client = cfg.s3Client;
	const s3File = s3Client.file(key, { bucket: cfg.s3Bucket });
	return s3File.presign({
		expiresIn: expireTime,
		method: "GET",
	});
}

export function dbVideoToSignedVideo(cfg: ApiConfig, video: Video) {
	if (!video.videoURL) return video;
	video.videoURL = generatePresignedURL(cfg, video.videoURL, 3600);
	return video;
}
