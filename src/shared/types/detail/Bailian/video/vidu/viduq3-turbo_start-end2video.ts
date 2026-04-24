/**
 * vidu/viduq3-turbo_start-end2video 请求体 - Vidu 首尾帧生视频
 * API 文档: https://help.aliyun.com/zh/model-studio/vidu-start-end-video-api-reference
 */
export interface ViduQ3TurboStartEnd2VideoRequest {
    /** 模型名称 */
    model: "vidu/viduq3-turbo_start-end2video";
    /** 输入的基本信息 */
    input: {
        /** 文本提示词，用来描述首帧到尾帧之间的变化过程。支持中英文，不超过 5000 个字符 */
        prompt: string;
        /** 媒体资源列表，包含首帧和尾帧图像。数组的第一个 image 表示首帧，第二个 image 表示尾帧 */
        media: [
            {
                /** 媒体类型，固定为 image */
                type: "image";
                /** 图像的公网可访问 URL，支持 HTTP/HTTPS，格式 JPG/PNG/WEBP，不超过 50MB */
                url: string;
            },
            {
                type: "image";
                url: string;
            }
        ];
    };
    /** 视频生成参数 */
    parameters?: {
        /** 生成视频的分辨率档位，影响费用。可选值：540P、720P（默认）、1080P */
        resolution?: "540P" | "720P" | "1080P";
        /** 生成视频的时长，单位秒，取值 [1, 16] 的整数，默认值为 5 */
        duration?: number;
        /** 是否生成有声视频（默认 false） */
        audio?: boolean;
        /** 是否添加水印（默认 false） */
        watermark?: boolean;
        /** 随机数种子，取值范围 [0, 2147483647]，未指定时系统自动生成 */
        seed?: number;
    };
}

/**
 * vidu/viduq3-turbo_start-end2video 成功响应（创建任务）
 */
export interface ViduQ3TurboStartEnd2VideoCreateResponse {
    output: {
        task_id: string;
        task_status: "PENDING";
    };
    request_id: string;
}

/**
 * vidu/viduq3-turbo_start-end2video 查询任务结果成功响应
 */
export interface ViduQ3TurboStartEnd2VideoQueryResponse {
    request_id: string;
    output: {
        task_id: string;
        task_status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "UNKNOWN";
        submit_time: string;
        scheduled_time?: string;
        end_time?: string;
        orig_prompt?: string;
        video_url?: string;
    };
    usage?: {
        duration: number;
        size: string;
        output_video_duration: number;
        fps: number;
        video_count: number;
        audio: boolean;
        SR: string;
    };
}

/**
 * vidu/viduq3-turbo_start-end2video 异常响应
 */
export interface ViduQ3TurboStartEnd2VideoErrorResponse {
    code: string;
    message: string;
    request_id: string;
}
