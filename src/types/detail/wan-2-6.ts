export interface Wan26Request {
    model: string; // 视频生成模型名称（必填），固定为 "wan2.6"
    prompt: string; // 视频内容描述（必填），文生视频模式下必填；图生视频和参考视频模式下可选
    image_urls?: string[]; // 参考图片 URL 数组（图生视频模式，仅支持 1 张图片），仅支持 URL 格式，与 metadata.reference_urls 不能同时使用
    aspect_ratio?: string; // 视频宽高比（适用于文生视频和参考视频模式），可选值："16:9"(横屏，默认) | "9:16"(竖屏) | "1:1"(方形) | "4:3"(横屏) | "3:4"(竖屏)，注意：图生视频模式不支持此参数
    resolution?: string; // 视频分辨率，可选值："720p"(标清) | "1080p"(高清，默认)，不支持 480p
    duration?: number; // 视频时长（秒），可选值：5 | 10 | 15，默认 5
    negative_prompt?: string; // 负面提示词，描述不希望出现的内容
    seed?: number; // 随机种子，用于复现结果
    prompt_extend?: boolean; // 自动扩展提示词，默认 true，设为 false 可禁用
    audio?: boolean; // 在视频中添加音频，非 Flash 版本默认输出有声视频
    shot_type?: string; // 镜头类型（适用于文生视频和参考视频模式），可选值："single"(单镜头) | "multi"(多镜头，电影式剪辑)
    watermark?: boolean; // 在生成的视频上添加阿里云水印
    metadata?: {
        // 扩展参数
        reference_urls?: string[]; // 参考视频 URL 数组（r2v 模式），用于参考视频生成，与 image_urls 不能同时使用
    };
}

export interface Wan26Response {
    id: string; // 任务唯一标识符，用于查询任务状态
    object: string; // 对象类型，固定为 "generation.task"
    model: string; // 使用的模型名称
    status: 'queued' | 'in_progress' | 'completed' | 'failed'; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
    progress: number; // 任务进度百分比（0-100）
    created_at: number; // 任务创建时间戳（Unix 时间戳）
    metadata?: {
        // 任务元数据
        seed?: number; // 种子值
    };
}
