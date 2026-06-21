// Tauri 2 全局类型扩展
export { };

declare global {
    interface Window {
        __TAURI_INTERNALS__?: {
            invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
        };
        __TAURI__?: {
            invoke?: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
        };

        // 以下由 src/renderer/services/tauri-bridge.ts 注册
        // 类型为 any 以兼容原有 Electron 端消费代码（localStorageService.ts 等
        // 直接对返回对象做 .success/.data 字段访问）
        storage?: any;
        debug?: any;
        download?: any;
        videoProcessing?: any;
        notification?: any;
        tracking?: any;
        electron?: {
            ipcRenderer: {
                invoke: (channel: string, ...args: any[]) => Promise<any>;
                send: (channel: string, data?: any) => void;
            };
        };
    }
}
