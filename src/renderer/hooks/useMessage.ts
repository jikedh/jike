import { toast } from "sonner";
import type { MessageType, MessagePayload } from "shared/types/message";

const success = (
  title: string,
  description?: string,
  duration?: number,
): string => {
  const id = toast.success(title, {
    description,
    duration: duration ?? 5000,
  });
  return id as string;
};

const error = (
  title: string,
  description?: string,
  duration?: number,
): string => {
  const id = toast.error(title, {
    description,
    duration: duration ?? 5000,
  });
  return id as string;
};

const warning = (
  title: string,
  description?: string,
  duration?: number,
): string => {
  const id = toast.warning(title, {
    description,
    duration: duration ?? 5000,
  });
  return id as string;
};

const info = (
  title: string,
  description?: string,
  duration?: number,
): string => {
  const id = toast.info(title, {
    description,
    duration: duration ?? 5000,
  });
  return id as string;
};

const show = (payload: MessagePayload): string => {
  const { type, title, description, duration } = payload;
  const id = toast[type as MessageType](title, {
    description,
    duration: duration ?? 5000,
  });
  return id as string;
};

const dismiss = (id: string) => {
  toast.dismiss(id);
};

const clear = () => {
  toast.dismiss();
};

const messageApi = {
  success,
  error,
  warning,
  info,
  show,
  dismiss,
  clear,
};

/**
 * 消息提示Hook
 * 使用 sonner 组件提供简洁的API来显示各种类型的消息
 *
 * 使用示例：
 * const { success, error, warning, info } = useMessage()
 * success('操作成功！')
 * error('操作失败', '详细错误信息')
 * warning('请注意', 3000) // 3秒后关闭
 */
export const useMessage = () => messageApi;

export default useMessage;
