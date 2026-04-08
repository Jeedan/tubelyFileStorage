import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";
import { generateFileKey } from "./assets";
import { uploadFileToPublicS3 } from "../s3";

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
	const { videoId } = req.params as { videoId?: string };
	if (!videoId) {
		throw new BadRequestError("Invalid video ID");
	}

	const token = getBearerToken(req.headers);
	const userID = validateJWT(token, cfg.jwtSecret);

	console.log("uploading thumbnail for video", videoId, "by user", userID);

	// TODO: implement the upload here
	const formData = await req.formData();
	const file = formData.get("thumbnail");
	if (!(file instanceof File)) {
		throw new BadRequestError("Thumbnail file missing");
	}

	// the bit shift is the same as this: 10 * 1024 * 1024
	// max upload size 10MB
	const MAX_UPLOAD_SIZE = 10 << 20;
	if (file.size > MAX_UPLOAD_SIZE) {
		throw new BadRequestError("File exceeds max upload size");
	}

	const contentType = file.type;
	const video = getVideo(cfg.db, videoId);
	if (!video) throw new NotFoundError("Video not found");
	if (video.userID !== userID)
		throw new UserForbiddenError(
			"Forbidden. The Video does not belong to the user",
		);
	// save to file
	if (!contentType) {
		throw new BadRequestError("Missing Content-Type for thumbnail");
	}
	const key = generateFileKey(contentType, "base64url");
	const tmpFilePath = path.join(cfg.assetsRoot, key);

	await Bun.write(tmpFilePath, file);

	const prefixedKey = `thumbnail/${key}`;

	await uploadFileToPublicS3(cfg, {
		key: prefixedKey,
		filePath: tmpFilePath,
		contentType,
	});
	// update url with format: https://<bucket-name>.s3.<region>.amazonaws.com/<key>
	// swap to CDN if we enable it for public buckets
	video.thumbnailURL = `https://${cfg.s3PublicBucket}.s3.${cfg.s3Region}.amazonaws.com/${prefixedKey}`;

	updateVideo(cfg.db, video);
	await Bun.file(tmpFilePath).delete();
	return respondWithJSON(200, video);
}
