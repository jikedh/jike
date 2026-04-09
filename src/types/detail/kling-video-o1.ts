export interface KlingVideoO1Request {
    model: string; // 视频生成模型名称（必填），固定为 "kling-video-o1"
    prompt: string; // 文字提示词（必填），支持 <<<image_N>>> 语法引用 image_urls 中的图片，N 从 1 开始
    mode?: string; // 生成模式，可选值："std"(标准模式，720P) | "pro"(专业模式，1080P)，默认 "std"
    duration?: number; // 视频时长（秒），可选值：5 | 10，默认 5
    aspect_ratio?: string; // 视频宽高比，可选值："16:9"(横屏，默认) | "9:16"(竖屏) | "1:1"(方形)
    image_urls?: string[]; // 图片 URL 数组，用于图片引用，在 prompt 中通过 <<<image_N>>> 引用对应位置的图片（N 从 1 开始）
    video_list?: {
        // 参考视频列表，最多 1 段视频
        video_url: string; // 视频 URL（必填），必须公开可访问，仅支持 MP4/MOV 格式，时长不少于 3 秒，分辨率 720px-2160px，帧率 24-60fps，大小不超过 200MB
        refer_type?: string; // 参考类型，可选值："base"(待编辑视频，默认) | "feature"(特征参考视频)
        keep_original_sound?: string; // 是否保留原视频声音，可选值："yes"(保留原声) | "no"(不保留，默认)
    }[]; // 最多 1 段视频
    metadata?: {
        // 扩展参数
        watermark?: boolean; // 是否添加水印
    };
}

export interface KlingVideoO1Response {
    id: string; // 任务唯一标识符，用于查询任务状态
    object: string; // 对象类型，固定为 "generation.task"
    model: string; // 使用的模型名称（如 "kling-video-o1"）
    status: 'queued' | 'in_progress' | 'completed' | 'failed'; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
    progress: number; // 任务进度百分比（0-100）
    created_at: number; // 任务创建时间戳（Unix 时间戳）
    completed_at?: number; // 任务完成时间戳（Unix 时间戳）
    expires_at?: number; // 任务过期时间戳（Unix 时间戳）
    result?: {
        // 任务结果
        type: string; // 结果类型（如 "video"）
        data: Array<{
            // 结果数据
            url: string; // 视频 URL
            format: string; // 视频格式（如 "mp4"）
        }>;
    };
    metadata?: {
        // 任务元数据
        seed?: number; // 种子值
    };
}
