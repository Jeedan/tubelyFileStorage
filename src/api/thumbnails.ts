import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
	data: ArrayBuffer;
	mediaType: string;
};

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

	const mediaType = file.type;
	const imageData = await file.arrayBuffer();
	const video = getVideo(cfg.db, videoId);
	if (!video) throw new NotFoundError("Video not found");
	if (video.userID !== userID)
		throw new UserForbiddenError(
			"Forbidden. The Video does not belong to the user",
		);
	const base64Encoded = Buffer.from(imageData).toString("base64");
	// data:[<media-type>][;base64],<data>
	const base64DataURL = `data:${mediaType};base64,${base64Encoded}`;
	video.thumbnailURL = base64DataURL;
	updateVideo(cfg.db, video);

	return respondWithJSON(200, video);
}
