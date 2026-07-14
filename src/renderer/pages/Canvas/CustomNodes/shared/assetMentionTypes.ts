import type {
  AssetCategory,
  AssetScope,
  MediaType,
  PrimaryCategory,
} from "shared/types/api/assets";

/** 资源 mention 的来源：连接节点或远程资产库。 */
export type AssetMentionSource = "connected-node" | "remote-asset";

export type AssetMentionOptionType = "asset" | "scope-folder" | "category-folder";

/** 资产 mention 菜单中可被选择或展示为禁用态的单项资源。 */
export interface MentionAssetOption {
  key: string;
  id: string;
  label: string;
  value: string;
  description?: string;
  mediaType: MediaType;
  thumbnailUrl?: string;
  fileUrl?: string;
  source: AssetMentionSource;
  /** 目录节点与真实媒体文件必须显式区分，目录不能写入提示词。 */
  optionType: AssetMentionOptionType;
  scope?: AssetScope;
  primaryCategory?: PrimaryCategory;
  categoryName?: string;
  /** 分类目录对应的原始分类对象，用于继续进入其子目录。 */
  folderCategory?: AssetCategory;
  nodeId?: string;
  assetId?: string;
  disabled?: boolean;
  disabledReason?: string;
}

/** 菜单分组：已连接节点或某个远程资产 scope。 */
export interface AssetMentionGroup {
  key: string;
  label: string;
  kind: "connected" | "scope";
  children: AssetMentionSection[];
}

/** 菜单分组下的二级分类，图片会继续按 primaryCategory 拆分。 */
export interface AssetMentionSection {
  key: string;
  label: string;
  mediaType?: MediaType;
  primaryCategory?: PrimaryCategory;
  options: MentionAssetOption[];
  emptyText: string;
}

/** 归组工具的输入，后续 Hook 会把已连接节点和远程资产汇总到这里。 */
export interface BuildAssetMentionGroupsInput {
  connectedOptions?: MentionAssetOption[];
  folderOptions?: MentionAssetOption[];
  remoteOptions?: MentionAssetOption[];
  categoryOptions?: AssetCategory[];
  activeScope?: AssetScope | null;
  activeCategory?: AssetCategory | null;
  projectUnavailable?: boolean;
}

/** 从画布连接节点提取 mention 选项时使用的中间结构。 */
export interface ConnectedAssetMentionInput {
  nodeId: string;
  label?: string;
  description?: string;
  mediaType: MediaType;
  fileUrl?: string;
  thumbnailUrl?: string;
}

export const isAssetMentionFolder = (option: MentionAssetOption) =>
  option.optionType === "scope-folder" ||
  option.optionType === "category-folder";

export const isAssetMentionFile = (option: MentionAssetOption) =>
  option.optionType === "asset";
