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
