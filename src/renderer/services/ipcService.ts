export const ipcRenderService = {
  send: (channel: string, data?: any) =>
    window.electron.ipcRenderer.send(channel, data),
  invoke: (channel: string, data?: any) =>
    window.electron.ipcRenderer.invoke(channel, data),
};
