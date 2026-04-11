import useMessage from "@/hooks/useMessage";

/**
 * 消息演示组件
 * 在DevTools中添加测试按钮，用于演示各种类型的消息提示
 */
export default function MessageDemo() {
  const { success, error, warning, info } = useMessage();

  return (
    <div className="react-flow__devtools-message-demo">
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 10,
          width: 240,
          backgroundColor: "white",
          border: "1px solid #e5e7eb",
          borderRadius: "8px",
          padding: "12px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          zIndex: 1000,
        }}
      >
        <h4 style={{ margin: "0 0 8px 0", fontSize: "12px", fontWeight: 600 }}>
          消息演示
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            onClick={() => success("操作成功！", "消息已成功显示")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Success Message
          </button>

          <button
            onClick={() => error("操作失败！", "发生了一个错误")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Error Message
          </button>

          <button
            onClick={() => warning("请注意！", "这是一条警告消息")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#f59e0b",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Warning Message
          </button>

          <button
            onClick={() => info("提示信息", "这是一条信息消息")}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Info Message
          </button>

          <button
            onClick={() => {
              success("快速消息");
              success("快速消息"); // 应该被去重
              success("快速消息"); // 应该被去重
            }}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: "#8b5cf6",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "opacity 0.2s",
              borderTop: "1px solid #e5e7eb",
              paddingTop: "12px",
              marginTop: "6px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.9";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            Test Deduplication
          </button>
        </div>
      </div>
    </div>
  );
}
