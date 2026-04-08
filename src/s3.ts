import type { ApiConfig } from "./config";
import type { Video } from "./db/videos";

type FileUpload = {
	key: string;
	filePath: string;
	contentType: string;
};

export async function uploadFileToS3(cfg: ApiConfig, file: FileUpload) {
	const s3File = createS3File(cfg, cfg.s3Bucket, file);
	await uploadFile(s3File, file);
}

export async function uploadFileToPublicS3(cfg: ApiConfig, file: FileUpload) {
	const s3File = createS3File(cfg, cfg.s3PublicBucket, file);
	await uploadFile(s3File, file);
}

function createS3File(cfg: ApiConfig, bucket: string, file: FileUpload) {
	const s3Client = cfg.s3Client;
	return s3Client.file(file.key, { bucket: bucket });
}

async function uploadFile(s3File: Bun.S3File, file: FileUpload) {
	await s3File.write(Bun.file(file.filePath), { type: file.contentType });
}

// same as below
function deprecated_generatePresignedURL(
	cfg: ApiConfig,
	key: string,
	expireTime: number,
) {
	const s3Client = cfg.s3Client;
	const s3File = s3Client.file(key, { bucket: cfg.s3Bucket });
	return s3File.presign({
		expiresIn: expireTime,
		method: "GET",
	});
}

// not using this anymore
// it was an example on how to encrypt before using CDN
export function deprecated_dbVideoToSignedVideo(cfg: ApiConfig, video: Video) {
	if (!video.videoURL) return video;
	video.videoURL = deprecated_generatePresignedURL(cfg, video.videoURL, 3600);
	return video;
}
