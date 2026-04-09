/**
 * 共享的面板样式配置
 * 图片和视频节点共用相同的样式
 */

export const PROMPT_PANEL_STYLES = {
  container: 'nodrag nopan nowheel w-[700px] rounded-2xl border border-white/[0.05] bg-[#1e1e20] p-3 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]',

  inputArea: 'relative mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2',

  controlArea: 'rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5',

  uploadButton: 'nodrag nopan nowheel h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-white/60 transition-colors hover:border-[#B43FEB]/50 hover:text-white/90 hover:bg-white/[0.04]',

  referenceImageButton: 'group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]',

  modelSelect: 'h-8 min-w-[160px] rounded-full border-white/[0.08] bg-white/[0.03] text-xs text-white/80 hover:border-[#B43FEB]/40 hover:bg-white/[0.05] focus:border-[#B43FEB] focus:ring-2 focus:ring-[#B43FEB]/20 transition-all',

  modelSelectContent: 'bg-[#1a1a1d] border border-white/[0.08] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden',

  modelSelectItem: 'text-white/80 text-xs px-3 py-2 cursor-pointer transition-colors focus:bg-[#B43FEB]/10 focus:text-white data-[state=checked]:bg-[#B43FEB]/15 data-[state=checked]:text-[#B43FEB] hover:bg-white/[0.04] hover:text-white',

  paramsButton: 'flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs text-white/70 transition-colors hover:border-[#B43FEB]/30 hover:text-white/90 hover:bg-white/[0.04]',

  paramsPopover: 'border border-white/[0.06] bg-[#09090b] p-3 shadow-xl',

  paramsOption: 'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all border-white/[0.06] bg-white/[0.02] hover:border-[#B43FEB]/30 hover:bg-white/[0.04]',

  paramsOptionActive: 'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all border-[#B43FEB] bg-[#B43FEB]/10',

  countButton: 'nodrag nopan nowheel inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs font-medium text-white/70 transition-colors hover:border-white/[0.12] hover:text-white/90 hover:bg-white/[0.04]',

  generateButton: 'bg-[#B43FEB] text-white hover:bg-[#B43FEB]/80 h-8 px-4 text-xs font-medium rounded-lg transition-colors active:scale-[0.97]',

  stopButton: 'bg-red-500/80 text-white hover:bg-red-500 h-8 px-4 text-xs font-medium rounded-lg transition-colors active:scale-[0.97]',

  label: 'text-xs font-medium text-white/70',

  secondaryText: 'text-white/40',

  primaryText: 'text-white/90',
} as const