import { CustomEdge } from "../CustomEdge/CustomEdge";
import { AgentNode } from "../CustomNodes/AgentNode";
import { AudioNode } from "../CustomNodes/AudioNode";
import { ImageAgentNode } from "../CustomNodes/ImageAgentNode";
import { ImageNode } from "../CustomNodes/ImageNode";
import { NoteNode } from "../CustomNodes/NoteNode";
import { PanoramaNode } from "../CustomNodes/PanoramaNode";
import { TableNode } from "../CustomNodes/TableNode";
import { TextAgentNode } from "../CustomNodes/TextAgentNode";
import { VideoAgentNode } from "../CustomNodes/VideoAgentNode";
import { VideoNode } from "../CustomNodes/VideoNode";
import { VideoDemoNode } from "../CustomNodes/VideoDemoNode";

export const nodeTypes = {
  noteNode: NoteNode,
  imageNode: ImageNode,
  videoNode: VideoNode,
  videoDemoNode: VideoDemoNode,
  agentNode: AgentNode,
  textAgentNode: TextAgentNode,
  imageAgentNode: ImageAgentNode,
  videoAgentNode: VideoAgentNode,
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
