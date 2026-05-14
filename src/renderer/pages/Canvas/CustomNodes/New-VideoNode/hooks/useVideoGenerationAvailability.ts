import { useMemo } from "react";
import type { MentionItem } from "../constants/mockData";
import {
    validateVideoGenerationCapability,
    type VideoGenerationCapabilityResult,
} from "../constants/videoModelGenerationCapabilities";
import type { VideoModeKey } from "../constants/videoModelCapabilities";
import type { VideoParamState } from "../constants/videoParamConfigs";
export const useVideoGenerationAvailability = ({
    modelId,
    mode,
    referenceItems,
    params,
}: {
    modelId: string;
    mode: VideoModeKey;
    referenceItems: MentionItem[];
    params: VideoParamState;
}): VideoGenerationCapabilityResult => {
    return useMemo(
        () =>
            validateVideoGenerationCapability({
                modelId,
                mode,
                referenceItems,
                params,
            }),
        [modelId, mode, referenceItems, params],
    );
};
