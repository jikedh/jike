export interface MiniMaxH3Request {
    model: "MiniMax-H3"; // 模型名称：当前接口仅支持 MiniMax-H3
    content: {
        type: "text" | "image_url" | "video_url" | "audio_url"; // 输入内容类型
        text?: string; // 文本提示词：每次请求必须包含一个非空 text 项，最多 7000 字符
        image_url?: {
            url: string; // 图片地址：支持公网 URL、mm_file:// 或 Base64 data URI
        };
        video_url?: {
            url: string; // 视频地址：仅多模态参考生视频可用
        };
        audio_url?: {
            url: string; // 音频地址：仅多模态参考生视频可用
        };
        role?:
        | "first_frame"
        | "last_frame"
        | "reference_image"
        | "reference_video"
        | "reference_audio"; // 媒体用途：首尾帧或多模态参考素材
    }[]; // 多模态输入列表：必须包含 text 项，首尾帧与参考素材不能混用
    resolution: "768P" | "2K"; // 视频分辨率
    duration: 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15; // 视频时长（秒）
    ratio?: "adaptive" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16"; // 文生视频必填且不能为 adaptive
    callback_url?: string; // 任务状态变更回调地址
    aigc_watermark?: boolean; // 是否添加 AIGC 标识水印，默认 false
}

export interface MiniMaxH3Response {
    task_id: string; // 任务唯一标识符，用于查询任务状态与结果
}

export interface MiniMaxH3StatusResponse {
    task: {
        id: string; // 任务唯一标识符
        model: "MiniMax-H3"; // 生成所使用的模型
        status: "queued" | "running" | "succeeded" | "failed" | "cancelled"; // 任务状态
        created_at: number; // 创建时间戳（秒）
        updated_at: number; // 最近更新时间戳（秒）
        content?: {
            url: string; // 任务成功后生成视频的访问地址
        };
        resolution: "768P" | "2K"; // 实际生成视频分辨率
        duration: number; // 实际生成视频时长（秒）
        usage?: {
            total_seconds?: number; // 总计费时长（秒）
            input_seconds?: number; // 输入参考视频或音频的计费时长（秒）
            output_seconds?: number; // 输出视频的计费时长（秒）
            input_image_count?: number; // 输入图片数量
        };
        ratio: "adaptive" | "21:9" | "16:9" | "4:3" | "1:1" | "3:4" | "9:16"; // 实际生成视频宽高比
        task_type: "generation"; // 任务类型
        modality: "video"; // 输出模态
        error?: {
            type?: string; // 错误类型
            message?: string; // 错误详情
        };
    };
}
