import * as THREE from "three";
import { uploadFileToOSS } from "service/oss";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";

export interface ScreenshotOptions {
  type: "single" | "4grid" | "12grid";
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
}

export interface UploadPanoramaScreenshotOptions {
  dataUrl: string;
  type: "single" | "4grid" | "12grid";
}

/**
 * 获取当前屏幕正中心的偏航角(Yaw)
 */
export function getCurrentBaseYaw(camera: THREE.PerspectiveCamera): number {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Three.js 默认朝向 -Z，使用 atan2(x, z) 得到当前角度
  return Math.atan2(dir.x, dir.z);
}

/**
 * 根据偏航角(Yaw)和俯仰角(Pitch)获取目标看向的三维坐标点
 */
export function getTargetPosition(yaw: number, pitch: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(yaw),
  );
}

/**
 * 执行截图并返回图片数据，调用方决定后续是下载、上传还是写入节点。
 */
export async function takeScreenshot(
  options: ScreenshotOptions,
): Promise<string> {
  const { type, renderer, camera, scene } = options;

  // 保存当前状态
  const origWidth = window.innerWidth;
  const origHeight = window.innerHeight;
  const origAspect = camera.aspect;
  const origPos = camera.position.clone();
  const origQuat = camera.quaternion.clone();

  // 单张截图使用固定分辨率
  if (type === "single") {
    renderer.setSize(1920, 1080);
    camera.aspect = 1920 / 1080;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);

    const dataURL = renderer.domElement.toDataURL("image/jpeg", 0.95);

    // 恢复状态
    renderer.setSize(origWidth, origHeight);
    camera.aspect = origAspect;
    camera.updateProjectionMatrix();
    return dataURL;
  }

  // 多宫格截图
  const cellW = 960;
  const cellH = 540;
  const cols = type === "4grid" ? 2 : 4;
  const rows = type === "12grid" ? 3 : 2;

  const finalWidth = cellW * cols;
  const finalHeight = cellH * rows;

  // 创建离屏 Canvas
  const canvasObj = document.createElement("canvas");
  canvasObj.width = finalWidth;
  canvasObj.height = finalHeight;
  const ctx = canvasObj.getContext("2d")!;

  // 切换渲染器到单个格子分辨率
  renderer.setSize(cellW, cellH);
  camera.aspect = cellW / cellH;
  camera.updateProjectionMatrix();

  // 获取当前视角基础角度
  const baseYaw = getCurrentBaseYaw(camera);
  const imagesData: { src: string; x: number; y: number }[] = [];

  // 生成截图
  if (type === "4grid") {
    // 四宫格: 当前平视四个方向
    for (let i = 0; i < 4; i++) {
      const yaw = baseYaw - i * (Math.PI / 2);
      camera.position.set(0, 0, 0);
      camera.lookAt(getTargetPosition(yaw, 0));
      renderer.render(scene, camera);

      imagesData.push({
        src: renderer.domElement.toDataURL("image/jpeg", 0.95),
        x: (i % 2) * cellW,
        y: Math.floor(i / 2) * cellH,
      });
    }
  } else if (type === "12grid") {
    // 十二宫格: 仰视/平视/俯视
    const pitchUp = Math.PI / 4;
    const pitchDown = -Math.PI / 4;

    for (let col = 0; col < 4; col++) {
      // 调整偏航角映射，使主视图落在第二列
      const yaw = baseYaw + (1 - col) * (Math.PI / 2);

      // 仰视
      camera.position.set(0, 0, 0);
      camera.lookAt(getTargetPosition(yaw, pitchUp));
      renderer.render(scene, camera);
      imagesData.push({
        src: renderer.domElement.toDataURL("image/jpeg", 0.95),
        x: col * cellW,
        y: 0,
      });

      // 平视
      camera.position.set(0, 0, 0);
      camera.lookAt(getTargetPosition(yaw, 0));
      renderer.render(scene, camera);
      imagesData.push({
        src: renderer.domElement.toDataURL("image/jpeg", 0.95),
        x: col * cellW,
        y: cellH,
      });

      // 俯视
      camera.position.set(0, 0, 0);
      camera.lookAt(getTargetPosition(yaw, pitchDown));
      renderer.render(scene, camera);
      imagesData.push({
        src: renderer.domElement.toDataURL("image/jpeg", 0.95),
        x: col * cellW,
        y: cellH * 2,
      });
    }
  }

  // 恢复相机状态
  renderer.setSize(origWidth, origHeight);
  camera.aspect = origAspect;
  camera.position.copy(origPos);
  camera.quaternion.copy(origQuat);
  camera.updateProjectionMatrix();

  // 将截图绘制到 Canvas
  for (const item of imagesData) {
    const img = new Image();
    await new Promise<void>((resolve) => {
      img.onload = () => {
        ctx.drawImage(img, item.x, item.y, cellW, cellH);
        resolve();
      };
      img.src = item.src;
    });
  }

  // 绘制白色边框分隔线
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();

  // 纵向分隔线
  for (let i = 1; i < cols; i++) {
    ctx.moveTo(i * cellW, 0);
    ctx.lineTo(i * cellW, finalHeight);
  }

  // 横向分隔线
  for (let j = 1; j < rows; j++) {
    ctx.moveTo(0, j * cellH);
    ctx.lineTo(finalWidth, j * cellH);
  }

  ctx.stroke();

  // 返回最终合成的截图数据，交给调用方决定如何使用
  const finalDataURL = canvasObj.toDataURL("image/jpeg", 0.95);
  return finalDataURL;
}

/**
 * 将全景截图 dataURL 上传到 OSS，并返回可直接回显的远程地址。
 */
export const uploadPanoramaScreenshot = async (
  options: UploadPanoramaScreenshotOptions,
) => {
  const { dataUrl, type } = options;

  const response = await fetch(dataUrl);
  const blob = await response.blob();

  const fileName = `panorama-${type}-${Date.now()}.jpg`;
  const file = new File([blob], fileName, {
    type: blob.type || "image/jpeg",
  });

  let fileToUpload = file;
  if (file.size > MAX_IMAGE_SIZE_MB) {
    console.log(
      `[上传图片] 文件大小 ${(file.size / 1024 / 1024).toFixed(2)}MB 超过 10MB，开始压缩...`,
    );
    fileToUpload = await compressImage(file);
  }

  const uploadResult = await uploadFileToOSS(fileToUpload);
  if (!uploadResult.url) {
    throw new Error("截图上传失败，未返回图片地址");
  }

  return uploadResult.url;
};

/**
 * 重置相机视角
 */
export function recenterCamera(
  camera: THREE.PerspectiveCamera,
  controls: any,
): void {
  camera.position.set(0, 0, 0.1);
  camera.fov = 75;
  camera.updateProjectionMatrix();
  if (controls.target) {
    controls.target.set(0, 0, 0);
  }
  controls.update();
}
