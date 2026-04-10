// 消息类型
export type MessageType = "success" | "error" | "warning" | "info";

// 消息载荷
export type MessagePayload = {
  type: MessageType; // 消息类型
  title: string; // 标题
  description?: string; // 描述
  duration?: number; // 显示时长（毫秒）
};
