import type { IpcMainEvent } from "electron";
import { BrowserWindow, ipcMain } from "electron";

// 这个文件是主进程 IPC 服务，仅在 main 进程中使用
type IpcMainListener = (event: IpcMainEvent, ...args: any[]) => void;

// 存储已注册的监听器，用于防止重复注册
const registeredListeners = new Map<string, IpcMainListener>();

export const ipcMainService = {
  on(channel: string, listener: IpcMainListener) {
    // 移除已存在的监听器，防止重复注册
    if (registeredListeners.has(channel)) {
      ipcMain.removeListener(channel, registeredListeners.get(channel)!);
    }

    // 拓展性考虑，增加代码的模块化和可维护性，可以负责处理错误或异常
    const wrappedListener = (event: IpcMainEvent, ...args: any[]) => {
      listener(event, ...args);
    };

    // 存储新的监听器
    registeredListeners.set(channel, wrappedListener);

    ipcMain.on(channel, wrappedListener);
  },
  send(channel: string, eventParams: any, webContentsId?: number) {
    const windows = BrowserWindow.getAllWindows();
    if (webContentsId === undefined) {
      // 如果没有提供 webContentsId，则向所有窗口发送消息
      windows.forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, eventParams);
        }
      });
    } else {
      // 向指定窗口发送消息
      const targetWindow = windows.find(
        (win) => !win.isDestroyed() && win.webContents.id === webContentsId,
      );
      if (targetWindow) {
        targetWindow.webContents.send(channel, eventParams);
      } else {
        console.warn(`No window found with webContents ID: ${webContentsId}`);
      }
    }
  },
  async invoke(channel: string, ...args: any[]): Promise<any> {
    throw new Error("Not supported in main process");
  },
  handle(channel: string, listener: (...args: any[]) => void) {
    ipcMain.handle(channel, listener);
  },
  // 同步等待结果返回，阻塞渲染进程
  sendSync(channel: string, ...args: any[]) {
    throw new Error("Not supported in main process");
  },
  once(channel: string, listener: () => void) {
    ipcMain.once(channel, listener as (...args: any[]) => void);
  },
  removeListener(channel: string, listener: () => void) {
    ipcMain.removeListener(channel, listener as (...args: any[]) => void);
  },
  // process: {
  //   // 行的平台名称
  //   get platform() { return process.platform; },
  //   // CPU架构类型
  //   get arch() { return process.arch; },
  //   // // 使用扩展运算符(...)来复制process.env对象，以避免直接暴露原始环境变量对象
  //   get env() { return { ...process.env }; },
  //   // 当前Node.js及其依赖模块的版本信息
  //   get versions() { return process.versions; },
  //   // 返回启动当前Node.js进程的可执行文件的绝对路径
  //   get execPath() { return process.execPath; }
  // }
};
