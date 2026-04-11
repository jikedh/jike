import { Toaster } from "sonner";

/**
 * 消息容器组件
 * 使用 sonner 的 Toaster 在应用顶部中央显示所有消息
 *
 * Sonner 默认配置：
 * - 位置：top-center（顶部中央）
 * - 主题：light（浅色主题）
 * - 动画：内置平滑过渡动画
 */
export const ToastContainer: React.FC = () => {
  return (
    <Toaster
      position="top-center"
      theme="light"
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        style: {
          padding: "12px 16px",
          borderRadius: "8px",
        },
      }}
    />
  );
};

export default ToastContainer;
