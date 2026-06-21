// react-scan 必须在 React / ReactDOM 之前导入，且仅在开发环境启用
// 通过 import.meta.env.DEV 守卫，生产构建时该分支会被 Vite tree-shake
if (import.meta.env.DEV) {
  import("react-scan").then(({ scan }) => {
    scan({ enabled: true });
  });
}

import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ensureTauriApis } from "./services/tauri-bridge";

// Tauri 适配层：在 React 挂载前将 storage/debug/download/videoProcessing/
// notification/tracking 挂到 window，使既有 30+ 处业务调用零改动
ensureTauriApis();

// tset
createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <App />,
  // {/* </StrictMode>, */}
);
