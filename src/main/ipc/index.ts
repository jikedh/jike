import { registerDatabaseHandlers } from "./database";
import { registerDebugHandlers } from "./debug";
import { registerDownloadHandlers } from "./download";
import { registerStorageHandlers } from "./storage";

/**
 * IPC Handler 模块定义
 * 每个模块负责注册自己领域内的 IPC 通道
 */
const ipcHandlerModules = [
  {
    name: "storage",
    register: registerStorageHandlers,
  },
  {
    name: "debug",
    register: registerDebugHandlers,
  },
  {
    name: "download",
    register: registerDownloadHandlers,
  },
  {
    name: "database",
    register: registerDatabaseHandlers,
  },
] as const;

/**
 * 已注册模块缓存
 * 解决 app 激活后重复创建窗口时的重复注册问题
 */
const registeredIpcModules = new Set<string>();

/**
 * 注册单个 IPC 模块
 */
const registerIpcModule = (module: (typeof ipcHandlerModules)[number]) => {
  if (registeredIpcModules.has(module.name)) {
    return;
  }

  module.register();
  registeredIpcModules.add(module.name);
};

/**
 * 统一注册全部 IPC handler
 */
export const registerAllIpcHandlers = () => {
  ipcHandlerModules.forEach(registerIpcModule);
};

export { registerDatabaseHandlers } from "./database";
export { registerDebugHandlers } from "./debug";
export { registerDownloadHandlers } from "./download";
export { registerStorageHandlers } from "./storage";
