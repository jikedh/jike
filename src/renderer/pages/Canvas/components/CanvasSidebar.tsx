/**
 * Canvas 侧边栏（远程资产版本）
 *
 * 变化点（vs 旧版）：
 * - 完全移除 service/assetStorage 的本地资产路径依赖
 * - 资产库弹窗切换为 RemoteAssetLibraryDialog
 * - 创建资产弹窗切换为 RemoteCreateAssetDialog
 * - 创建资产事件直接从节点结果拿到 mediaRef.url/remoteUrl/displayUrl 上传
 */

import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import type { MediaType } from "shared/types/api/assets";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useUserStore } from "@/stores/useUserStore";
import { insertRemoteAssetIntoCanvas } from "../utils/remoteAssetInsert";
import type { RemoteAsset } from "../utils/remoteAssets";
import { RemoteAssetLibraryDialog } from "./RemoteAssetLibraryDialog";
import { ProjectAssetLibrary } from "./project-asset-library/ProjectAssetLibrary";
import {
  RemoteCreateAssetDialog,
  type RemoteCreateAssetRequest,
} from "./RemoteCreateAssetDialog";
import type { FloatingSidebarProps } from "./FloatingSidebar";
import { FloatingSidebar } from "./FloatingSidebar";

const CREATE_ASSET_EVENT = "jike:create-asset";

type MediaRefLike = {
  url?: string;
  remoteUrl?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  posterUrl?: string;
  localName?: string;
  localFileName?: string;
};

const getFirstMediaRef = (node?: AllNodeType): MediaRefLike | null => {
  const data = (node?.data as any)?.result?.data;
  if (!Array.isArray(data)) return null;
  const firstItem = data.find(
    (item: MediaRefLike) =>
      item?.url || item?.remoteUrl || item?.displayUrl,
  );
  return firstItem ?? null;
};

const getNodeMediaType = (node?: AllNodeType): MediaType | null => {
  if (node?.type === "imageNode") return "image";
  if (node?.type === "newVideoNode") return "video";
  if (node?.type === "audioNode") return "audio";
  return null;
};

const resolveRemoteUrl = (mediaRef: MediaRefLike): string => {
  return (
    mediaRef.remoteUrl ||
    mediaRef.displayUrl ||
    mediaRef.thumbnailUrl ||
    mediaRef.coverUrl ||
    mediaRef.posterUrl ||
    mediaRef.url ||
    ""
  );
};

const getDefaultFileName = (
  mediaType: MediaType,
  mediaRef: MediaRefLike,
  nodeId: string,
) => {
  const raw =
    mediaRef.localName ||
    mediaRef.localFileName ||
    resolveRemoteUrl(mediaRef).split("/").pop() ||
    "";
  if (raw) return raw;
  const ext =
    mediaType === "image"
      ? "png"
      : mediaType === "video"
        ? "mp4"
        : "mp3";
  return `${nodeId}.${ext}`;
};

const buildRemoteCreateRequest = (
  node: AllNodeType | undefined,
  projectId: string | null,
): RemoteCreateAssetRequest | null => {
  const mediaType = getNodeMediaType(node);
  const mediaRef = getFirstMediaRef(node);
  if (!node || !mediaType || !mediaRef) return null;
  const url = resolveRemoteUrl(mediaRef);
  if (!url) return null;

  const nickname =
    String((node.data as any)?.nickname || "").trim() ||
    (mediaType === "image"
      ? "图片素材"
      : mediaType === "video"
        ? "视频素材"
        : "音频素材");

  return {
    nodeId: node.id,
    projectId,
    mediaType,
    url,
    fileName: getDefaultFileName(mediaType, mediaRef, node.id),
    initialName: nickname,
    defaultScope: projectId ? "project" : "personal",
  };
};

export const dispatchCreateAssetFromNode = (nodeId: string) => {
  window.dispatchEvent(
    new CustomEvent(CREATE_ASSET_EVENT, {
      detail: { nodeId },
    }),
  );
};

export const CanvasSidebar = () => {
  const addNode = useCanvasFlowStore((state) => state.addNode);
  const saveGraph = useCanvasFlowStore((state) => state.saveGraph);
  const projectId = useCanvasFlowStore((state) => state.projectId);
  const userInfo = useUserStore((state) => state.userInfo);
  const currentUserId = useMemo(() => {
    if (!userInfo) return undefined;
    return String(userInfo.id ?? "");
  }, [userInfo]);

  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [personalAssetLibraryOpen, setPersonalAssetLibraryOpen] =
    useState(false);
  const [createAssetRequest, setCreateAssetRequest] =
    useState<RemoteCreateAssetRequest | null>(null);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const { screenToFlowPosition } = useReactFlow<AllNodeType, EdgeType>();

  const centerFlowPosition = useCallback(
    () =>
      screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }),
    [screenToFlowPosition],
  );

  const openAssetLibrary = useCallback(() => {
    setAssetLibraryOpen(true);
  }, []);

  const insertAssetAt = useCallback(
    async (asset: RemoteAsset, position: { x: number; y: number }) => {
      try {
        await insertRemoteAssetIntoCanvas(asset, position);
      } catch (error) {
        console.error("[CanvasSidebar] insert asset failed", error);
        toast.error("资产插入画布失败");
      }
    },
    [],
  );

  const handleUseOne = useCallback(
    async (asset: RemoteAsset) => {
      await insertAssetAt(asset, centerFlowPosition());
      toast.success("资产已插入画布");
    },
    [centerFlowPosition, insertAssetAt],
  );

  const handleUseMany = useCallback(
    async (assets: RemoteAsset[]) => {
      if (assets.length === 0) return;

      const basePosition = centerFlowPosition();
      const nodeWidth = 380;
      const nodeHeight = 300;
      const perRow = 3;
      const successCount = { value: 0 };
      let failedCount = 0;

      for (let index = 0; index < assets.length; index += 1) {
        const row = Math.floor(index / perRow);
        const col = index % perRow;
        const target = {
          x: basePosition.x + col * nodeWidth,
          y: basePosition.y + row * nodeHeight,
        };
        try {
          // eslint-disable-next-line no-await-in-loop
          await insertRemoteAssetIntoCanvas(assets[index], target);
          successCount.value += 1;
        } catch (error) {
          console.error("[CanvasSidebar] batch insert failed", error);
          failedCount += 1;
        }
      }

      if (successCount.value > 0) {
        toast.success(
          successCount.value === 1
            ? "资产已插入画布"
            : `已插入 ${successCount.value} 个资产${failedCount > 0 ? `，失败 ${failedCount} 个` : ""}`,
        );
      } else if (failedCount > 0) {
        toast.error("批量插入资产失败");
      }
    },
    [centerFlowPosition],
  );

  const handleDropAsset = useCallback(
    async (
      asset: RemoteAsset,
      clientPosition: { x: number; y: number },
    ) => {
      await insertAssetAt(
        asset,
        screenToFlowPosition({ x: clientPosition.x, y: clientPosition.y }),
      );
      toast.success("资产已插入画布");
    },
    [insertAssetAt, screenToFlowPosition],
  );

  useEffect(() => {
    const handleCreateAsset = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
      if (!nodeId) return;

      const node = useCanvasFlowStore
        .getState()
        .nodes.find((item) => item.id === nodeId);
      const request = buildRemoteCreateRequest(node, projectId);
      if (!request) {
        toast.warning("当前节点没有可保存的媒体结果");
        return;
      }
      setCreateAssetRequest(request);
    };

    window.addEventListener(CREATE_ASSET_EVENT, handleCreateAsset);
    return () => {
      window.removeEventListener(CREATE_ASSET_EVENT, handleCreateAsset);
    };
  }, [projectId]);

  const createAssetDialogOpen = useMemo(
    () => Boolean(createAssetRequest),
    [createAssetRequest],
  );

  const handleSidebarAction = useCallback<
    NonNullable<FloatingSidebarProps["onAction"]>
  >(
    (actionId) => {
      const flowPosition = centerFlowPosition();

      switch (actionId) {
        case "create-note":
          addNode("note", flowPosition);
          break;
        case "create-image":
          addNode("image", flowPosition);
          break;
        case "create-newVideo":
          addNode("newVideo", flowPosition);
          break;
        case "create-audio":
          addNode("audio", flowPosition);
          break;
        case "create-textAgent":
          addNode("textAgent", flowPosition);
          break;
        case "create-imageAgent":
          addNode("imageAgent", flowPosition);
          break;
        case "create-videoAgent":
          addNode("videoAgent", flowPosition);
          break;
        case "asset-library":
          openAssetLibrary();
          break;
        case "personal-asset-library":
          setPersonalAssetLibraryOpen(true);
          break;
        case "save":
          saveGraph();
          toast.success("画布已保存");
          break;
        default:
          break;
      }
    },
    [addNode, centerFlowPosition, openAssetLibrary, saveGraph],
  );

  return (
    <>
      <FloatingSidebar onAction={handleSidebarAction} />
      <RemoteAssetLibraryDialog
        open={assetLibraryOpen}
        projectId={projectId}
        currentUserId={currentUserId}
        refreshKey={assetRefreshKey}
        onClose={() => setAssetLibraryOpen(false)}
        onUseOne={handleUseOne}
        onUseMany={handleUseMany}
        onDropAsset={handleDropAsset}
      />
      <ProjectAssetLibrary
        open={personalAssetLibraryOpen}
        projectId={projectId}
        onClose={() => setPersonalAssetLibraryOpen(false)}
      />
      <RemoteCreateAssetDialog
        open={createAssetDialogOpen}
        request={createAssetRequest}
        onClose={() => setCreateAssetRequest(null)}
        onCreated={() => setAssetRefreshKey((current) => current + 1)}
      />
    </>
  );
};
