/** 拖放占位框默认尺寸（px） */
export const FILE_DROP_PLACEHOLDER_SIZE = {
  width: 280,
  height: 180,
} as const;

/** 拖放占位框提示文字 */
export const FILE_DROP_HINT_TEXT = "拖入画布";

/** 不支持的文件类型提示 */
export const FILE_DROP_UNSUPPORTED_HINT = "不支持的文件类型";

/** 单次拖入最大文件数 */
export const FILE_DROP_MAX_COUNT = 20;

/** 单文件最大大小（500MB，与后端 OSS 限制一致） */
export const FILE_DROP_MAX_SIZE = 524_288_000;
