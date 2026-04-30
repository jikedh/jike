# 视频节点重构 — 实现任务

---

## 阶段 1：类型系统与节点注册流水线

- [x] 1. 在 `src/shared/types/flow/index.ts` 中新增 `NewVideoGenerationNode` 接口和 `NewVideoNodeType` 类型，在 `AllNodeType` 联合类型中追加 `NewVideoNodeType`
  - 关联需求：US-1.2, US-1.4

- [x] 2. 在 `src/shared/types/zustand/canvas-flow.ts` 的 `NodeType` 联合类型中新增 `"newVideo"`
  - 关联需求：US-1.1

- [x] 3. 在 `src/shared/utils/nodeFactory.ts` 中新增 `createNewVideoNode` 工厂函数，在 `nodeFactoryMap` 中新增 `newVideo: createNewVideoNode`
  - 关联需求：US-1.1

- [x] 4. 在 `src/renderer/pages/Canvas/constants/canvasConfig.ts` 的 `nodeTypes` 中注册 `newVideoNode: NewVideoNode`
  - 关联需求：US-1.2

- [x] 5. 在 `src/renderer/pages/Canvas/components/CanvasContextMenu.tsx` 中新增"新建生成视频节点(新版)"菜单项
  - 关联需求：US-1.1

- [x] 6. 在 `src/renderer/pages/Canvas/components/CanvasFlow.tsx` 的 `handleCreateNodeFromMenu` 中处理 `"newVideo"` 映射
  - 关联需求：US-1.1
  - 注：CanvasNodeType 与 NodeType 为同一联合类型，`"newVideo"` 无需额外映射，透传即可

- [x] 7. 在 `src/renderer/pages/Canvas/components/CanvasSidebar.tsx` 中新增 `case "create-newVideo"` 分支
  - 关联需求：US-1.1

## 阶段 2：节点壳组件（Node Shell）

- [x] 8. 完善 `New-VideoNode/index.tsx` 节点入口组件
  - 关联需求：US-2.1, US-2.2, US-2.3, US-2.4

- [x] 9. 创建 `New-VideoNode/VideoContent.tsx` 节点内容区域组件
  - 关联需求：US-1.4, US-2.1

---

**阶段 2 完成 ✅** — 节点 Shell（选中态高亮、动态尺寸、Handle 显隐、右键菜单）+ VideoContent 占位组件

---

## 阶段 3：模型能力配置与 Hook

- [x] 10. 创建 `New-VideoNode/constants/videoModelCapabilities.ts`
  - 关联需求：US-3.1.1, US-3.1.3, NFR-2.1

- [x] 11. 创建 `New-VideoNode/hooks/useModeAvailability.ts`
  - 关联需求：US-3.1.3, NFR-2.1

---

**阶段 3 完成 ✅** — 模型能力配置 + useModeAvailability Hook

---

## 阶段 4：Mock 数据

- [x] 12. 创建 `New-VideoNode/constants/mockData.ts`
  - 关联需求：NFR-1.1, NFR-1.2, NFR-1.3, NFR-3.2

---

**阶段 4 完成 ✅** — Mock 数据集中定义

---

## 阶段 5：VideoPromptPanel 容器

- [x] 13. 创建 `New-VideoNode/VideoPromptPanel.tsx` 底部面板容器
  - 关联需求：US-3, NFR-3.1
  - 已使用 shadcn/ui 组件替换原生 HTML（Button/Select/Tooltip）

---

**阶段 5 完成 ✅** — VideoPromptPanel 容器（全部使用 shadcn/ui 无头组件库）

---

## 阶段 6：ModeToggleBar 组件

- [x] 14. 创建 `New-VideoNode/components/ModeToggleBar.tsx`
  - 关联需求：US-3.1.1, US-3.1.2, US-3.1.3

---

**阶段 7 完成 ✅** — 参考图缩略图组件（dnd-kit 拖拽排序 + 悬停预览 Popover）

---

## 阶段 8：PromptEditor 组件（Tiptap）

- [x] 17. 创建 `New-VideoNode/components/PromptEditor.tsx`
  - 关联需求：US-3.3.1, US-3.3.2, US-3.3.3
  - 使用 `@tiptap/react` 的 `useEditor` + `EditorContent`
  - Mention 扩展配置：`deleteTriggerWithBackspace: true`
  - 自定义 `renderHTML` 渲染 pill 样式，复用 `.video-node-mention-pill` CSS 类
  - `suggestion` 配置 `char: "@"`，使用 `ReactRenderer` 渲染 `MentionList`
  - 编辑器 `min-h-[80px]`、`max-h-[160px]`，超出滚动
  - 占位文字："描述你想要生成的画面内容，@引用素材"
  - 通过 `onChange` 回调向上传递纯文本

- [x] 18. 创建 `New-VideoNode/components/MentionList.tsx`
  - 关联需求：US-3.3.2
  - `forwardRef` 暴露 `onKeyDown`（↑↓ 移动、Enter 确认）
  - 候选项展示：缩略图 + 名称 + 类型图标
  - 使用 `@floating-ui/dom`（`posToDOMRect` + `computePosition`）定位在光标下方
  - 无匹配时显示"无匹配素材"
  - 选中后 command 回调插入 mention 节点到编辑器

---

**阶段 8 完成 ✅** — PromptEditor（Tiptap）+ MentionList 组件

---

## 阶段 9：BottomParamsBar 组件

- [x] 19. 创建 `New-VideoNode/components/BottomParamsBar.tsx`
  - 关联需求：US-3.4.1, US-3.4.2, US-3.4.3, US-3.4.4, US-3.4.5, US-3.4.6
  - 模型下拉：shadcn `<Select>`，options 来自 `MOCK_MODELS`
  - 参数下拉：options 格式 `"16:9 · 720P · 5s"`
  - 翻译按钮：`<Button variant="ghost">`，点击 toggle
  - 数量下拉：options 1-4
  - 积分余额：展示 `108/135`
  - 生成按钮：播放图标，点击输出"生成功能开发中"

---

**阶段 9 完成 ✅** — BottomParamsBar 独立组件（Select/Button/Shadcn）

---

## 阶段 10：Barrel Export

- [x] 20. 创建 `New-VideoNode/components/index.ts` barrel export 文件
  - 关联需求：NFR-3.1
  - 导出所有组件：`ModeToggleBar`、`ReferenceThumbnails`、`ThumbnailPreviewPopover`、`PromptEditor`、`MentionList`、`BottomParamsBar`

---

**阶段 10 完成 ✅** — Barrel Export

---

## 阶段 11：验证

- [ ] 21. 验证全部 11 个测试用例通过
  - 关联需求：US-1 ~ US-3, NFR-1 ~ NFR-4
  - 新建节点：右键菜单创建新版视频节点成功
  - Handle 连线：从新节点可拖出连线到其他节点
  - 模式切换：5 个按钮正常切换，禁用态正确，Tooltip 显示原因
  - 模型切换联动：切换模型后模式可用性同步更新
  - 参考图拖拽：缩略图排序正常，数字角标更新
  - 悬停预览：大图浮窗出现/关闭，无抖动
  - @提及：输入 @ 触发候选列表，键盘选择，insert pill
  - 参数选择：模型/参数/数量下拉正常
  - 积分余额：正确显示
  - 选中/取消：紫色高亮和面板显隐正确
  - 新旧共存：新旧节点在同一个画布中互不干扰
