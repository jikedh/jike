/**
 * 共享的面板样式配置
 * 图片和视频节点共用相同的样式
 */

export const PROMPT_PANEL_STYLES = {
  // 主容器样式
  container: 'nodrag nopan nowheel w-[700px] rounded-2xl border border-white/[0.05] bg-[#1e1e20] p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',

  // 输入区域样式
  inputArea: 'relative mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2',

  // 参数控制区域样式
  controlArea: 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5',

  // 上传按钮样式
  uploadButton: 'nodrag nopan nowheel h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-white/60 transition-colors hover:border-[#B43FEB]/50 hover:text-white/90 hover:bg-white/[0.04]',

  // 参考图按钮样式
  referenceImageButton: 'group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]',

  // 模型选择器样式
  modelSelect: 'h-8 min-w-[160px] border-white/[0.06] bg-white/[0.02] text-xs text-white/90 hover:border-[#B43FEB]/30',

  // 模型下拉内容样式
  modelSelectContent: 'bg-[#09090b] border border-white/[0.06]',

  // 模型选项样式
  modelSelectItem: 'text-white/90 focus:bg-white/[0.04] focus:text-white',

  // 参数按钮样式
  paramsButton: 'flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-white/70 transition-colors hover:border-[#B43FEB]/30 hover:text-white/90 hover:bg-white/[0.04]',

  // 参数弹出面板样式
  paramsPopover: 'border border-white/[0.06] bg-[#09090b] p-3 shadow-xl',

  // 参数选项样式 - 未选中
  paramsOption: 'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all border-white/[0.06] bg-white/[0.02] hover:border-[#B43FEB]/30 hover:bg-white/[0.04]',

  // 参数选项样式 - 选中
  paramsOptionActive: 'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all border-[#B43FEB] bg-[#B43FEB]/10',

  // 数量按钮样式
  countButton: 'nodrag nopan nowheel inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs font-medium text-white/70 transition-colors hover:border-white/[0.12] hover:text-white/90 hover:bg-white/[0.04]',

  // 生成按钮样式
  generateButton: 'bg-[#B43FEB] text-white hover:bg-[#B43FEB]/80 h-8 px-4 text-xs font-medium rounded-lg transition-colors active:scale-[0.97]',

  // 标签样式
  label: 'text-xs font-medium text-white/70',

  // 次要文字样式
  secondaryText: 'text-white/40',

  // 主要文字样式
  primaryText: 'text-white/90',
} as const