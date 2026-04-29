# 视频节点重构 — 设计文档

## 1. 概述

本文档描述新版视频节点（`New-VideoNode`）第一阶段（纯 Mock UI 原型）的架构设计、组件层级、数据模型和交互设计。所有数据均为静态 Mock，不接入真实 Store 或 API。

### 设计目标

- 在画布上可创建新版视频节点，与旧版共存
- 完整展示底部视频生成面板的 UI 布局（模式切换 → 参考图 → 提示词 → 参数栏）
- 参考图支持拖拽排序 + 悬停大图预览
- 提示词输入支持 `@` 提及（Mock 数据）
- 所有交互数据集中在 `constants/mockData.ts`，为后续替换为真实数据做好准备

---

## 2. 目录结构

```
New-VideoNode/
├── index.tsx                          # 节点入口组件 (Node Shell)
├── VideoContent.tsx                   # 节点内容区域（占位/结果展示）
├── VideoPromptPanel.tsx               # 底部面板容器（组装所有子面板）
│
├── components/
│   ├── ModeToggleBar.tsx              # 模式切换按钮行：文生视频/全能参考/图生视频/首尾帧/图片参考
│   │                                  # 根据模型能力 + 参考图数量，计算各模式的启用/禁用状态
│   ├── ReferenceThumbnails.tsx        # 参考图缩略图区（可拖拽 + 悬停预览）
│   ├── ThumbnailPreviewPopover.tsx    # 悬停大图预览浮窗
│   ├── PromptEditor.tsx               # Tiptap 富文本编辑器（Mention 插件实现 @提及）
│   ├── MentionList.tsx               # @提及候选项下拉列表（Tiptap Suggestion 渲染）
│   ├── BottomParamsBar.tsx            # 底部参数栏（模型/参数/数量/积分/生成按钮）
│   └── index.ts                      # Barrel export
│
├── constants/
│   ├── mockData.ts                    # 所有 Mock 数据集中定义
│   └── videoModelCapabilities.ts      # 模型能力配置（主模型 → 子模型 → 支持的模式）
│
└── hooks/
    └── useModeAvailability.ts        # 计算模式启用/禁用状态的核心 Hook
```

### 与旧 `VideoNode/` 目录的关系

```
VideoNode/ (旧)                          New-VideoNode/ (新)
├── index.tsx                             ├── index.tsx
├── VideoContent.tsx                      ├── VideoContent.tsx (简化版)
├── VideoPromptPanel.tsx                  ├── VideoPromptPanel.tsx (全新设计)
├── VideoToolbar.tsx                      │    (无顶部工具栏)
├── VideoMentionList.tsx                  │
├── CollapsibleVideoGallery.tsx           │
├── components/                           ├── components/
│   ├── modelParamsConfig.ts              │   ├── ModeToggleBar.tsx (新)
│   ├── PixVerseParamsPanel.tsx           │   ├── ReferenceThumbnails.tsx (新)
│   ├── UnifiedVideoParamsPanel.tsx       │   ├── ThumbnailPreviewPopover.tsx (新)
│   ├── VideoModelParamsPanel.tsx          │   ├── PromptInput.tsx (新, 轻量 textarea)
│   ├── VideoPromptEditor.tsx             │   └── BottomParamsBar.tsx (新)
│   ├── VideoReferenceAssetsBar.tsx       │
│   ├── VideoSnapshotPanel.tsx            ├── constants/
│   └── VideoTimeline.tsx                 │   └── mockData.ts (新)
├── constants/                            │
│   └── videoModelCapabilities.ts         └── hooks/
├── hooks/                                 └── useMockMention.ts (新)
│   ├── useVideoFrameCapture.ts
│   ├── useVideoNodeReferences.ts
│   └── useVideoReferenceActions.ts
├── strategies/
│   └── videoPayloadStrategies.ts
└── utils/
    └── video-url.ts
```

---

## 3. 组件层级与数据流

### 3.1 组件树

```
<NewVideoNode>                            ← Node Shell (index.tsx)
├── <ButtonHandle /> (输入/输出)          ← ReactFlow Handle
├── <NodeContextMenu />                    ← 右键菜单（复制、删除）
│
├── 节点内容区域
│   ├── 占位状态: "空视频节点"
│   └── 结果展示: [future] 视频播放器
│
└── <VideoPromptPanel>                     ← 底部面板容器
    ├── <ModeToggleBar />                  ← 模式按钮行
    │   props: modes, activeMode, onModeChange
    │
    ├── <ReferenceThumbnails />            ← 参考图缩略图区
    │   ├── 使用 @dnd-kit/sortable 实现拖拽排序
    │   ├── 每项: <ThumbnailPreviewPopover />
    │   └── 数字角标 (1, 2, 3)
    │
    ├── <PromptInput />                    ← 提示词输入框
    │   ├── textarea + placeholder
    │   └── @ 触发 -> useMockMention -> Mock 候选项列表
    │
    └── <BottomParamsBar />                ← 底部参数栏
        ├── 模型 <Select> (Mock)
        ├── 参数 <Select> (Mock)
        ├── 翻译按钮 (Mock)
        ├── 数量 <Select> (Mock)
        ├── 积分余额显示 (Mock)
        └── 生成按钮 (Mock)
```

### 3.2 数据流

```
constants/videoModelCapabilities.ts
  ├── MODEL_SUB_VARIANTS: Record<MainModel, SubVariant[]>
  │     每个子模型定义其支持的模式
  ├── MODE_LABELS: Record<ModeKey, string>
  └── MODE_REFERENCE_CONSTRAINTS: 各模式对参考图数量的约束规则
        |
        ↓
constants/mockData.ts
  ├── MOCK_MODELS: MainModel[]               → BottomParamsBar.modelSelect
  ├── MOCK_PARAM_PRESETS: ParamPreset[]      → BottomParamsBar.paramSelect
  ├── MOCK_REFERENCE_IMAGES: string[]        → ReferenceThumbnails
  ├── MOCK_MENTION_ITEMS: MentionItem[]      → PromptEditor (Tiptap Mention 插件)
  ├── MOCK_POINTS_BALANCE: { used, total }   → BottomParamsBar.pointsDisplay
  └── MOCK_REFERENCE_COUNT: number           → 当前参考图数量（联动缩略图）
        |
        ↓
hooks/useModeAvailability.ts
  ├── 入参: selectedMainModel, referenceCount
  ├── 逻辑:
  │   1. 查 MODEL_SUB_VARIANTS 获取当前主模型的所有子模型
  │   2. 合并所有子模型的 supportedModes 得到 "模型能力允许的模式集合"
  │   3. 根据 MODE_REFERENCE_CONSTRAINTS 和 referenceCount 过滤
  │   4. 生成每个模式的 { enabled, disabledReason }
  └── 输出: { modes: ModeState[] }         → ModeToggleBar
        |
        ↓
  各组件内部 useState 管理 UI 状态
        |
        ↓
  无 API 调用, 无 Store 写入
  所有状态变化仅影响当前组件局部 UI
```

---

## 4. 组件详细设计

### 4.1 `index.tsx` — 节点外壳

**职责**：作为 ReactFlow 自定义节点入口，渲染节点容器 + Handle + 内容区 + 底部面板。

| 关注点 | 实现方式 |
|--------|---------|
| 类型 | `NodeProps<NewVideoNodeType>`，使用 `"newVideoNode"` 类型标识 |
| 尺寸 | 根据 `data.aspect_ratio` 动态计算（默认 16:9），复用 `getNodeSizeByAspectRatio` |
| 选中态 | 紫色边框 + 四角装饰 + 发光效果（与旧节点一致） |
| Handle | 左右各一个 `ButtonHandle`，选中/悬停时 `visible` |
| 右键 | `NodeContextMenu` 包裹，支持复制、删除 |
| 内容区 | 简单占位文案或未来视频结果 |
| 底部面板 | 选中时显示 `VideoPromptPanel`，未选中时隐藏 |

```tsx
// 伪代码示意
export const NewVideoNode = memo(({ id, data, selected }: NodeProps<NewVideoNodeType>) => {
  const nodeSize = useMemo(() => computeNodeSize(data.aspect_ratio), [data.aspect_ratio]);
  const shouldShowPanel = selected && selectedNodesCount <= 1;

  return (
    <NodeContextMenu onDuplicate={() => {}} onDelete={() => {}}>
      <div style={{ width: nodeSize.width, height: nodeSize.height }}>
        <ButtonHandle type="target" position={Position.Left} id="input" />
        <ButtonHandle type="source" position={Position.Right} id="output" />
        <div className="content-area">
          <VideoContent />
        </div>
        {shouldShowPanel && <VideoPromptPanel />}
      </div>
    </NodeContextMenu>
  );
});
```

### 4.2 `VideoContent.tsx` — 内容区域

**职责**：展示节点主体内容。

- 第一阶段：仅展示占位内容（空状态，无视频结果）
- 完整布局为 `aspectRatio` 比例的容器，灰底 + 中央图标/文案
- 未来可扩展为展示视频播放器或生成状态

### 4.3 `VideoPromptPanel.tsx` — 底部面板容器

**职责**：组装所有子组件，管理布局间距。

- 使用 `PROMPT_PANEL_STYLES.container` 的宽度和圆角风格
- 垂直排列：ModeToggleBar → ReferenceThumbnails → PromptInput → BottomParamsBar
- 各子组件间用 `gap-3` 分隔

### 4.4 `ModeToggleBar.tsx` — 模式切换按钮行

**职责**：展示 5 个模式按钮，根据模型能力和参考图数量计算各模式的启用/禁用状态，禁用时鼠标悬停显示原因。

| 属性 | 类型 | 说明 |
|------|------|------|
| `modes` | `ModeState[]` | 模式列表，每个模式包含 `key`、`label`、`enabled`、`disabledReason?` |
| `activeMode` | `string` | 当前选中模式 |
| `onModeChange` | `(mode: string) => void` | 切换回调 |

**视觉设计**：

```
┌──────────────────────────────────────────────────────────────┐
│ [文生视频]  [● 全能参考]  [图生视频]  [首尾帧 ⚠️]  [图片参考]  │
│                             禁用态: 灰色+⚠️  光标悬浮显示原因   │
└──────────────────────────────────────────────────────────────┘
```

- 按钮底色为 `bg-white/[0.03]`，选中态为 `bg-[#B43FEB]/15 text-[#B43FEB]`
- **禁用态**：`opacity-40 cursor-not-allowed`，灰度显示
- 禁用按钮右侧有一个小 ⚠️ 图标
- 选中按钮左侧或上方有圆点指示器
- 所有按钮平铺在一行，无滚动
- **禁用态 Tooltip**：使用 shadcn `<Tooltip>` 包裹每个按钮，禁用时显示 `disabledReason` 文案
- 交互：点击启用按钮 → 更新 `activeMode`；点击禁用按钮 → 不切换，Tooltip 显示原因

**ModeState 类型**：

```typescript
export interface ModeState {
  key: string;
  label: string;
  enabled: boolean;
  disabledReason?: string; // 如 "当前模型不支持文生视频" 或 "参考图数量超过2张，不支持首尾帧"
}
```

### 4.5 `ReferenceThumbnails.tsx` — 参考图缩略图

**职责**：展示可拖拽排序的参考图缩略图，并支持悬停大图预览。

| 属性 | 类型 | 说明 |
|------|------|------|
| `images` | `string[]` | 图片 URL 数组 |
| `onReorder` | `(newOrder: string[]) => void` | 拖拽排序回调 |

**实现要点**：

- 使用 `@dnd-kit/sortable` 的 `SortableContext` + `useSortable` 实现同级拖拽排序
- 每张缩略图外层包裹 `ThumbnailPreviewPopover` 组件
- 拖拽时使用 `DragOverlay` 展示拖拽中的半透明副本
- 卡片尺寸：`w-[60px] h-[60px]`，与旧 `referenceImageButton` 风格一致
- 数字角标：在缩略图左上角用白色圆形 badge 显示序号 (1, 2, 3)
- 拖拽激活条件：`PointerSensor` 距离 >= 8px（与项目中已有的 @dnd-kit 配置一致）

**拖拽排序流程**：

```
用户拖拽缩略图
  → SortableContext 检测 DragEndEvent
  → arrayMove(images, oldIndex, newIndex)
  → useState 更新本地顺序
  → 排序后数字角标自动更新
```

### 4.6 `ThumbnailPreviewPopover.tsx` — 悬停大图预览

**职责**：鼠标悬停缩略图时，在其上方弹出一个大图预览浮窗。

| 属性 | 类型 | 说明 |
|------|------|------|
| `src` | `string` | 图片 URL |
| `index` | `number` | 序号（用于展示） |
| `children` | `ReactNode` | 触发悬停的子元素（缩略图） |

**视觉设计**：

```
        ┌──────────────────────┐
        │                      │
        │    大图预览浮窗        │  ← 圆角 rounded-xl
        │    ~240x240px         │  ← 缩略图的约 4 倍
        │                      │
        └──────────────────────┘
              ▲
              │ 悬停触发
         ┌────────┐
         │ 缩略图  │  ← 60x60px
         │  (1)   │
         └────────┘
```

**行为**：
- 鼠标进入缩略图区域 200ms 后弹出浮窗（防止快速划过时闪烁）
- 浮窗定位在缩略图正上方，通过 `position: absolute` + `bottom: calc(100% + 8px)` 实现
- 浮窗包含完整的圆角图片 + 序号标记
- 鼠标移出缩略图和浮窗区域时关闭（使用 `onMouseEnter/onMouseLeave` + 超时延迟）
- 使用 CSS `transition` 实现淡入淡出效果

### 4.7 `PromptEditor.tsx` — Tiptap 富文本编辑器（@提及）

**职责**：基于 Tiptap + @tiptap/extension-mention 的富文本编辑器，支持 `@` 触发提及并渲染为带缩略图的标签 pill。

| 属性 | 类型 | 说明 |
|------|------|------|
| `mentionItems` | `MentionItem[]` | @提及候选项列表 |
| `value` | `string` | 当前输入值（纯文本，供父组件读取） |
| `onChange` | `(text: string) => void` | 输入变化回调 |

**实现方式**：

- 使用 `@tiptap/react` 的 `useEditor` + `EditorContent`
- Mention 扩展配置：
  - `deleteTriggerWithBackspace: true` — 退格键删除整个 mention 节点
  - 自定义 `renderHTML`，渲染为带有缩略图的 pill 样式（与旧 `VideoPromptEditor.tsx` 一致）
  - `suggestion` 配置：`char: "@"`，使用 `ReactRenderer` 渲染 `MentionList` 组件
- 复用项目已有的 CSS 类名 `.video-node-mention-pill`、`.video-node-mention-pill__thumbnail`
- 编辑器最小高度：`min-h-[80px]`，最大高度：`max-h-[160px]`，超出滚动

**`MentionList.tsx`** — @提及候选项下拉列表

- 使用 `forwardRef` 暴露 `onKeyDown` 方法供 Tiptap Suggestion 插件调用
- 键盘导航：↑↓ 移动选中项，Enter 确认选中
- 候选项展示：缩略图 + 名称 + 类型标记（与旧 `VideoMentionList.tsx` 一致）
- 使用 `@floating-ui/dom`（`posToDOMRect` + `computePosition`）定位在光标下方

**Mock 数据格式**（与旧 `VideoMentionItem` 接口一致）：

```typescript
export interface MentionItem {
  id: string;
  label: string;
  value: string;
  thumbnail: string;   // 缩略图 URL
  type: "image" | "video" | "audio";
}
```

> **设计决策**：Mock 阶段复用旧 `VideoMentionList.tsx` 的 UI 风格和新建简化版 MentionList。后续接入真实数据时，mentionItems 从节点连线关系推导（如旧 `VideoPromptPanel.tsx` 中的 `availableReferenceMentions`），组件代码无需修改。

### 4.8 `BottomParamsBar.tsx` — 底部参数栏

**职责**：展示模型选择、参数预设、翻译、数量、积分、生成按钮。

**视觉设计**：

```
┌──────────────────────────────────────────────────────────────┐
│ [Seedance 2.0 VIP ▾]  [16:9·720P·5s ▾]  [翻译]  [1个▾]  [108/135]  [➚] │
│  模型下拉         参数下拉         翻译按钮  数量    积分余额   生成按钮  │
└──────────────────────────────────────────────────────────────┘
```

| 子区域 | 实现方式 | Mock 数据来源 |
|--------|---------|--------------|
| 模型下拉 | shadcn `<Select>` 组件 | `MOCK_MODELS` |
| 参数下拉 | shadcn `<Select>` 组件，options 格式为 `"16:9 · 720P · 5s"` | `MOCK_PARAM_PRESETS` |
| 翻译按钮 | `<Button variant="ghost">`，点击 toggle 状态 | Mock |
| 数量下拉 | shadcn `<Select>` 组件，options: 1-4 | `[1, 2, 3, 4]` |
| 积分余额 | `<span>` 展示 `used/total` | `MOCK_POINTS_BALANCE` |
| 生成按钮 | `<Button>` 带向上箭头图标，点击 toast 提示"生成功能开发中" | Mock 交互 |

---

## 5. 数据模型

### 5.1 模型能力配置（`constants/videoModelCapabilities.ts`）

该文件定义模型 → 子模型 → 支持模式的映射关系。**这是一个领域配置，在 Mock 和真实阶段都共用**。

#### 核心类型定义

```typescript
// ==================== 模式定义 ====================

export type VideoModeKey =
  | "text-to-video"      // 文生视频：纯文本生成，无参考图
  | "all-reference"      // 全能参考：同时支持图片/视频/音频参考
  | "image-to-video"     // 图生视频：以单张或多张图片为参考
  | "first-last-frame"   // 首尾帧：仅支持 1-2 张图作为首帧/尾帧
  | "image-reference";   // 图片参考：仅在有参考图时可用

// ==================== 子模型定义 ====================

/**
 * 子模型变体
 * 每个主模型可能包含一个或多个子模型，针对不同任务微调/定制。
 * 用户无感知，仅由系统后台自动调度匹配。
 */
export interface SubVariant {
  /** 子模型标识（系统内部使用，不展示给用户） */
  id: string;
  /** 此子模型支持的模式列表 */
  supportedModes: VideoModeKey[];
  /** 此子模式的默认参数覆盖（可选） */
  defaultParams?: Record<string, unknown>;
}

// ==================== 主模型定义 ====================

/**
 * 主模型（用户可见）
 */
export interface MainModelConfig {
  /** 主模型标识 */
  id: string;
  /** UI 显示名称 */
  label: string;
  /** 此主模型包含的所有子模型变体 */
  variants: SubVariant[];
}

// ==================== 模式标签 ====================

export const MODE_LABELS: Record<VideoModeKey, string> = {
  "text-to-video": "文生视频",
  "all-reference": "全能参考",
  "image-to-video": "图生视频",
  "first-last-frame": "首尾帧",
  "image-reference": "图片参考",
};

// ==================== 参考图数量约束 ====================

export interface ModeReferenceConstraint {
  /** 最小参考图数量（含），undefined 表示无下限 */
  minRefCount?: number;
  /** 最大参考图数量（含），undefined 表示无上限 */
  maxRefCount?: number;
  /** 依赖其他类型的参考（视频/音频），仅全能参考需要 */
  requiresAnyReference?: boolean;
}

/** 各模式对参考图数量的约束规则 */
export const MODE_REFERENCE_CONSTRAINTS: Record<VideoModeKey, ModeReferenceConstraint> = {
  "text-to-video":      { maxRefCount: 0 },                                    // 必须无参考图
  "all-reference":      { requiresAnyReference: true },                        // 至少有一个参考（任意类型）
  "image-to-video":     { minRefCount: 1 },                                    // 至少一张图
  "first-last-frame":   { minRefCount: 1, maxRefCount: 2 },                    // 1-2 张
  "image-reference":    { minRefCount: 1 },                                    // 至少一张图
};
```

#### Mock 模型配置数据

```typescript
/**
 * 主模型配置列表（Mock 数据，后续替换为真实 API 返回）
 *
 * 设计原则：
 * - 用户只看到主模型（如 "Wan2.7"、"Seedance 2.0 VIP"）
 * - 每个主模型包含一个或多个子模型变体，针对不同任务微调
 * - 子模型完全对用户隐藏，由系统自动根据当前模式调度
 */
export const MOCK_MAIN_MODELS: MainModelConfig[] = [
  {
    id: "seedance-vip",
    label: "Seedance 2.0 VIP",
    variants: [
      {
        id: "seedance-vip-fast",
        supportedModes: ["text-to-video", "all-reference", "image-to-video", "image-reference"],
      },
      {
        id: "seedance-vip-pro",
        supportedModes: ["text-to-video", "all-reference", "image-to-video", "first-last-frame", "image-reference"],
      },
    ],
  },
  {
    id: "seedance-fast",
    label: "Seedance 2.0 Fast",
    variants: [
      {
        id: "seedance-fast-base",
        supportedModes: ["text-to-video", "all-reference", "image-to-video", "image-reference"],
      },
    ],
  },
  {
    id: "seedance-pro",
    label: "Seedance 2.0 Pro",
    variants: [
      {
        id: "seedance-pro-base",
        supportedModes: ["text-to-video", "all-reference", "image-to-video", "first-last-frame", "image-reference"],
      },
    ],
  },
  {
    id: "wan2.7",
    label: "Wan2.7",
    variants: [
      {
        id: "wan2.7-t2v",
        supportedModes: ["image-to-video"],                              // 仅支持图生视频
      },
      {
        id: "wan2.7-i2v",
        supportedModes: ["first-last-frame", "image-to-video"],          // 基于首帧/首尾帧图像或视频片段
      },
      {
        id: "wan2.7-r2v",
        supportedModes: ["all-reference", "image-to-video", "image-reference"],  // 参考生视频
      },
    ],
  },
  {
    id: "pixverse",
    label: "PixVerse",
    variants: [
      {
        id: "pixverse-i2v",
        supportedModes: ["image-to-video"],
      },
    ],
  },
];
```

#### 模式可用性推导逻辑

```
输入: selectedMainModel, referenceCount
  │
  ├── 步骤 1: 查 MOCK_MAIN_MODELS 找到 selectedMainModel
  │
  ├── 步骤 2: 收集该主模型下所有子模型的 supportedModes 的并集
  │           得到 modelSupportedModes = Set<VideoModeKey>
  │
  ├── 步骤 3: 对每个 VideoModeKey，检查 MODE_REFERENCE_CONSTRAINTS
  │           与当前 referenceCount 是否匹配
  │
  └── 步骤 4: 生成 ModeState[]
                enabled = (在 modelSupportedModes 中) && (满足约束)
                disabledReason = 不满足原因
```

### 5.2 Mock 数据（`constants/mockData.ts`）

纯 UI 展示数据：

```typescript
// 模型选项（仅主模型，用于下拉选择器）
export interface ModelOption {
  value: string;   // 对应 MainModelConfig.id
  label: string;
}

export const MOCK_MODELS: ModelOption[] = MOCK_MAIN_MODELS.map((m) => ({
  value: m.id,
  label: m.label,
}));

// 参考图 URL（占位图）
export const MOCK_REFERENCE_IMAGES: string[] = [
  "https://picsum.photos/seed/ref1/200/200",
  "https://picsum.photos/seed/ref2/200/200",
  "https://picsum.photos/seed/ref3/200/200",
];

// 参数预设
export interface ParamPreset {
  value: string;
  label: string;      // 显示格式: "16:9 · 720P · 5s"
  aspectRatio: string;
  resolution: string;
  duration: number;
}

export const MOCK_PARAM_PRESETS: ParamPreset[] = [
  { value: "16:9-720p-5s", label: "16:9 · 720P · 5s", aspectRatio: "16:9", resolution: "720P", duration: 5 },
  { value: "16:9-720p-10s", label: "16:9 · 720P · 10s", aspectRatio: "16:9", resolution: "720P", duration: 10 },
  { value: "16:9-1080p-5s", label: "16:9 · 1080P · 5s", aspectRatio: "16:9", resolution: "1080P", duration: 5 },
  { value: "9:16-720p-5s", label: "9:16 · 720P · 5s", aspectRatio: "9:16", resolution: "720P", duration: 5 },
  { value: "1:1-720p-5s", label: "1:1 · 720P · 5s", aspectRatio: "1:1", resolution: "720P", duration: 5 },
];

// @提及候选项（与旧 VideoMentionItem 接口一致，确保 Tiptap Mention 插件兼容）
export interface MentionItem {
  id: string;
  label: string;
  value: string;
  thumbnail: string;   // 缩略图 URL
  type: "image" | "video" | "audio";
}

export const MOCK_MENTION_ITEMS: MentionItem[] = [
  { id: "mock-img-1", label: "素材1", value: "素材1", thumbnail: "https://picsum.photos/seed/ref1/60/60", type: "image" },
  { id: "mock-vid-1", label: "素材2", value: "素材2", thumbnail: "https://picsum.photos/seed/ref2/60/60", type: "video" },
  { id: "mock-aud-1", label: "素材3", value: "素材3", thumbnail: "", type: "audio" },
];

// 积分余额
export const MOCK_POINTS_BALANCE = { used: 108, total: 135 };

// 数量选项
export const MOCK_COUNT_OPTIONS = [1, 2, 3, 4];
```

> **设计决策**：模型能力配置（`videoModelCapabilities.ts`）与 Mock 数据（`mockData.ts`）分离。前者定义领域结构和推导逻辑，在真实阶段直接复用；后者只存纯 UI 展示数据，真实阶段替换为 API 返回值。

---

## 6. Hooks

### 6.1 `useModeAvailability` — 模式可用性计算 Hook

**职责**：根据当前选中的主模型和参考图数量，计算每个模式的启用/禁用状态及原因。

**接口签名**：

```typescript
export interface UseModeAvailabilityResult {
  /** 所有模式的状态（5 个模式，每个包含 enabled 和 disabledReason） */
  modeStates: ModeState[];
  /** 当前模型支持的子模型列表（系统内部使用，后续阶段用于自动调度） */
  activeVariants: SubVariant[];
}

export function useModeAvailability(params: {
  selectedModelId: string;    // 当前选中的主模型 ID
  referenceCount: number;     // 当前参考图数量（纯图片）
  hasAnyReference?: boolean;  // 是否有任意类型参考（视频/音频等）
}): UseModeAvailabilityResult;
```

**实现逻辑**：

```typescript
function computeModeStates(
  modelId: string,
  referenceCount: number,
  hasAnyReference: boolean,
): ModeState[] {
  // 1. 查找主模型配置
  const modelConfig = MOCK_MAIN_MODELS.find((m) => m.id === modelId);

  // 2. 收集所有子模型支持的模式并集
  const modelSupportedModes = new Set<VideoModeKey>();
  modelConfig?.variants.forEach((v) => {
    v.supportedModes.forEach((m) => modelSupportedModes.add(m));
  });

  // 3. 对每个模式计算启用/禁用
  const allModeKeys: VideoModeKey[] = [
    "text-to-video",
    "all-reference",
    "image-to-video",
    "first-last-frame",
    "image-reference",
  ];

  return allModeKeys.map((key) => {
    // 原因列表，按优先级取首个显示
    const reasons: string[] = [];

    // 原因 A: 模型不支持
    if (!modelSupportedModes.has(key)) {
      const modelLabel = modelConfig?.label ?? modelId;
      reasons.push(`当前【${modelLabel}】模型不支持「${MODE_LABELS[key]}」模式`);
    }

    // 原因 B: 参考图数量不符合约束
    const constraint = MODE_REFERENCE_CONSTRAINTS[key];
    if (constraint) {
      if (constraint.maxRefCount === 0 && referenceCount > 0) {
        reasons.push(`「${MODE_LABELS[key]}」不支持上传参考图`);
      }
      if (constraint.minRefCount !== undefined && referenceCount < constraint.minRefCount) {
        reasons.push(`「${MODE_LABELS[key]}」需要至少 ${constraint.minRefCount} 张参考图`);
      }
      if (constraint.maxRefCount !== undefined && referenceCount > constraint.maxRefCount) {
        reasons.push(`参考图超过 ${constraint.maxRefCount} 张时不可用`);
      }
      if (constraint.requiresAnyReference && !hasAnyReference && referenceCount === 0) {
        reasons.push(`「${MODE_LABELS[key]}」需要至少一个参考素材`);
      }
    }

    return {
      key,
      label: MODE_LABELS[key],
      enabled: reasons.length === 0,
      disabledReason: reasons.length > 0 ? reasons[0] : undefined,
    };
  });
}
```

**禁用原因优先级**：模型不支持 > 参考图数量不符合约束。当模型不支持时，只需显示模型不支持原因，不叠加参考图约束原因（因为参考图约束在模型不支持的前提下无意义）。

**设计决策**：
- `useModeAvailability` 只读不写，不管理任何副作用，确保纯计算逻辑可测试
- `ModeToggleBar` 的 `onModeChange` 回调应检查目标模式是否 `enabled`，禁用时忽略点击
- 当用户切换模型时，如果当前选中的模式变为禁用，应在 `VideoPromptPanel` 层面自动切换到第一个可用的模式

---

## 7. @dnd-kit 拖拽实现方案

### 7.1 方案选择

使用 `@dnd-kit/sortable`（`SortableContext` + `useSortable`），而不是低级的 `useDraggable`/`useDroppable`，原因：

| 对比项 | `useSortable` | `useDraggable` + `useDroppable` |
|--------|---------------|----------------------------------|
| 自动排序动画 | ✅ 内置 | ❌ 需手写 |
| 拖拽过渡 | ✅ `CSS.Transform.toString` | ✅ 同等 |
| 同级排序场景 | ✅ 专为同级排序设计 | ❌ 更适合跨容器拖拽 |
| 代码复杂度 | 低 | 高 |

### 7.2 实现要点

```tsx
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// 每个可排序项
const SortableThumbnail = ({ url, index }: { url: string; index: number }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ThumbnailPreviewPopover src={url} index={index}>
        <img src={url} />
      </ThumbnailPreviewPopover>
    </div>
  );
};

// 容器
const DndContextWrapper = ({ images }: { images: string[] }) => {
  const [items, setItems] = useState(images);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.indexOf(active.id as string);
      const newIndex = items.indexOf(over.id as string);
      setItems(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((url, i) => (
          <SortableThumbnail key={url} url={url} index={i + 1} />
        ))}
      </SortableContext>
    </DndContext>
  );
};
```

> **注意**：水平排列的缩略图使用 `verticalListSortingStrategy` 结合 flex 布局实现横向拖拽，或使用自定义 strategy。

---

## 8. 节点注册流水线

### 8.1 类型系统

在 `src/shared/types/flow/index.ts` 中新增：

```typescript
export interface NewVideoGenerationNode {
  model: string;
  prompt: string;
  promptDraft?: string;
  duration?: number;
  aspect_ratio: string;
  image_urls?: string[];
  status?: GenerationStatus;
  progress?: number;
  result?: {
    type: string;
    data: Array<{ url: string }>;
  };
  metadata: Record<string, unknown>;
}

export type NewVideoNodeType = Node<NewVideoGenerationNode, "newVideoNode">;
```

在 `AllNodeType` 联合类型中追加 `NewVideoNodeType`。

### 8.2 NodeType 标识

在 `src/shared/types/zustand/canvas-flow.ts` 的 `NodeType` 中新增 `"newVideo"`。

### 8.3 节点工厂

在 `src/shared/utils/nodeFactory.ts` 中新增：

```typescript
export const createNewVideoNode = (id, position, options): AllNodeType => ({
  id,
  type: "newVideoNode",
  position,
  width: 350,
  height: 250,
  data: {
    model: "seedance-vip",
    prompt: "",
    promptDraft: "",
    duration: 5,
    aspect_ratio: "16:9",
    nickname: "新版视频",
    status: GenerationStatus.COMPLETED,
    progress: 0,
    metadata: {},
    result: { type: "video", data: [] },
    createdAt: Date.now(),
  },
});

// nodeFactoryMap 新增
newVideo: createNewVideoNode,
```

### 8.4 ReactFlow 节点注册

在 `src/renderer/pages/Canvas/constants/canvasConfig.ts` 中：

```typescript
import { NewVideoNode } from "../CustomNodes/New-VideoNode";

export const nodeTypes = {
  // ... 现有节点 ...
  newVideoNode: NewVideoNode,  // 新增
};
```

### 8.5 菜单入口

在 `CanvasContextMenu.tsx` 中新增菜单项：

```tsx
<ContextMenuItem onSelect={() => onCreateNode("newVideo")}>
  <IconVideo size={16} />
  新建视频节点(新版)
</ContextMenuItem>
```

在 `CanvasSidebar.tsx` 中新增 `case "create-newVideo"`。

---

## 9. 状态管理（Mock 阶段）

### 9.1 组件内部状态

所有交互状态使用 React `useState` 管理，不涉及 Store：

| 状态 | 所属组件 | 类型 | 说明 |
|------|---------|------|------|
| `activeMode` | `ModeToggleBar` | `string` | 当前选中模式 |
| `images` | `ReferenceThumbnails` | `string[]` | 排序后的图片顺序 |
| `promptText` | `PromptEditor`(父组件) | `string` | 编辑器纯文本内容（通过 onChange 回调获取） |
| `selectedModel` | `BottomParamsBar` | `string` | 选中模型 |
| `selectedParam` | `BottomParamsBar` | `string` | 选中参数预设 |
| `selectedCount` | `BottomParamsBar` | `number` | 选中数量 |
| `translateEnabled` | `BottomParamsBar` | `boolean` | 翻译开关 |

### 9.2 与旧 Store 的隔离

Mock 阶段**不**：
- 不调用 `useCanvasFlowStore`
- 不调用 `updateVideoNodeData`
- 不调用 `startVideoGeneration`
- 不修改任何 `"videoNode"` 类型的 Store 逻辑

---

## 10. 错误处理与边界情况

| 边界 | 处理方式 |
|------|---------|
| 图片加载失败 | 缩略图区域展示 fallback 占位图标（同旧 `VideoReferenceAssetsBar` 中的 `VideoThumbnailButton`） |
| 拖拽到列表之外 | `DragEndEvent.over` 为 null 时不做任何操作 |
| `@` 输入但没有匹配候选项 | 显示"无匹配素材"提示 |
| 选择数量超过内置选项 | 限制在 1-4 范围内 |
| 多个新节点同时选中 | 底部面板仅最后一个选中的节点显示（与旧节点行为一致） |

---

## 11. 测试策略

Mock 阶段主要依靠手动验证和视觉审查：

| 测试项 | 方法 |
|--------|------|
| 节点能否正常创建 | 右键菜单 → 新节点出现 |
| Handle 连线 | 从新节点拖出连线到其他节点 |
| 模式切换 | 点击各模式按钮，视觉反馈正确 |
| 参考图拖拽 | 拖拽缩略图换位，数字角标更新 |
| 悬停预览 | 鼠标悬停缩略图，大图浮窗出现并正确关闭 |
| @提及 | 输入 @ 触发 Mention 候选项列表，键盘导航选择，确认后插入 mention pill |
| 参数选择 | 下拉选择器正常工作 |
| 生成按钮 | 点击后无报错 |
| 节点选中/取消 | 紫色高亮和底部面板显隐正确 |
| 新旧共存 | 在同一个画布中同时有新旧节点，互不干扰 |
