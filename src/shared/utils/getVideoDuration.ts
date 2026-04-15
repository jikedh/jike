/**
 * 获取视频 URL 的时长（秒）
 * 使用 HTML5 Video 元素加载视频元数据
 * @param url 视频 URL
 * @returns 视频时长（秒），获取失败返回 null
 */
export const getVideoDuration = (url: string): Promise<number | null> => {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";

    // 超时处理：10秒未获取到时长则放弃
    const timeout = setTimeout(() => {
      video.src = "";
      video.load();
      resolve(null);
    }, 10000);

    video.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve(video.duration);
      video.src = "";
      video.load();
    };

    video.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    video.src = url;
  });
};

/**
 * 格式化时长为 mm:ss 格式
 * @param seconds 秒数
 * @returns 格式化后的字符串，如 "01:30"
 */
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};
