import type {
  AssetCategory,
  AssetScope,
  MediaType,
  PrimaryCategory,
} from "shared/types/api/assets";
import type {
  AllNodeType,
  AudioGenerationNode,
  ImageGenerationNode,
  NewVideoGenerationNode,
} from "shared/types/flow";
import type { RemoteAsset } from "../../utils/remoteAssets";
import type {
  AssetMentionGroup,
  AssetMentionSection,
  BuildAssetMentionGroupsInput,
  ConnectedAssetMentionInput,
  MentionAssetOption,
} from "./assetMentionTypes";

export const ASSET_MENTION_SCOPE_ORDER = [
  "project",
  "personal",
] as const satisfies readonly AssetScope[];

const ASSET_MENTION_VALID_SCOPES = [
  "project",
  "personal",
  "public",
] as const satisfies readonly AssetScope[];

export const ASSET_MENTION_MEDIA_ORDER = [
  "image",
  "video",
  "audio",
] as const satisfies readonly MediaType[];

export const ASSET_MENTION_IMAGE_CATEGORY_ORDER = [
  "scene",
  "character",
  "prop",
] as const satisfies readonly PrimaryCategory[];

export const ASSET_MENTION_SCOPE_LABEL: Record<AssetScope, string> = {
  project: "项目资产",
  personal: "个人资产",
  public: "公开资产",
};

export const ASSET_MENTION_MEDIA_LABEL: Record<MediaType, string> = {
  image: "图片",
  video: "视频",
  audio: "音频",
};

export const ASSET_MENTION_CATEGORY_LABEL: Record<PrimaryCategory, string> = {
  scene: "场景",
  character: "角色",
  prop: "道具",
};

const MEDIA_TYPE_SET = new Set<string>(ASSET_MENTION_MEDIA_ORDER);
const SCOPE_SET = new Set<string>(ASSET_MENTION_VALID_SCOPES);

const SOURCE_LABEL_MAP: Record<MentionAssetOption["source"], string> = {
  "connected-node": "已连接节点",
  "remote-asset": "远程资产",
};

const DEFAULT_CATEGORY: PrimaryCategory = "prop";
const DEFAULT_SCOPE: AssetScope = "personal";

const isMediaType = (value: unknown): value is MediaType =>
  typeof value === "string" && MEDIA_TYPE_SET.has(value);

const isAssetScope = (value: unknown): value is AssetScope =>
  typeof value === "string" && SCOPE_SET.has(value);

const isPrimaryCategory = (value: unknown): value is PrimaryCategory =>
  typeof value === "string" && value.trim().length > 0;

const getCategoryLabel = (category: PrimaryCategory) =>
  ASSET_MENTION_CATEGORY_LABEL[category] ?? category;

/** 后端允许分类 code 为空，此时分类 ID 是唯一且可用于 `primaryCategory` 筛选的值。 */
export const getAssetCategoryValue = (category: AssetCategory): PrimaryCategory =>
  category.code.trim() || String(category.id);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
};

const toStringValue = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

const getResultItems = (data: unknown) => {
  const result = asRecord(asRecord(data).result);
  const items = result.data;
  return Array.isArray(items) ? items.map(asRecord) : [];
};

const getFirstResultItem = (data: unknown) => getResultItems(data)[0];

const getUrlFromResultItem = (item: Record<string, unknown> | undefined) => {
  if (!item) return "";
  return (
    toStringValue(item.remoteUrl) ||
    toStringValue(item.url) ||
    toStringValue(item.displayUrl)
  );
};

const getThumbnailFromResultItem = (
  item: Record<string, unknown> | undefined,
  fallbackUrl: string,
) => {
  if (!item) return fallbackUrl;
  return (
    toStringValue(item.thumbnailUrl) ||
    toStringValue(item.posterUrl) ||
    toStringValue(item.coverUrl) ||
    toStringValue(item.displayUrl) ||
    fallbackUrl
  );
};

const getNodeDisplayLabel = (node: Pick<AllNodeType, "type" | "data">) => {
  const data = asRecord(node.data);
  const nickname = toStringValue(data.nickname);
  if (nickname) return nickname;

  const badgeLabel = toStringValue(data.badgeLabel);
  if (badgeLabel) return badgeLabel;

  const assetName = toStringValue(getFirstResultItem(node.data)?.assetName);
  if (assetName) return assetName;

  const labelMap: Record<string, string> = {
    imageNode: data.isUpload ? "上传图片" : "生成图片",
    newVideoNode: data.isUpload ? "上传视频" : "生成视频",
    audioNode: data.isUpload ? "上传音频" : "生成音频",
  };

  return labelMap[node.type] || "媒体节点";
};

const getNodeMediaPayload = (node: AllNodeType) => {
  if (node.type === "imageNode") {
    const data = node.data as ImageGenerationNode;
    const item = getFirstResultItem(data);
    const fileUrl = getUrlFromResultItem(item);
    return {
      mediaType: "image" as const,
      fileUrl,
      thumbnailUrl: getThumbnailFromResultItem(item, fileUrl),
    };
  }

  if (node.type === "newVideoNode") {
    const data = node.data as NewVideoGenerationNode;
    const item = getFirstResultItem(data);
    const metadata = asRecord(data.metadata);
    const fileUrl = getUrlFromResultItem(item) || toStringValue(metadata.url);
    return {
      mediaType: "video" as const,
      fileUrl,
      thumbnailUrl: getThumbnailFromResultItem(item, fileUrl),
    };
  }

  if (node.type === "audioNode") {
    const data = node.data as AudioGenerationNode;
    const item = getFirstResultItem(data);
    const fileUrl = getUrlFromResultItem(item);
    return {
      mediaType: "audio" as const,
      fileUrl,
      thumbnailUrl: getThumbnailFromResultItem(item, fileUrl),
    };
  }

  return null;
};

const buildDisabledPatch = ({
  mediaType,
  fileUrl,
}: {
  mediaType?: MediaType;
  fileUrl?: string;
}) => {
  if (!mediaType) {
    return { disabled: true, disabledReason: "资源类型缺失" };
  }
  if (!fileUrl) {
    return { disabled: true, disabledReason: "资源地址缺失" };
  }
  return {};
};

export const normalizeConnectedAssetMentionOption = (
  input: ConnectedAssetMentionInput,
): MentionAssetOption => {
  const label = input.label?.trim() || ASSET_MENTION_MEDIA_LABEL[input.mediaType];
  const fileUrl = input.fileUrl?.trim() || "";

  return {
    key: `connected:${input.nodeId}:${input.mediaType}`,
    id: `connected-${input.nodeId}`,
    label,
    value: label,
    description: input.description,
    mediaType: input.mediaType,
    thumbnailUrl: input.thumbnailUrl,
    fileUrl,
    source: "connected-node",
    optionType: "asset",
    nodeId: input.nodeId,
    ...buildDisabledPatch({ mediaType: input.mediaType, fileUrl }),
  };
};

export const buildAssetScopeFolderOption = ({
  scope,
  disabled,
  disabledReason,
}: {
  scope: AssetScope;
  disabled?: boolean;
  disabledReason?: string;
}): MentionAssetOption => ({
  key: `scope-folder:${scope}`,
  id: `scope-folder-${scope}`,
  label: ASSET_MENTION_SCOPE_LABEL[scope],
  value: ASSET_MENTION_SCOPE_LABEL[scope],
  description: "点击展开资产分类",
  mediaType: "image",
  source: "remote-asset",
  optionType: "scope-folder",
  scope,
  disabled,
  disabledReason,
});

export const buildAssetCategoryFolderOption = ({
  scope,
  category,
}: {
  scope: AssetScope;
  category: AssetCategory;
}): MentionAssetOption => {
  const categoryValue = getAssetCategoryValue(category);

  return {
    key: `category-folder:${scope}:${categoryValue}`,
    id: `category-folder-${scope}-${category.id}`,
    label: category.name,
    value: category.name,
    description: "点击查看该分类下的图片资产",
    mediaType: "image",
    source: "remote-asset",
    optionType: "category-folder",
    scope,
    primaryCategory: categoryValue,
    categoryName: category.name,
    folderCategory: category,
  };
};

export const normalizeCanvasNodeMentionOption = (
  node: AllNodeType,
): MentionAssetOption | null => {
  const payload = getNodeMediaPayload(node);
  if (!payload) return null;

  return normalizeConnectedAssetMentionOption({
    nodeId: node.id,
    label: getNodeDisplayLabel(node),
    mediaType: payload.mediaType,
    fileUrl: payload.fileUrl,
    thumbnailUrl: payload.thumbnailUrl,
  });
};

export const normalizeRemoteAssetMentionOption = (
  asset: Partial<RemoteAsset>,
): MentionAssetOption => {
  const mediaType = isMediaType(asset.mediaType) ? asset.mediaType : undefined;
  const scope = isAssetScope(asset.scope) ? asset.scope : DEFAULT_SCOPE;
  const primaryCategory = isPrimaryCategory(asset.primaryCategory)
    ? asset.primaryCategory
    : DEFAULT_CATEGORY;
  const assetId = toStringValue(asset.id);
  const fileUrl = toStringValue(asset.fileUrl);
  const label = toStringValue(asset.name) || ASSET_MENTION_MEDIA_LABEL[mediaType ?? "image"];
  const disabledPatch = buildDisabledPatch({ mediaType, fileUrl });

  return {
    key: `asset:${assetId || label}:${scope}:${mediaType ?? "unknown"}`,
    id: assetId ? `asset-${assetId}` : `asset-${scope}-${label}`,
    label,
    value: label,
    description: toStringValue(asset.description),
    mediaType: mediaType ?? "image",
    thumbnailUrl: toStringValue(asset.thumbnailUrl),
    fileUrl,
    source: "remote-asset",
    optionType: "asset",
    scope,
    primaryCategory,
    assetId,
    ...disabledPatch,
  };
};

const buildConnectedGroup = (
  connectedOptions: MentionAssetOption[],
  folderOptions: MentionAssetOption[] = [],
): AssetMentionGroup => ({
  key: "connected",
  label: "已经连接的节点",
  kind: "connected",
  children: [
    {
      key: "connected:media",
      label: "媒体节点",
      options: connectedOptions,
      emptyText: "暂无通过连接线关联的图片、视频或音频",
    },
    {
      key: "connected:asset-folders",
      label: "资产库",
      options: folderOptions,
      emptyText: "暂无可用资产库",
    },
  ],
});

const buildCategoryFolderGroup = ({
  scope,
  categoryOptions = [],
}: {
  scope: AssetScope;
  categoryOptions?: AssetCategory[];
}): AssetMentionGroup => ({
  key: `scope:${scope}:categories`,
  label: ASSET_MENTION_SCOPE_LABEL[scope],
  kind: "scope",
  children: [
    {
      key: `${scope}:category-folders`,
      label: "资产分类",
      options: categoryOptions.map((category) =>
        buildAssetCategoryFolderOption({ scope, category }),
      ),
      emptyText: "暂无资产分类",
    },
  ],
});

const buildImageCategorySections = (
  scope: AssetScope,
  options: MentionAssetOption[],
): AssetMentionSection[] => {
  const imageOptions = options.filter((item) => item.mediaType === "image");

  return ASSET_MENTION_IMAGE_CATEGORY_ORDER.map((category) => ({
    key: `${scope}:image:${category}`,
    label: getCategoryLabel(category),
    mediaType: "image",
    primaryCategory: category,
    options: imageOptions.filter((item) => item.primaryCategory === category),
    emptyText: `暂无${getCategoryLabel(category)}图片`,
  }));
};

const buildMediaSection = (
  scope: AssetScope,
  mediaType: Exclude<MediaType, "image">,
  options: MentionAssetOption[],
): AssetMentionSection => ({
  key: `${scope}:${mediaType}`,
  label: ASSET_MENTION_MEDIA_LABEL[mediaType],
  mediaType,
  options: options.filter((item) => item.mediaType === mediaType),
  emptyText: `暂无${ASSET_MENTION_MEDIA_LABEL[mediaType]}资产`,
});

const buildScopeGroup = ({
  scope,
  remoteOptions,
  projectUnavailable,
}: {
  scope: AssetScope;
  remoteOptions: MentionAssetOption[];
  projectUnavailable?: boolean;
}): AssetMentionGroup => {
  const scopeOptions = remoteOptions.filter((item) => item.scope === scope);
  const projectEmptyText = projectUnavailable
    ? "当前画布未绑定项目"
    : "暂无项目资产";

  return {
    key: `scope:${scope}`,
    label: ASSET_MENTION_SCOPE_LABEL[scope],
    kind: "scope",
    children: [
      ...buildImageCategorySections(scope, scopeOptions),
      {
        ...buildMediaSection(scope, "video", scopeOptions),
        emptyText: scope === "project" ? projectEmptyText : "暂无视频资产",
      },
      {
        ...buildMediaSection(scope, "audio", scopeOptions),
        emptyText: scope === "project" ? projectEmptyText : "暂无音频资产",
      },
    ],
  };
};

export const buildAssetMentionGroups = ({
  connectedOptions = [],
  folderOptions = [],
  remoteOptions = [],
  categoryOptions = [],
  activeScope,
  activeCategory,
  projectUnavailable,
}: BuildAssetMentionGroupsInput): AssetMentionGroup[] => {
  if (!activeScope) {
    return [buildConnectedGroup(connectedOptions, folderOptions)];
  }

  if (!activeCategory || (activeCategory.children?.length ?? 0) > 0) {
    return [buildCategoryFolderGroup({ scope: activeScope, categoryOptions })];
  }

  return [
    {
      ...buildScopeGroup({
        scope: activeScope,
        remoteOptions,
        projectUnavailable: activeScope === "project" && projectUnavailable,
      }),
      children: [
        {
          key: `${activeScope}:assets:${getAssetCategoryValue(activeCategory)}`,
          label: activeCategory.name,
          mediaType: "image",
          primaryCategory: getAssetCategoryValue(activeCategory),
          options: remoteOptions.filter(
            (item) =>
              item.scope === activeScope &&
              item.primaryCategory === getAssetCategoryValue(activeCategory) &&
              item.mediaType === "image",
          ),
          emptyText: "暂无该分类下的图片资产",
        },
      ],
    },
  ];
};

export const getSelectableAssetMentionOptions = (
  groups: AssetMentionGroup[],
): MentionAssetOption[] =>
  groups.flatMap((group) =>
    group.children.flatMap((section) =>
      section.options.filter((option) => !option.disabled),
    ),
  );

export const getAssetMentionOptionSourceLabel = (option: MentionAssetOption) => {
  if (option.optionType === "scope-folder") return "资产库";
  if (option.optionType === "category-folder") return "资产分类";
  if (option.source === "connected-node") return SOURCE_LABEL_MAP[option.source];
  const scopeLabel = option.scope ? ASSET_MENTION_SCOPE_LABEL[option.scope] : "来源未知";
  const mediaLabel = ASSET_MENTION_MEDIA_LABEL[option.mediaType];
  const categoryLabel =
    option.mediaType === "image" && option.primaryCategory
      ? ` / ${getCategoryLabel(option.primaryCategory)}`
      : "";
  return `${scopeLabel} / ${mediaLabel}${categoryLabel}`;
};
