"use client";


interface PanoramaControlsProps {
  onScreenshotSingle: () => void;
  onScreenshot4: () => void;
  onScreenshot12: () => void;
  onRecenter: () => void;
  onChangeImage: () => void;
}

export function PanoramaControls({
  onScreenshotSingle,
  onScreenshot4,
  onScreenshot12,
  onRecenter,
  onChangeImage,
}: PanoramaControlsProps) {
  return (
    <div className="fixed top-6 right-6 z-20 flex flex-col items-end gap-3">
      {/* 当前视角截图 */}
      <button
        onClick={onScreenshotSingle}
        className="glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center w-52"
        title="截取当前视角的画面"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        当前视角截图
      </button>

      {/* 四宫格截图 */}
      <button
        onClick={onScreenshot4}
        className="glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center w-52"
        title="以当前视角为前方的四方向截图"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
        四宫格截图 (2x2)
      </button>

      {/* 十二宫格截图 */}
      <button
        onClick={onScreenshot12}
        className="glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center w-52"
        title="上排仰视，中排平视，下排俯视"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
        十二宫格截图 (4x3)
      </button>

      {/* 重置视角 */}
      <button
        onClick={onRecenter}
        className="glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center w-52"
        title="重置视角到原点"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        重置视角
      </button>

      {/* 更换图片 */}
      <button
        onClick={onChangeImage}
        className="glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center w-52"
      >
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        更换图片
      </button>
    </div>
  );
}
