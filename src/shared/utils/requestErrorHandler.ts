import { isAxiosError } from "axios";
import { toast } from "sonner";

// ===================== 全局请求错误处理 =====================

/**
 * 根据 HTTP 状态码映射默认错误文案。
 */
const getStatusText = (status?: number): string => {
  const statusMap: Record<number, string> = {
    400: "请求参数有误",
    401: "认证失败，请检查密钥或重新登录",
    403: "无权限访问该资源",
    404: "请求资源不存在",
    408: "请求超时，请稍后重试",
    409: "请求冲突，请稍后重试",
    413: "请求内容过大",
    415: "不支持的请求类型",
    422: "请求数据校验失败",
    429: "请求过于频繁，请稍后再试",
    500: "服务器异常，请稍后重试",
    502: "网关错误，请稍后重试",
    503: "服务暂不可用，请稍后重试",
    504: "网关超时，请稍后重试",
  };

  if (!status) return "请求失败，请稍后重试";
  return statusMap[status] || `请求失败（${status}）`;
};

/**
 * 统一提取错误文案，供拦截器或业务层复用。
 */
export const getRequestErrorMessage = (error: any): string => {
  if (!error) return "未知错误";

  if (isAxiosError(error)) {
    const { status, data } = error.response ?? {};
    let serverMessage =
      data?.message || data?.msg || data?.error || data?.detail;

    if (serverMessage && typeof serverMessage !== "string") {
      serverMessage = JSON.stringify(serverMessage);
    }

    if (serverMessage) return serverMessage;
    return getStatusText(status);
  }

  return "请求失败，请稍后重试";
};

export const handleRequestError = (error: any) => {
  const message = getRequestErrorMessage(error);

  toast.error("请求失败", {
    description: message,
    duration: 5000,
  });
};
