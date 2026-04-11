export interface MJRequest {
  prompt: string; // 生成提示词，必填
  mode?: string; // 调用模式，如 RELAX:慢速模式，FAST: 快速模式，默认RELAX
  notifyHook?: string; // 结果回调地址
  base64Array?: string[]; // 图片数据的base64字符串数组
  state?: string; // 用于记录用户所需的自定义数据
}

export interface MJResponse {
  id: string; // 任务唯一标识符
  mode: string; // 调用模式，如 RELAX（慢速模式）、FAST（快速模式）
  action: string; // 操作类型，如 IMAGINE
  status: string; // 任务状态，如 SUCCESS、FAILED
  prompt: string; // 原始生成提示词
  promptEn: string; // 英文提示词
  description: string; // 任务描述
  submitTime: number; // 任务提交时间（Unix 时间戳）
  startTime: number; // 任务开始时间（Unix 时间戳）
  finishTime: number; // 任务完成时间（Unix 时间戳）
  progress: string; // 任务进度百分比，如 "100%"
  cost: number; // 任务消耗费用
  imageUrl: string; // 主要图片 URL
  imageUrls: Array<{ url: string }>; // 图片 URL 数组
  videoUrls: string[] | null; // 视频 URL 数组（可能为空）
  failReason: string | null; // 失败原因（任务失败时才有值）
  buttons: Array<{
    customId: string; // 按钮自定义标识符
    emoji: string; // 按钮表情图标
    label: string; // 按钮标签文本
    type: number; // 按钮类型
    style: number; // 按钮样式
  }>;
  properties: {
    // 扩展属性
    nonce: string; // 随机数标识
    botType: string; // 机器人类型，如 MID_JOURNEY
    notifyHook: string; // 回调通知地址
    finalPrompt: string; // 最终处理后的提示词
    messageHash: string; // 消息哈希值
    discordChannelId: string; // Discord 频道 ID
    discordInstanceId: string; // Discord 实例 ID
  };
  state: string; // 自定义状态数据
  seed: string; // 随机种子值
}
