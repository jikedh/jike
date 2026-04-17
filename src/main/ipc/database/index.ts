import { appStore } from "../../modules/database";

/**
 * Database IPC Handlers
 * 复用已有 appStore 模块中的 IPC 通道注册逻辑
 */
export const registerDatabaseHandlers = () => {
  appStore.registerModule();
};
