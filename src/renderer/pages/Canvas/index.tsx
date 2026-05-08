import { IconMessageCircle } from "@tabler/icons-react";
import { ReactFlowProvider } from "@xyflow/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { readMediaFromLocal } from "service/projectStorage";
import type { AllNodeType } from "shared/types/flow";
import { cn } from "shared/utils/utils";
import { CinematicProjectLoader } from "@/components/CinematicProjectLoader";
import { useCanvasChat } from "@/hooks/useCanvasChat";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { CanvasChatToolbar } from "./components/CanvasChatToolbar";
import { CanvasFlow } from "./components/CanvasFlow";
import { CanvasSidebar } from "./components/CanvasSidebar";
import { ChatDrawer } from "./components/ChatDrawer";
import ReactFlowDevTools from "./DevTools";

const CANVAS_READY_MIN_VISIBLE_MS = 900;
const CANVAS_READY_MAX_WAIT_MS = 5000;
const PRELOAD_IMAGE_LIMIT = 8;

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

const getImageMimeType = (url: string) => {
  const cleanUrl = url.split("?")[0].toLowerCase();
  if (cleanUrl.endsWith(".jpg") || cleanUrl.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (cleanUrl.endsWith(".webp")) {
    return "image/webp";
  }
  if (cleanUrl.endsWith(".gif")) {
    return "image/gif";
  }
  return "image/png";
};

const waitForImage = (url: string) =>
  new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });

const getCanvasPreviewImages = (nodes: AllNodeType[]) => {
  const images: Array<{ url: string; localPath?: string }> = [];

  for (const node of nodes) {
    if (node.type !== "imageNode") {
      continue;
    }

    const firstImage = node.data?.result?.data?.find((item) => item?.url);
    const url = firstImage?.displayUrl || firstImage?.url || firstImage?.remoteUrl;
    if (url) {
      images.push({ url, localPath: firstImage?.localPath });
    }

    if (images.length >= PRELOAD_IMAGE_LIMIT) {
      break;
    }
  }

  return images;
};

const waitForCanvasPreviewImage = async (image: {
  url: string;
  localPath?: string;
}) => {
  if (image.localPath) {
    const bytes = await readMediaFromLocal(image.localPath);
    if (bytes) {
      const blobUrl = URL.createObjectURL(
        new Blob([bytes], { type: getImageMimeType(image.localPath) }),
      );
      try {
        await waitForImage(blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      return;
    }
  }

  await waitForImage(image.url);
};

// 外部组件 - 提供 ReactFlowProvider 和工具栏
const CanvasPage = () => {
  // 从路由参数获取项目 ID
  const { projectId } = useParams<{ projectId: string }>();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isProjectEntering, setIsProjectEntering] = useState(Boolean(projectId));
  const [hasProjectEntered, setHasProjectEntered] = useState(!projectId);
  const enteredProjectRef = useRef<string | null>(null);
  const {
    messages,
    isLoading,
    sendMessage,
    stopMessage,
    clearLocalMessages,
    setMessages,
  } = useCanvasChat();
  // 从设置 store 读取调试工具面板的显示状态
  const devToolsVisible = useChatSettingsStore(
    (state) => state.devToolsVisible,
  );
  const [isMiniMapVisible, setIsMiniMapVisible] = useState(true);
  const hydrated = useCanvasFlowStore((state) => state.hydrated);
  const currentProjectId = useCanvasFlowStore((state) => state.projectId);
  const nodes = useCanvasFlowStore((state) => state.nodes);

  useEffect(() => {
    if (!projectId) {
      setIsProjectEntering(false);
      setHasProjectEntered(true);
      enteredProjectRef.current = null;
      return;
    }

    if (enteredProjectRef.current !== projectId) {
      enteredProjectRef.current = projectId;
      setHasProjectEntered(false);
      setIsProjectEntering(true);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !isProjectEntering) {
      return;
    }

    if (!hydrated || currentProjectId !== projectId) {
      return;
    }

    let canceled = false;
    const startedAt = performance.now();

    const revealCanvas = async () => {
      const images = getCanvasPreviewImages(nodes);
      await Promise.race([
        Promise.all(images.map(waitForCanvasPreviewImage)),
        new Promise<void>((resolve) =>
          window.setTimeout(resolve, CANVAS_READY_MAX_WAIT_MS),
        ),
      ]);
      await waitForAnimationFrame();

      const elapsed = performance.now() - startedAt;
      const remaining = Math.max(0, CANVAS_READY_MIN_VISIBLE_MS - elapsed);
      if (remaining > 0) {
        await new Promise<void>((resolve) =>
          window.setTimeout(resolve, remaining),
        );
      }

      if (!canceled) {
        setHasProjectEntered(true);
        setIsProjectEntering(false);
      }
    };

    revealCanvas();

    return () => {
      canceled = true;
    };
  }, [currentProjectId, hydrated, isProjectEntering, nodes, projectId]);

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen">
        <motion.div
          className="h-full w-full origin-center"
          initial={false}
          animate={
            hasProjectEntered
              ? { opacity: 1, scale: 1, filter: "blur(0px)" }
              : { opacity: 0.72, scale: 1, filter: "blur(0px)" }
          }
          transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
        >
          <CanvasFlow projectId={projectId} isMiniMapVisible={isMiniMapVisible} />

          {/* 悬浮侧边栏：与 CanvasFlow 同级，避免节点移动时不必要重渲染。 */}
          <CanvasSidebar />

          {/* 右下圆形聊天工具栏：负责打开抽屉与切换 system 人设。 */}
          <CanvasChatToolbar
            isMiniMapVisible={isMiniMapVisible}
            onToggleMiniMap={() => setIsMiniMapVisible((prev) => !prev)}
          />

          <button
            type="button"
            title="打开 AI 对话"
            className={cn(
              "fixed right-6 bottom-6 z-50 flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)] transition-colors",
              isChatOpen ? "bg-blue-500" : "bg-blue-600 hover:bg-blue-500",
            )}
            onClick={() => setIsChatOpen(true)}
          >
            <IconMessageCircle size={18} />
          </button>

          {/* 右侧抽屉聊天窗口：统一走桌面代理聊天接口，并使用 idb-keyval 持久化会话。 */}
          <ChatDrawer
            open={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={messages}
            isLoading={isLoading}
            sendMessage={sendMessage}
            stopMessage={stopMessage}
            clearLocalMessages={clearLocalMessages}
            setMessages={setMessages}
          />

          {/* 调试工具面板：由设置中心控制显示/隐藏 */}
          {devToolsVisible && <ReactFlowDevTools position="top-center" />}
        </motion.div>

        <AnimatePresence>
          {isProjectEntering ? (
            <CinematicProjectLoader
              fixed
              instant
              title=""
              subtitle=""
            />
          ) : null}
        </AnimatePresence>
      </div>
    </ReactFlowProvider>
  );
};

export default CanvasPage;
