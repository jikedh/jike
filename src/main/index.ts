import { initializeApp } from "./launch/init";

/**
 * Electron 主进程入口。
 * 这里只保留最薄的一层启动调用，便于后续维护启动链路。
 */
initializeApp();
