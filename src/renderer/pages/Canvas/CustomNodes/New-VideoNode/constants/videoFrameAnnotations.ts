export type VideoFrameAnnotationTool =
    | "select"
    | "brush"
    | "arrow"
    | "shape"
    | "pin";

export type VideoFrameAnnotationRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type VideoFrameAnnotation = {
    tool: VideoFrameAnnotationTool;
    rect: VideoFrameAnnotationRect;
    points?: Array<{ x: number; y: number }>;
    color?: string;
    markerNumber?: number;
};

export type VideoFrameAnnotationPayload = {
    frameTime: number;
    annotations: VideoFrameAnnotation[];
};

export type VideoFrameAnnotationReference = {
    id: string;
    mentionId: string;
    label: string;
    displayLabel: string;
    value: string;
    thumbnail: string;
    url: string;
    fileUrl: string;
    type: "image";
    mediaType: "image";
    source: "video-frame-annotation";
    preserveLabel: true;
    frameTime: number;
    rect: VideoFrameAnnotationRect;
    tool: VideoFrameAnnotationTool;
};

export const VIDEO_FRAME_ANNOTATION_REFERENCES_KEY =
    "videoFrameAnnotationReferences";
export const PENDING_VIDEO_FRAME_ANNOTATION_MENTION_KEY =
    "pendingVideoFrameAnnotationMentionId";
