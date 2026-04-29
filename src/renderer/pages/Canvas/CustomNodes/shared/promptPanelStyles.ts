/**
 * 共享的面板样式配置
 * 图片和视频节点共用相同的样式
 */

export const PROMPT_PANEL_STYLES = {
  container:
    "nodrag nopan nowheel w-[720px] bg-[#1e1e20] border border-white/5 rounded-3xl p-5 shadow-2xl pointer-events-auto flex flex-col gap-4",

  inputArea: "relative flex flex-col gap-3",

  textAreaWrap:
    "w-full bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden focus-within:border-[#B43FEB]/50 focus-within:shadow-[0_0_15px_rgba(180,63,235,0.15)] transition-all shadow-inner",

  editorContent:
    "nodrag nopan nowheel w-full bg-transparent p-4 pb-8 text-sm text-white/90 outline-none cursor-text min-h-[100px] max-h-[220px] overflow-y-auto",

  divider: "w-full h-px bg-white/5 my-1",

  controlArea: "flex items-center justify-between gap-3 flex-wrap",

  uploadButton:
    "nodrag nopan nowheel flex flex-col items-center justify-center w-[60px] h-[60px] bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-[#B43FEB]/40 rounded-xl text-white/50 hover:text-[#B43FEB] transition-all cursor-pointer shadow-sm group",

  referenceImageButton:
    "group relative w-[60px] h-[60px] shrink-0 overflow-hidden rounded-xl border border-white/[0.05] bg-white/[0.02] shadow-sm hover:border-[#B43FEB]/40",

  modelSelect:
    "bg-white/5 hover:bg-white/10 border border-transparent hover:border-[#B43FEB]/30 px-4 py-2.5 rounded-xl text-xs text-white/80 font-medium flex items-center gap-2 transition-all cursor-pointer group shadow-sm h-auto w-auto",

  modelSelectContent:
    "bg-[#1a1a1d] border border-white/[0.08] rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden",

  modelSelectItem:
    "text-white/80 text-xs px-3 py-2 cursor-pointer transition-colors focus:bg-[#B43FEB]/10 focus:text-white data-[state=checked]:bg-[#B43FEB]/15 data-[state=checked]:text-[#B43FEB] hover:bg-white/[0.04] hover:text-white",

  paramsButton:
    "flex h-8 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100",

  paramsPopover: "border border-white/[0.06] bg-[#09090b] p-3 shadow-xl",

  paramsOption:
    "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all border-white/[0.06] bg-white/[0.02] hover:border-[#B43FEB]/30 hover:bg-white/[0.04]",

  paramsOptionActive:
    "flex flex-col items-center gap-1 rounded-lg border p-2 transition-all border-[#B43FEB] bg-[#B43FEB]/10",

  countButton:
    "bg-white/5 hover:bg-white/10 px-4 py-2.5 rounded-xl text-xs text-white/70 hover:text-white/90 font-bold transition-colors cursor-pointer shadow-sm",

  generateButton:
    "bg-[#c246ff] text-white px-7 py-2.5 rounded-xl text-sm font-bold hover:bg-[#b030e8] hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-[0_0_20px_rgba(194,70,255,0.3)]",

  stopButton:
    "bg-red-500/80 text-white px-7 py-2.5 rounded-xl text-sm font-bold hover:bg-red-500 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-sm",

  label: "text-xs font-medium text-white/70",

  secondaryText: "text-white/40",

  primaryText: "text-white/90",
} as const;
