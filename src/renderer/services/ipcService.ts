export const ipcRenderService = {
  send: (channel: string, data?: any) =>
    window.electronApi.ipcService.send(channel, data),
  invoke: (channel: string, data?: any) =>
    window.electronApi.ipcService.invoke(channel, data),
};
