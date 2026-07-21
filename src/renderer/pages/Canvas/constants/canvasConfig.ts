import { CustomEdge } from "../CustomEdge/CustomEdge";
import { AgentNode } from "../CustomNodes/AgentNode";
import { AudioNode } from "../CustomNodes/AudioNode";
import { DirectorDeskNode } from "../CustomNodes/DirectorDeskNode";
import { ImageAgentNode } from "../CustomNodes/ImageAgentNode";
import { ImageNode } from "../CustomNodes/ImageNode";
import { NoteNode } from "../CustomNodes/NoteNode";
import { PanoramaNode } from "../CustomNodes/PanoramaNode";
import { TableNode } from "../CustomNodes/TableNode";
import { TextAgentNode } from "../CustomNodes/TextAgentNode";
import { VideoAgentNode } from "../CustomNodes/VideoAgentNode";
import NewVideoNode from "../CustomNodes/New-VideoNode";

// 画布节点及其小地图使用同一套类型颜色；新增节点类型时仅需在此补充颜色。
export const CANVAS_NODE_COLORS: Record<string, string> = {
  imageNode: "#38BDF8",
  newVideoNode: "#FB7185",
  audioNode: "#A78BFA",
  noteNode: "#FBBF24",
  tableNode: "#2DD4BF",
  panoramaNode: "#60A5FA",
  directorDeskNode: "#F97316",
  agentNode: "#B43FEB",
  textAgentNode: "#B43FEB",
  imageAgentNode: "#B43FEB",
  videoAgentNode: "#B43FEB",
};

export const DEFAULT_CANVAS_NODE_COLOR = "#B43FEB";

/**
 * 优先读取节点数据中可动态变更的颜色和类型，再回退到 React Flow 节点类型。
 * 业务节点可通过 data.miniMapColor 或 data.miniMapType 覆盖默认的类型映射。
 */
export const getCanvasNodeColor = (node: {
  type?: string;
  data?: Record<string, unknown>;
}) => {
  const color = node.data?.miniMapColor;
  if (typeof color === "string" && color) {
    return color;
  }

  const dataType = node.data?.miniMapType ?? node.data?.type;
  const type = typeof dataType === "string" ? dataType : node.type;
  return CANVAS_NODE_COLORS[type ?? ""] ?? DEFAULT_CANVAS_NODE_COLOR;
};

export const nodeTypes = {
  noteNode: NoteNode,
  imageNode: ImageNode,
  newVideoNode: NewVideoNode,
  agentNode: AgentNode,
  textAgentNode: TextAgentNode,
  imageAgentNode: ImageAgentNode,
  videoAgentNode: VideoAgentNode,
  panoramaNode: PanoramaNode,
  directorDeskNode: DirectorDeskNode,
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
