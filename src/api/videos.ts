import { respondWithJSON } from "./json";

import { type ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getBearerToken, validateJWT } from "../auth";
import { getVideo, updateVideo } from "../db/videos";
import path from "path";
import { uploadVideoToS3 } from "../s3";
import {
	generateFileKey,
	getVideoAspectRatio,
	processVideoForFastStart,
} from "./assets";
import { rm } from "fs/promises";

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
	const { videoId } = req.params as { videoId?: string };
	if (!videoId) {
		throw new BadRequestError("Invalid video ID");
	}

	// 1gb upload limit (30 bytes bit shifted: 1x10204x1024x1024)
	const MAX_UPLOAD_SIZE = 1 << 30;
	const token = getBearerToken(req.headers);
	const userID = validateJWT(token, cfg.jwtSecret);

	const video = getVideo(cfg.db, videoId);
	if (!video) {
		throw new NotFoundError("Video not found");
	}

	if (video.userID !== userID) {
		throw new UserForbiddenError(
			"Forbidde. The Video does not belong to the user",
		);
	}

	console.log("uploading video", videoId, "by user", userID);

	const formData = await req.formData();
	const file = formData.get("video");
	if (!(file instanceof File)) {
		throw new BadRequestError("Video file missing");
	}
	if (file.size > MAX_UPLOAD_SIZE) {
		throw new BadRequestError("File exceeds max upload size");
	}

	const contentType = file.type;
	if (contentType !== "video/mp4") {
		throw new BadRequestError("Invalid Video format");
	}

	const key = generateFileKey(contentType, "hex");
	const tmpFilePath = path.join("/tmp", key);

	await Bun.write(tmpFilePath, file);
	// get aspect Ratio from the tempfile
	const aspectRatio = await getVideoAspectRatio(tmpFilePath);
	const prefixedKey = `${aspectRatio}/${key}`;

	const processedVideo = await processVideoForFastStart(tmpFilePath);

	// store it in s3client
	await uploadVideoToS3(cfg, {
		key: prefixedKey,
		filePath: processedVideo,
		contentType,
	});

	//update url with format: https://<bucket-name>.s3.<region>.amazonaws.com/<key>
	video.videoURL = `https://${cfg.s3Bucket}.s3.${cfg.s3Region}.amazonaws.com/${prefixedKey}`;

	updateVideo(cfg.db, video);
	// delete temporary files concurrently
	await Promise.all([
		rm(tmpFilePath, { force: true }),
		rm(processedVideo, { force: true }),
	]);
	console.log("Deleted temp files");
	return respondWithJSON(200, video);
}
