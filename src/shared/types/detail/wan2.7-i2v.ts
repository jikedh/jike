export interface Wan27I2vRequest {
  model: string; // 视频生成模型名称（必填），固定为 "wan2.7-i2v"
  input: {
    // 输入参数
    prompt: string; // 视频内容描述（必填）
    media: Array<{
      // 媒体素材数组
      type: string; // 媒体类型，first_frame：首帧，last_frame：尾帧，driving_audio：驱动音频，first_clip：首视频片段：first_clip

      url: string; // 媒体 URL
    }>;
  };
  parameters: {
    // 生成参数
    resolution?: string; // 视频分辨率，可选值："720P" | "1080P"，默认 "720P"
    duration?: number; // 视频时长（秒），可选值：4 | 5 | 10，默认 4
    // prompt_extend?: boolean; // 自动扩展提示词，默认 true
    // watermark?: boolean; // 在生成的视频上添加水印，默认 true
  };
  requiredPoints: number; // 本次生成预计消耗积分
}

// export interface Wan27I2vResponse {
//   id: string; // 任务唯一标识符，用于查询任务状态
//   object: string; // 对象类型，固定为 "generation.task"
//   model: string; // 使用的模型名称
//   status: "queued" | "in_progress" | "completed" | "failed"; // 任务状态：queued-排队等待处理，in_progress-处理中，completed-成功完成，failed-失败
//   progress: number; // 任务进度百分比（0-100）
//   created_at: number; // 任务创建时间戳（Unix 时间戳）
//   completed_at?: number; // 任务完成时间戳（Unix 时间戳）
//   expires_at?: number; // 任务过期时间戳（Unix 时间戳）
//   result?: {
//     // 任务结果
//     videos: Array<{
//       // 生成的视频列表
//       url: string; // 视频 URL
//       duration: number; // 视频时长（秒）
//       resolution: string; // 视频分辨率
//     }>;
//   };
//   metadata?: {
//     // 任务元数据
//     seed?: number; // 种子值
//   };
// }
