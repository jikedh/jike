import { Toaster } from "sonner";

/**
 * 消息容器组件
 * 使用 sonner 的 Toaster 在应用顶部中央显示所有消息
 *
 * Sonner 默认配置：
 * - 位置：top-center（顶部中央）
 * - 主题：dark（暗色主题）
 * - 动画：全局 CSS 覆盖为紫色玻璃渐显
 */
export const ToastContainer: React.FC = () => {
  return (
    <Toaster
      position="top-center"
      theme="dark"
      closeButton
      duration={5000}
      gap={10}
      offset={24}
      className="jike-toast-system"
      toastOptions={{
        className: "jike-toast",
      }}
    />
  );
};

export default ToastContainer;
