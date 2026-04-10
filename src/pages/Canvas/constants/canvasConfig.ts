import { NoteNode } from "../CustomNodes/NoteNode";
import { ImageNode } from "../CustomNodes/ImageNode";
import { VideoNode } from "../CustomNodes/VideoNode";
import { AgentNode } from "../CustomNodes/AgentNode";
import { TextAgentNode } from "../CustomNodes/TextAgentNode";
import { PanoramaNode } from "../CustomNodes/PanoramaNode";
import { AudioNode } from "../CustomNodes/AudioNode";
import { TableNode } from "../CustomNodes/TableNode";
import type { AgentPresetId } from "@/constants/agent-presets";
import { CustomEdge } from "../CustomEdge/CustomEdge";

export const nodeTypes = {
  noteNode: NoteNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  agentNode: AgentNode,
  textAgentNode: TextAgentNode,
  panoramaNode: PanoramaNode,
  audioNode: AudioNode,
  tableNode: TableNode,
};

/**
 * 自定义边类型映射
 * 使用 EdgeToolbar 在边的中心点显示删除按钮
 */
export const edgeTypes = {
  default: CustomEdge,
};

/**
 * 侧边栏动作到智能体预设 ID 的映射
 */
export const assistantActionToPresetId: Record<string, AgentPresetId> = {
  "novel-to-script-agent": "novel-to-script-agent",
  "short-video-script-agent": "short-video-script-agent",
};
