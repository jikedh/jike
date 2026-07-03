import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { getAssetList, searchAssets } from "@/api/assets";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import type {
  ApiEnvelope,
  AssetListItem,
  AssetScope,
  PaginatedData,
} from "shared/types/api/assets";
import type { AllNodeType } from "shared/types/flow";
import {
  mapListItemToRemoteAsset,
  type RemoteAsset,
} from "../../utils/remoteAssets";
import type { AssetMentionGroup, MentionAssetOption } from "./assetMentionTypes";
import {
  ASSET_MENTION_SCOPE_ORDER,
  buildAssetMentionGroups,
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
  setSelectedByKey: (key: string) => void;
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

const loadDefaultRemoteOptions = async ({
  projectId,
  pageSize,
}: {
  projectId?: string | null;
  pageSize: number;
}) => {
  const requests = ASSET_MENTION_SCOPE_ORDER.flatMap((scope) => {
    if (scope === "project" && !projectId) return [];

    return [
      getAssetList({
        scope,
        projectId: scope === "project" ? projectId ?? undefined : undefined,
        page: 1,
        pageSize,
        sortBy: "createTime",
        sortOrder: "desc",
      }).then((envelope) => ({ scope, envelope })),
    ];
  });

  const results = await Promise.allSettled(requests);
  const options: MentionAssetOption[] = [];
  let firstError: string | null = null;

  results.forEach((result) => {
    if (result.status === "rejected") {
      firstError ??= formatError(result.reason);
      return;
    }

    try {
      const data = unwrapEnvelope(result.value.envelope);
      const list = Array.isArray(data?.list) ? data.list : [];
      options.push(...toRemoteOptions(list));
    } catch (error) {
      firstError ??= formatError(error);
    }
  });

  return { options, error: firstError };
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
  return toRemoteOptions(list);
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

      const result = await loadDefaultRemoteOptions({ projectId, pageSize });
      if (requestId !== requestIdRef.current) return;
      setRemoteOptions(result.options);
      setError(result.error);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setRemoteOptions([]);
      setError(formatError(err));
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [debouncedQuery, pageSize, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const groups = useMemo(
    () =>
      buildAssetMentionGroups({
        connectedOptions,
        remoteOptions,
        projectUnavailable: !projectId,
      }),
    [connectedOptions, projectId, remoteOptions],
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
    setSelectedByKey,
    reload,
  };
};
