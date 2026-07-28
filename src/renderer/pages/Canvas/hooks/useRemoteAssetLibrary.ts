/**
 * Canvas 远程资产库 Hook
 *
 * 职责：
 * - 在不同 scope（项目 / 个人 / 公司 / 公开）之间切换列表查询
 * - 支持 mediaType / primaryCategory / 关键词 / 分页 / 排序 / 标签过滤
 * - 提供创建、删除、更新、改变 scope、标签管理等操作
 * - 统一处理 loading / error / 成功反馈
 *
 * 四类资产差异：
 * - personal：`scope=personal`，仅当前用户可见
 * - project：`scope=project & projectId`；后端要求 projectId 必填
 * - company：`scope=company`，仅匹配资产人员分类的当前有效用户可见
 * - public：`scope=public`，所有登录用户可见，但写操作只能创建者执行（最终由后端校验）
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  addProjectAssetRef,
  changeAssetScope,
  deleteAsset as apiDeleteAsset,
  getAssetList,
  removeProjectAssetRef as apiRemoveProjectAssetRef,
  updateAsset,
} from "@/api/assets";
import type {
  ApiEnvelope,
  AssetListParams,
  AssetScope,
  MediaType,
  PaginatedData,
  PrimaryCategory,
  UpdateAssetRequest,
} from "shared/types/api/assets";
import {
  mapListItemToRemoteAsset,
  type RemoteAsset,
} from "../utils/remoteAssets";

export interface UseRemoteAssetLibraryOptions {
  /** 当前画布项目 ID，用于项目资产 scope */
  projectId?: string | null;
  /** 当前激活的 scope */
  scope: AssetScope;
  /** 媒体类型过滤 */
  mediaType?: MediaType;
  /** 主分类过滤；undefined = 不过滤 */
  primaryCategory?: PrimaryCategory;
  /** 关键词搜索 */
  keyword?: string;
  /** 标签过滤（AND 语义：资产须同时拥有所有指定标签） */
  tags?: string[];
  /** 按资产创建者当前人员分类筛选 */
  personCategoryCode?: string;
  /** 分页 */
  page: number;
  pageSize: number;
  /** 排序字段 */
  sortBy?: AssetListParams["sortBy"];
  sortOrder?: AssetListParams["sortOrder"];
  /** 触发刷新的外部 token */
  refreshToken?: number;
}

export interface UseRemoteAssetLibraryResult {
  assets: RemoteAsset[];
  total: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  // 操作
  deleteAsset: (assetId: string) => Promise<{
    action: "deleted" | "unlisted";
    refCount: number;
  } | null>;
  updateAssetInfo: (
    assetId: string,
    payload: UpdateAssetRequest,
  ) => Promise<boolean>;
  promoteScope: (
    assetId: string,
    targetScope: AssetScope,
    targetProjectId?: string,
  ) => Promise<boolean>;
  addToProject: (assetId: string, targetProjectId: string) => Promise<boolean>;
  removeFromProject: (
    assetId: string,
    targetProjectId: string,
  ) => Promise<boolean>;
}

const SUCCESS_CODES = new Set<number>([0, 200]);

const buildListParams = (
  options: UseRemoteAssetLibraryOptions,
): AssetListParams => {
  const params: AssetListParams = {
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy ?? "createTime",
    sortOrder: options.sortOrder ?? "desc",
  };

  if (options.scope === "project") {
    params.scope = "project";
    if (options.projectId) params.projectId = options.projectId;
  } else if (options.scope === "personal") {
    params.scope = "personal";
  } else if (options.scope === "company") {
    params.scope = "company";
  } else {
    params.scope = "public";
  }

  if (options.mediaType) params.mediaType = options.mediaType;
  if (options.primaryCategory) params.primaryCategory = options.primaryCategory;
  if (options.keyword?.trim()) params.keyword = options.keyword.trim();
  if (options.tags && options.tags.length > 0) params.tags = options.tags;
  if (options.personCategoryCode?.trim()) {
    params.personCategoryCode = options.personCategoryCode.trim();
  }

  return params;
};

/**
 * 从 envelope 中读取 `data`，并在 `code` 不在成功集合时抛 Error。
 * 调用方拿到的是真正的业务对象 / 业务异常，axios 拦截器不再为此服务。
 */
const unwrapEnvelope = <T>(
  envelope: ApiEnvelope<T> | undefined | null,
): T => {
  if (!envelope) {
    throw new Error("请求无响应数据");
  }
  if (!SUCCESS_CODES.has(envelope.code)) {
    const message = envelope.msg || envelope.message || "请求失败";
    throw new Error(message);
  }
  return envelope.data;
};

/** 把任意错误转成可展示字符串。不暴露后端 stack / 敏感字段。 */
const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return "请求失败";
};

export const useRemoteAssetLibrary = (
  options: UseRemoteAssetLibraryOptions,
): UseRemoteAssetLibraryResult => {
  const [assets, setAssets] = useState<RemoteAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 用于丢弃过期请求 */
  const requestIdRef = useRef(0);

  // 项目 scope 必须有 projectId 才能查询
  const skipQuery =
    options.scope === "project" && !options.projectId;

  const reload = useCallback(async () => {
    if (skipQuery) {
      setAssets([]);
      setTotal(0);
      setTotalPages(1);
      setError(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = buildListParams(options);
      const envelope: ApiEnvelope<PaginatedData<unknown>> =
        await getAssetList(params);

      if (requestId !== requestIdRef.current) return;

      const data = unwrapEnvelope(envelope);
      const list = Array.isArray(data?.list) ? data.list : [];
      setAssets(list.map(mapListItemToRemoteAsset));
      setTotal(data?.pagination?.total ?? list.length);
      setTotalPages(Math.max(1, data?.pagination?.totalPages ?? 1));
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message = formatError(err);
      setError(message);
      setAssets([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [
    options.keyword,
    options.mediaType,
    options.page,
    options.pageSize,
    options.personCategoryCode,
    options.primaryCategory,
    options.projectId,
    options.scope,
    options.sortBy,
    options.sortOrder,
    options.tags,
    skipQuery,
  ]);

  // 监听条件变更或外部刷新 token
  useEffect(() => {
    void reload();
  }, [reload, options.refreshToken]);

  const deleteAsset = useCallback(
    async (assetId: string) => {
      try {
        const envelope = await apiDeleteAsset(assetId);
        const result = unwrapEnvelope(envelope);
        await reload();
        return { action: result.action, refCount: result.refCount };
      } catch (err) {
        toast.error(formatError(err));
        return null;
      }
    },
    [reload],
  );

  const updateAssetInfo = useCallback(
    async (assetId: string, payload: UpdateAssetRequest) => {
      try {
        unwrapEnvelope(await updateAsset(assetId, payload));
        await reload();
        return true;
      } catch (err) {
        toast.error(formatError(err));
        return false;
      }
    },
    [reload],
  );

  const promoteScope = useCallback(
    async (
      assetId: string,
      targetScope: AssetScope,
      targetProjectId?: string,
    ) => {
      try {
        unwrapEnvelope(
          await changeAssetScope(assetId, {
            targetScope,
            projectId: targetScope === "project" ? targetProjectId : undefined,
          }),
        );
        await reload();
        return true;
      } catch (err) {
        toast.error(formatError(err));
        return false;
      }
    },
    [reload],
  );

  const addToProject = useCallback(
    async (assetId: string, targetProjectId: string) => {
      try {
        unwrapEnvelope(
          await addProjectAssetRef(targetProjectId, { assetId }),
        );
        await reload();
        return true;
      } catch (err) {
        toast.error(formatError(err));
        return false;
      }
    },
    [reload],
  );

  const removeFromProject = useCallback(
    async (assetId: string, targetProjectId: string) => {
      try {
        unwrapEnvelope(
          await apiRemoveProjectAssetRef(targetProjectId, assetId),
        );
        await reload();
        return true;
      } catch (err) {
        toast.error(formatError(err));
        return false;
      }
    },
    [reload],
  );

  return useMemo(
    () => ({
      assets,
      total,
      totalPages,
      loading,
      error,
      reload,
      deleteAsset,
      updateAssetInfo,
      promoteScope,
      addToProject,
      removeFromProject,
    }),
    [
      addToProject,
      assets,
      deleteAsset,
      error,
      loading,
      promoteScope,
      reload,
      removeFromProject,
      total,
      totalPages,
      updateAssetInfo,
    ],
  );
};
