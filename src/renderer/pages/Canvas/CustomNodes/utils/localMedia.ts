/**
 * 远端媒体引用工具
 *
 * 本项目图片资源统一使用 URL 形式引用，不再生成或持久化本地图片路径。
 * 这里仅保留一个“合并远程 URL 引用”的最小工具，原本的本地保存占位实现
 * 已被全部移除，调用点统一改为只写 url / remoteUrl。
 */

export const withRemoteMediaRef = <
  T extends { url: string; remoteUrl?: string },
>(
  item: T,
): T => ({
  ...item,
  remoteUrl: item.remoteUrl ?? item.url,
});
