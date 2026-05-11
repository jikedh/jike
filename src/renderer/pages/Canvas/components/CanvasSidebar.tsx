import { useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type AssetMediaRef,
  type AssetMediaType,
  type AssetRecord,
  initializeAssetStorage,
} from "service/assetStorage";
import type { AllNodeType, EdgeType } from "shared/types/flow";
import { toast } from "sonner";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { useChatSettingsStore } from "@/stores/chatSettingsStore";
import { insertAssetIntoCanvas } from "../utils/assetInsert";
import { AssetLibraryDialog } from "./AssetLibraryDialog";
import {
  CreateAssetDialog,
  type CreateAssetRequest,
} from "./CreateAssetDialog";
import type { FloatingSidebarProps } from "./FloatingSidebar";
import { FloatingSidebar } from "./FloatingSidebar";

const CREATE_ASSET_EVENT = "jike:create-asset";

const getFirstMediaRef = (node?: AllNodeType): AssetMediaRef | null => {
  const firstItem = (node?.data as any)?.result?.data?.find(
    (item: AssetMediaRef) => item?.url || item?.localPath,
  );
  return firstItem ?? null;
};

const getNodeMediaType = (node?: AllNodeType): AssetMediaType | null => {
  if (node?.type === "imageNode") return "image";
  if (node?.type === "newVideoNode") return "video";
  if (node?.type === "audioNode") return "audio";
  return null;
};

const buildCreateAssetRequest = (
  node: AllNodeType | undefined,
  projectId: string | null,
): CreateAssetRequest | null => {
  const mediaType = getNodeMediaType(node);
  const mediaRef = getFirstMediaRef(node);
  if (!node || !mediaType || !mediaRef) return null;

  return {
    nodeId: node.id,
    projectId,
    mediaType,
    mediaRef,
    name:
      String((node.data as any)?.nickname || "").trim() ||
      (mediaType === "image"
        ? "图片素材"
        : mediaType === "video"
          ? "视频素材"
          : "音频素材"),
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
  const nodes = useCanvasFlowStore((state) => state.nodes);
  const projectId = useCanvasFlowStore((state) => state.projectId);
  const assetStoragePath = useChatSettingsStore(
    (state) => state.assetStoragePath,
  );
  const setAssetStoragePath = useChatSettingsStore(
    (state) => state.setAssetStoragePath,
  );
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);
  const [createAssetRequest, setCreateAssetRequest] =
    useState<CreateAssetRequest | null>(null);
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

  const ensureAssetPath = useCallback(async () => {
    if (assetStoragePath) {
      await initializeAssetStorage(assetStoragePath);
      return assetStoragePath;
    }

    if (!window.storage) {
      toast.error("本地存储功能不可用");
      return "";
    }

    const selectedPath = await window.storage.selectDirectory();
    if (!selectedPath) return "";

    setAssetStoragePath(selectedPath);
    await initializeAssetStorage(selectedPath);
    return selectedPath;
  }, [assetStoragePath, setAssetStoragePath]);

  const openAssetLibrary = useCallback(async () => {
    const readyPath = await ensureAssetPath();
    if (!readyPath) return;
    setAssetLibraryOpen(true);
  }, [ensureAssetPath]);

  const handleUseAsset = useCallback(
    async (asset: AssetRecord) => {
      try {
        await insertAssetIntoCanvas(asset, centerFlowPosition());
        toast.success("资产已插入画布");
      } catch (error) {
        console.error("[CanvasSidebar] insert asset failed", error);
        toast.error("资产插入画布失败");
      }
    },
    [centerFlowPosition],
  );

  const handleUseAssets = useCallback(
    async (assets: AssetRecord[]) => {
      if (assets.length === 0) return;

      const basePosition = centerFlowPosition();
      const nodeWidth = 380;
      const nodeHeight = 300;
      const perRow = 3;

      try {
        for (let index = 0; index < assets.length; index += 1) {
          const row = Math.floor(index / perRow);
          const col = index % perRow;
          await insertAssetIntoCanvas(assets[index], {
            x: basePosition.x + col * nodeWidth,
            y: basePosition.y + row * nodeHeight,
          });
        }
        toast.success(
          assets.length === 1
            ? "资产已插入画布"
            : `已插入 ${assets.length} 个资产`,
        );
      } catch (error) {
        console.error("[CanvasSidebar] batch insert assets failed", error);
        toast.error("批量插入资产失败");
      }
    },
    [centerFlowPosition],
  );

  const handleDropAsset = useCallback(
    async (asset: AssetRecord, clientPosition: { x: number; y: number }) => {
      try {
        await insertAssetIntoCanvas(
          asset,
          screenToFlowPosition({
            x: clientPosition.x,
            y: clientPosition.y,
          }),
        );
        toast.success("资产已插入画布");
      } catch (error) {
        console.error("[CanvasSidebar] drop asset failed", error);
        toast.error("资产插入画布失败");
      }
    },
    [screenToFlowPosition],
  );

  useEffect(() => {
    const handleCreateAsset = async (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
      if (!nodeId) return;

      const readyPath = await ensureAssetPath();
      if (!readyPath) return;

      const node = useCanvasFlowStore
        .getState()
        .nodes.find((item) => item.id === nodeId);
      const request = buildCreateAssetRequest(node, projectId);
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
  }, [ensureAssetPath, projectId]);

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
          void openAssetLibrary();
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
      <AssetLibraryDialog
        open={assetLibraryOpen}
        basePath={assetStoragePath}
        projectId={projectId}
        nodes={nodes}
        refreshKey={assetRefreshKey}
        onClose={() => setAssetLibraryOpen(false)}
        onUse={handleUseAsset}
        onUseMany={handleUseAssets}
        onDropAsset={handleDropAsset}
      />
      <CreateAssetDialog
        open={createAssetDialogOpen}
        basePath={assetStoragePath}
        request={createAssetRequest}
        onClose={() => setCreateAssetRequest(null)}
        onCreated={() => setAssetRefreshKey((current) => current + 1)}
      />
    </>
  );
};
