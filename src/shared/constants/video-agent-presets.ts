import type { VideoAgentPresetId } from "shared/types/flow";

export const VIDEO_AGENT_PRESETS: Record<
  VideoAgentPresetId,
  {
    id: VideoAgentPresetId;
    label: string;
    description: string;
    model: string;
    systemPrompt: string;
  }
> = {
  "video-pull-film": {
    id: "video-pull-film",
    label: "视频拉片",
    description: "分析视频内容，提取关键帧和剧情结构",
    model: "qwen3.5-flash",
    systemPrompt: `请分析这个视频的内容，按以下五个核心维度进行结构化输出：

## 输出格式要求
**必须**以 Markdown 表格形式返回，表格列依次为：时间点 | 场景描述 | 镜头类型 | 关键动作 | 画面构图 | 台词字幕 | 节奏分析

## 五个核心维度说明

### 1. 镜头类型
明确标注每个片段的：
- 景别：远景、全景、中景、近景、特写、大特写
- 机位运动：固定、推、拉、摇、移、跟、升降、手持、综合运动

### 2. 关键动作
按时间码分段描述：
- 人物或主体的主要动作
- 表情变化
- 走位调度
- 道具交互

### 3. 画面构图
解析并指出：
- 构图方式：对称、三分法、引导线、框架、留白、景深层次、色彩对比等
- 视觉重心位置
- 主体与背景关系

### 4. 台词字幕
逐句提取：
- 对白/旁白/字幕内容
- 起止时间码
- 角色标注
- 语气类型（陈述、疑问、情绪爆发、沉默等）

### 5. 节奏分析
给出：
- 各镜头时长
- 剪辑频率（Cut Rate，即每秒剪辑切换次数）
- 音乐节拍吻合度分析
- 整体节奏曲线（快-慢-快或快-慢-渐快等）
- 情绪起伏结论

## 注意事项
- 时间点格式统一使用 "分:秒" 或 "时:分:秒"
- 每个片段一行，确保表格完整覆盖视频全程
- 如某维度无内容，填写 "-" 勿留空
- 表格后可附上整体分析总结（500字以内）`,
  },
};

export const VIDEO_AGENT_PRESET_LIST = Object.values(VIDEO_AGENT_PRESETS);

export const getVideoAgentPresetById = (presetId?: VideoAgentPresetId) => {
  const defaultPreset = VIDEO_AGENT_PRESETS["video-pull-film"];
  if (!presetId) {
    return defaultPreset;
  }
  return VIDEO_AGENT_PRESETS[presetId] ?? defaultPreset;
};

export const isVideoAgentPresetId = (
  value?: string,
): value is VideoAgentPresetId => {
  if (!value) {
    return false;
  }
  return value in VIDEO_AGENT_PRESETS;
};

export const getVideoAgentPresetLabelById = (presetId?: string) => {
  if (isVideoAgentPresetId(presetId)) {
    return VIDEO_AGENT_PRESETS[presetId].label;
  }
  return VIDEO_AGENT_PRESETS["video-pull-film"].label;
};

/** 视频智能体可用模型（当前仅支持 qwen3.5-flash） */
export const VIDEO_AGENT_MODELS = [
  { value: "qwen3.5-flash", label: "Qwen 3.5 Flash (阿里云百炼)" },
];
