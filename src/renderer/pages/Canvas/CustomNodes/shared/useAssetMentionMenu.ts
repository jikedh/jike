import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getAssetList, getAssetPrimaryCategories, searchAssets } from "@/api/assets";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import type {
  ApiEnvelope,
  AssetCategory,
  AssetListItem,
  AssetScope,
  PaginatedData,
  PrimaryCategory,
} from "shared/types/api/assets";
import type { AllNodeType } from "shared/types/flow";
import {
  mapListItemToRemoteAsset,
  type RemoteAsset,
} from "../../utils/remoteAssets";
import type { AssetMentionGroup, MentionAssetOption } from "./assetMentionTypes";
import {
  ASSET_MENTION_SCOPE_ORDER,
  buildAssetScopeFolderOption,
  buildAssetMentionGroups,
  getAssetCategoryValue,
  getSelectableAssetMentionOptions,
  normalizeCanvasNodeMentionOption,
  normalizeRemoteAssetMentionOption,
} from "./assetMentionUtils";

export interface UseAssetMentionMenuOptions {
  nodeId: string;
  projectId?: string | null;
  additionalConnectedOptions?: MentionAssetOption[];
  pageSize?: number;
  debounceMs?: number;
}

export interface UseAssetMentionMenuResult {
  query: string;
  debouncedQuery: string;
  groups: AssetMentionGroup[];
  flatOptions: MentionAssetOption[];
  selectedOption: MentionAssetOption | null;
  selectedKey: string | null;
  selectedIndex: number;
  loading: boolean;
  error: string | null;
  setQuery: (query: string) => void;
  moveSelection: (delta: -1 | 1) => void;
  selectCurrent: () => MentionAssetOption | null;
  activateOption: (option: MentionAssetOption | null) => boolean;
  setSelectedByKey: (key: string) => void;
  breadcrumbs: string[];
  canGoBack: boolean;
  goBack: () => void;
  reload: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 8;
const DEFAULT_DEBOUNCE_MS = 250;
const SUCCESS_CODES = new Set<number>([0, 200]);

const unwrapEnvelope = <T>(envelope: ApiEnvelope<T> | undefined | null): T => {
  if (!envelope) {
    throw new Error("请求无响应数据");
  }

  if (!SUCCESS_CODES.has(envelope.code)) {
    throw new Error(envelope.msg || envelope.message || "请求失败");
  }

  return envelope.data;
};

const formatError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  return "请求失败";
};

const toRemoteOptions = (list: AssetListItem[] | unknown[]) =>
  list
    .map((item) => mapListItemToRemoteAsset(item as AssetListItem))
    .map((asset: RemoteAsset) => normalizeRemoteAssetMentionOption(asset));

const loadCategoryRemoteOptions = async ({
  scope,
  primaryCategory,
  projectId,
  pageSize,
}: {
  scope: AssetScope;
  primaryCategory: PrimaryCategory;
  projectId?: string | null;
  pageSize: number;
}) => {
  const envelope = await getAssetList({
    scope,
    projectId: scope === "project" ? projectId ?? undefined : undefined,
    mediaType: "image",
    primaryCategory,
    page: 1,
    pageSize,
    sortBy: "createTime",
    sortOrder: "desc",
  });
  const data = unwrapEnvelope<PaginatedData<AssetListItem>>(envelope);
  const list = Array.isArray(data?.list) ? data.list : [];
  return toRemoteOptions(list);
};

const loadCategoryOptions = async () => {
  const envelope = await getAssetPrimaryCategories();
  const categories = unwrapEnvelope<AssetCategory[]>(envelope);
  return Array.isArray(categories) ? categories : [];
};

const searchRemoteOptions = async ({
  query,
  pageSize,
}: {
  query: string;
  pageSize: number;
}) => {
  const envelope = await searchAssets({
    q: query,
    page: 1,
    pageSize,
  });
  const data = unwrapEnvelope<PaginatedData<AssetListItem>>(envelope);
  const list = Array.isArray(data?.list) ? data.list : [];
  return toRemoteOptions(list).filter((option) => option.scope !== "public");
};

export const useAssetMentionMenu = ({
  nodeId,
  projectId,
  additionalConnectedOptions = [],
  pageSize = DEFAULT_PAGE_SIZE,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseAssetMentionMenuOptions): UseAssetMentionMenuResult => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [remoteOptions, setRemoteOptions] = useState<MentionAssetOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<AssetCategory[]>([]);
  const [activeScope, setActiveScope] = useState<AssetScope | null>(null);
  const [categoryPath, setCategoryPath] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const requestIdRef = useRef(0);

  const connectedNodes = useCanvasFlowStore(
    useShallow((state) => {
      return state.edges.flatMap((edge) => {
        if (edge.target !== nodeId) return [];
        const sourceNode = state.nodes.find((node) => node.id === edge.source);
        return sourceNode ? [sourceNode as AllNodeType] : [];
      });
    }),
  );

  const connectedOptions = useMemo(
    () => {
      const normalizedNodeOptions = connectedNodes.flatMap((node) => {
        const option = normalizeCanvasNodeMentionOption(node);
        return option ? [option] : [];
      });
      return [...normalizedNodeOptions, ...additionalConnectedOptions];
    },
    [additionalConnectedOptions, connectedNodes],
  );

  const folderOptions = useMemo(
    () =>
      ASSET_MENTION_SCOPE_ORDER.map((scope) =>
        buildAssetScopeFolderOption({
          scope,
          disabled: scope === "project" && !projectId,
          disabledReason: "当前画布未绑定项目",
        }),
      ),
    [projectId],
  );

  const activeCategory = categoryPath[categoryPath.length - 1] ?? null;
  const visibleCategoryOptions = activeCategory?.children ?? categoryOptions;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [debounceMs, query]);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      if (debouncedQuery) {
        const options = await searchRemoteOptions({
          query: debouncedQuery,
          pageSize,
        });
        if (requestId !== requestIdRef.current) return;
        setRemoteOptions(options);
        return;
      }

      if (activeScope && !activeCategory) {
        const categories = await loadCategoryOptions();
        if (requestId !== requestIdRef.current) return;
        setCategoryOptions(categories);
        setRemoteOptions([]);
        return;
      }

      if (
        !activeScope ||
        !activeCategory ||
        (activeCategory.children?.length ?? 0) > 0
      ) {
        setRemoteOptions([]);
        return;
      }

      const options = await loadCategoryRemoteOptions({
        scope: activeScope,
        primaryCategory: getAssetCategoryValue(activeCategory),
        projectId,
        pageSize,
      });
      if (requestId !== requestIdRef.current) return;
      setRemoteOptions(options);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setRemoteOptions([]);
      setError(formatError(err));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [activeCategory, activeScope, debouncedQuery, pageSize, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(
    () =>
      buildAssetMentionGroups({
        connectedOptions,
        folderOptions,
        remoteOptions,
        categoryOptions: visibleCategoryOptions,
        activeScope,
        activeCategory,
        projectUnavailable: !projectId,
      }),
    [
      activeCategory,
      activeScope,
      connectedOptions,
      folderOptions,
      projectId,
      remoteOptions,
      visibleCategoryOptions,
    ],
  );

  const flatOptions = useMemo(
    () => getSelectableAssetMentionOptions(groups),
    [groups],
  );

  useEffect(() => {
    setSelectedIndex((current) => {
      if (flatOptions.length === 0) return 0;
      return Math.min(current, flatOptions.length - 1);
    });
  }, [flatOptions.length]);

  const moveSelection = useCallback(
    (delta: -1 | 1) => {
      if (flatOptions.length === 0) return;
      setSelectedIndex((current) =>
        (current + delta + flatOptions.length) % flatOptions.length,
      );
    },
    [flatOptions.length],
  );

  const selectCurrent = useCallback(() => {
    return flatOptions[selectedIndex] ?? null;
  }, [flatOptions, selectedIndex]);

  const activateOption = useCallback((option: MentionAssetOption | null) => {
    if (!option || option.disabled) return false;

    if (option.optionType === "scope-folder" && option.scope) {
      setActiveScope(option.scope);
      setCategoryPath([]);
      setQuery("");
      setSelectedIndex(0);
      return true;
    }

    if (option.optionType === "category-folder" && option.scope && option.folderCategory) {
      setActiveScope(option.scope);
      setCategoryPath((current) => [...current, option.folderCategory!]);
      setQuery("");
      setSelectedIndex(0);
      return true;
    }

    return false;
  }, []);

  const goBack = useCallback(() => {
    if (categoryPath.length > 0) {
      setCategoryPath((current) => current.slice(0, -1));
    } else {
      setActiveScope(null);
    }
    setQuery("");
    setSelectedIndex(0);
  }, [categoryPath.length]);

  const setSelectedByKey = useCallback(
    (key: string) => {
      const nextIndex = flatOptions.findIndex((option) => option.key === key);
      if (nextIndex >= 0) {
        setSelectedIndex(nextIndex);
      }
    },
    [flatOptions],
  );

  const selectedOption = flatOptions[selectedIndex] ?? null;

  return {
    query,
    debouncedQuery,
    groups,
    flatOptions,
    selectedOption,
    selectedKey: selectedOption?.key ?? null,
    selectedIndex,
    loading,
    error,
    setQuery,
    moveSelection,
    selectCurrent,
    activateOption,
    setSelectedByKey,
    breadcrumbs: [
      ...(activeScope
        ? [activeScope === "project" ? "项目资产" : "个人资产"]
        : []),
      ...categoryPath.map((category) => category.name),
    ],
    canGoBack: Boolean(activeScope),
    goBack,
    reload,
  };
};
