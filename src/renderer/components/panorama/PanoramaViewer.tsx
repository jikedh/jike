"use client";

import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useReactFlow } from "@xyflow/react";
import { toast } from "sonner";

import { GenerationStatus } from "shared/constants/enum";
import { uploadFileToOSS } from "service/oss";
import { compressImage, MAX_IMAGE_SIZE_MB } from "shared/utils/imageCompress";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import { useCanvasFlowStore } from "@/store/canvasFlowStore";
import { PanoramaCanvas } from "./PanoramaCanvas";
import { PanoramaControls } from "./PanoramaControls";
import { PanoramaLoading } from "./PanoramaLoading";
import { takeScreenshot, recenterCamera } from "shared/lib/panorama";

export interface PanoramaViewerProps {
  open: boolean;
  onClose: () => void;
  initialImage?: string;
  sourceNodeId?: string | null;
}

export function PanoramaViewer({
  open,
  onClose,
  initialImage,
  sourceNodeId,
}: PanoramaViewerProps) {
  // 状态管理
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadingText, setLoadingText] = React.useState("正在处理全景图...");

  // Three.js 引用
  const rendererRef = React.useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = React.useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = React.useRef<THREE.Scene | null>(null);
  const controlsRef = React.useRef<OrbitControls | null>(null);

  // 通过 React Flow 获取画布坐标转换能力，方便把新节点放到画布中心
  const { screenToFlowPosition } = useReactFlow<AllNodeType, EdgeType>();

  // 复用画布 store 中的节点操作能力
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const updateImageNodeData = useCanvasFlowStore(
    (state) => state.updateImageNodeData,
  );
  const onConnect = useCanvasFlowStore((state) => state.onConnect);
  const closePanoramaViewer = useCanvasFlowStore(
    (state) => state.closePanoramaViewer,
  );

  // 把截图结果转成 File，方便复用现有 OSS 上传能力
  const dataUrlToFile = React.useCallback(
    async (dataUrl: string, fileName: string) => {
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      return new File([blob], fileName, {
        type: blob.type || "image/jpeg",
      });
    },
    [],
  );

  // 统一处理不同截图模式的后续动作，避免三个按钮各写一套逻辑
  const createImageNodeFromScreenshot = React.useCallback(
    async (type: "single" | "4grid" | "12grid") => {
      if (!rendererRef.current || !cameraRef.current || !sceneRef.current) {
        return;
      }

      if (!sourceNodeId) {
        toast.error("未找到来源图片节点，无法生成新图片节点");
        return;
      }

      setLoadingText("正在生成新的图片节点...");
      setIsLoading(true);

      let createdNodeId: string | null = null;

      try {
        // 先拿到截图数据，再上传到 OSS，最后写入图片节点
        const dataUrl = await takeScreenshot({
          type,
          renderer: rendererRef.current,
          camera: cameraRef.current,
          scene: sceneRef.current,
        });

        const fileName = `panorama-${type}-${Date.now()}.jpg`;
        const file = await dataUrlToFile(dataUrl, fileName);

        // 检查文件大小，大于10MB时压缩
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

        // 将新图片节点放到画布中心，方便用户继续编辑和查看
        const centerPosition = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        });

        createdNodeId = addNode("image", centerPosition);

        // 把上传后的截图写入新节点，并标记为已完成状态
        updateImageNodeData(createdNodeId, {
          image_urls: [uploadResult.url],
          result: {
            type: "image",
            data: [{ url: uploadResult.url }],
          },
          status: GenerationStatus.COMPLETED,
          progress: 100,
        });

        // 保留来源关系，方便后续在画布中追踪截图是从哪张图派生出来的
        onConnect({
          source: sourceNodeId,
          sourceHandle: "output",
          target: createdNodeId,
          targetHandle: "input",
        });

        toast.success("截图已生成新的图片节点");

        // 成功后关闭当前全景查看器
        closePanoramaViewer();
      } catch (error: any) {
        console.error("生成全景截图节点失败:", error);

        // 如果节点已经创建但后续步骤失败，尽量清理掉半成品节点，避免画布残留脏数据
        if (createdNodeId) {
          useCanvasFlowStore.getState().deleteNode(createdNodeId);
        }

        toast.error(error?.message || "生成图片节点失败，请重试");
        setIsLoading(false);
      }
    },
    [
      addNode,
      closePanoramaViewer,
      dataUrlToFile,
      onConnect,
      screenToFlowPosition,
      sourceNodeId,
      updateImageNodeData,
    ],
  );

  // 图片加载完成
  const handleImageLoaded = React.useCallback(() => {
    setIsLoading(false);
  }, []);

  // 图片加载失败
  const handleImageError = React.useCallback(() => {
    setIsLoading(false);
    alert("图片加载失败，请尝试其他图片。");
  }, []);

  // 截图处理
  const handleScreenshotSingle = React.useCallback(() => {
    void createImageNodeFromScreenshot("single");
  }, [createImageNodeFromScreenshot]);

  const handleScreenshot4 = React.useCallback(() => {
    void createImageNodeFromScreenshot("4grid");
  }, [createImageNodeFromScreenshot]);

  const handleScreenshot12 = React.useCallback(() => {
    void createImageNodeFromScreenshot("12grid");
  }, [createImageNodeFromScreenshot]);

  // 重置视角
  const handleRecenter = React.useCallback(() => {
    if (cameraRef.current && controlsRef.current) {
      recenterCamera(cameraRef.current, controlsRef.current);
    }
  }, []);

  if (!open) return null;

  return (
    <div
      id="panorama-root"
      className="fixed inset-0 z-100 bg-gray-950 overflow-hidden"
    >
      {/* Three.js 渲染画布 */}
      <PanoramaCanvas
        imageUrl={initialImage || null}
        onImageLoaded={handleImageLoaded}
        onImageError={handleImageError}
        rendererRef={rendererRef}
        cameraRef={cameraRef}
        sceneRef={sceneRef}
        controlsRef={controlsRef}
      />

      {/* 加载中 */}
      {isLoading && <PanoramaLoading text={loadingText} />}

      {/* 控制面板 - 有图片且加载完成后显示 */}
      {!isLoading && initialImage && (
        <>
          <PanoramaControls
            onScreenshotSingle={handleScreenshotSingle}
            onScreenshot4={handleScreenshot4}
            onScreenshot12={handleScreenshot12}
            onRecenter={handleRecenter}
            onChangeImage={onClose}
          />

          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="fixed top-6 left-6 z-20 glass-panel hover:bg-white/20 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-lg flex items-center justify-center"
            title="关闭"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            关闭
          </button>
        </>
      )}
    </div>
  );
}
