import {
  DEFAULT_IMAGE_GENERATION_POINTS,
  getImageGenerationPoints,
  IMAGE_MODEL_POINTS,
  IMAGE_PLATFORM_POINTS,
} from "./image";
import {
  DEFAULT_VIDEO_GENERATION_POINTS,
  getSeedanceVideoGenerationPointsBreakdown,
  getVideoGenerationPoints,
  VIDEO_MODEL_POINTS,
} from "./video";

export {
  DEFAULT_IMAGE_GENERATION_POINTS,
  DEFAULT_VIDEO_GENERATION_POINTS,
  getSeedanceVideoGenerationPointsBreakdown,
  getImageGenerationPoints,
  getVideoGenerationPoints,
  IMAGE_MODEL_POINTS,
  IMAGE_PLATFORM_POINTS,
  VIDEO_MODEL_POINTS,
};

export const getGenerationPointsByScene = ({
  scene,
  model,
}: {
  scene: "image" | "video";
  model?: string;
}) => {
  if (scene === "image") {
    return getImageGenerationPoints({ model });
  }

  return getVideoGenerationPoints({ model });
};
