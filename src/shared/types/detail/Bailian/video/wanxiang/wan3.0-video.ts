export type Wan30VideoModel = "wan3.0-video" | "wan3.0-video-prime";

export interface Wan30VideoRequest {
    model: Wan30VideoModel;
    input: {
        prompt?: string;
        media?: Array<{
            type:
            | "first_frame"
            | "last_frame"
            | "reference_image"
            | "reference_video"
            | "reference_audio"
            | "file"
            | "link";
            url: string;
        }>;
    };
    parameters?: {
        resolution?: "480P" | "720P" | "1080P";
        ratio?: "adaptive" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
        duration?: number;
        audio?: boolean;
        seed?: number;
        prompt_extend?: boolean;
        watermark?: boolean;
    };
}

export interface Wan30VideoCreateResponse {
    request_id: string;
    output: {
        task_id: string;
        task_status: "PENDING";
    };
}

export interface Wan30VideoQueryResponse {
    request_id: string;
    output: {
        task_id: string;
        task_status:
        | "PENDING"
        | "RUNNING"
        | "SUCCEEDED"
        | "FAILED"
        | "CANCELED"
        | "UNKNOWN";
        submit_time: string;
        scheduled_time?: string;
        end_time?: string;
        orig_prompt?: string;
        video_url?: string;
        code?: string;
        message?: string;
    };
    usage?: {
        video_count: number;
        duration: number;
        input_video_duration: number;
        output_video_duration: number;
        fps: number;
        SR: number;
        ratio: string;
    };
}

export interface Wan30VideoErrorResponse {
    request_id: string;
    code: string;
    message: string;
}
