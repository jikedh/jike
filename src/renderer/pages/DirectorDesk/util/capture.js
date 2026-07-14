import {
  DIRECTOR_DESK_MESSAGE_PROTOCOL,
  DIRECTOR_DESK_MESSAGE_VERSION,
} from '../../../../shared/types/DirectorDeskMessage.ts';

// 截图：按当前取景比例裁剪、隐藏辅助物（§5.7）
// 依赖 renderer 在创建时已设 preserveDrawingBuffer:true。

/**
 * 截一张图。
 * @param {object} opts
 * @param {THREE.WebGLRenderer} opts.renderer
 * @param {THREE.Scene} opts.scene
 * @param {THREE.Camera} opts.camera
 * @param {HTMLElement} opts.viewport - 视口容器（用于换算像素比与取景框位置）
 * @param {{x:number,y:number,w:number,h:number}|null} opts.frameRect - 取景框 CSS 像素矩形；null=全幅
 * @param {Function} opts.beforeRender - 隐藏辅助物（gizmo/grid/名牌）
 * @param {Function} opts.afterRender - 恢复辅助物
 * @returns {{dataUrl:string,width:number,height:number}} PNG data URL 及其像素尺寸
 */
export function capture({ renderer, scene, camera, viewport, frameRect, beforeRender, afterRender }) {
  beforeRender && beforeRender();
  renderer.render(scene, camera); // 强制渲染一帧，确保 buffer 最新
  const cv = renderer.domElement;

  let url;
  let width = cv.width;
  let height = cv.height;
  if (frameRect && frameRect.w > 0 && frameRect.h > 0) {
    // 画布物理像素 / CSS 像素 的比例
    const px = cv.width / viewport.clientWidth;
    const py = cv.height / viewport.clientHeight;
    const cw = Math.max(1, Math.round(frameRect.w * px));
    const ch = Math.max(1, Math.round(frameRect.h * py));
    const ox = Math.round(frameRect.x * px);
    const oy = Math.round(frameRect.y * py);
    const tmp = document.createElement('canvas');
    tmp.width = cw; tmp.height = ch;
    tmp.getContext('2d').drawImage(cv, ox, oy, cw, ch, 0, 0, cw, ch);
    url = tmp.toDataURL('image/png');
    width = cw;
    height = ch;
  } else {
    url = cv.toDataURL('image/png');
  }

  afterRender && afterRender();
  return { dataUrl: url, width, height };
}

/** 下载一张 dataURL 图片。 */
export function downloadDataURL(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/** 向同源父页面发布受版本保护的导演台消息。 */
const postToCanvas = (message) => {
  if (window.parent === window) {
    return false;
  }

  window.parent.postMessage(
    {
      protocol: DIRECTOR_DESK_MESSAGE_PROTOCOL,
      version: DIRECTOR_DESK_MESSAGE_VERSION,
      ...message,
    },
    window.location.origin,
  );
  return true;
};

/** 通知父页面 iframe 已经可以接收交互。 */
export const notifyDirectorDeskReady = () => postToCanvas({ type: 'ready' });

/** 请求父页面关闭导演台工作区。 */
export const closeDirectorDesk = () => postToCanvas({ type: 'close' });

/** 将用户选中的截图作为图片集合发送到画布。 */
export const sendToCanvas = (images) =>
  postToCanvas({
    type: 'send-images',
    images,
  });
