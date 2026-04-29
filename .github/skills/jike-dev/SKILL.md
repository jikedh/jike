---
name: jike-dev
description: "Use when: 即刻/Jike Electron React 项目开发、代码审查、Canvas 节点新增、节点注册、节点元信息同步、性能优化、ReactFlow 记忆化、能力矩阵、重构、bug 修复、UI/Tailwind/命名规范检查。触发词：检查、review、审查、新增节点、新建节点、create node、add node、性能优化、ReactFlow、memo、useMemo、useCallback、capability matrix、能力建模、重构、refactor、bug、报错、不生效、同步到项目目录、保存节点。"
argument-hint: "说明要检查、优化、修复、重构、同步或新增的 Jike 功能/节点"
---

# Jike Dev Skill

面向「即刻（Jike）」Electron + React + TypeScript 视频工作流项目的开发技能。基于 `.claude` 的分级工作流、清单与模板，以及 `.workbuddy` 的跨会话记忆整理而成。

## 适用场景

- P0 快速检查：`检查`、`review`、`审查`、`review code`、`review this`
- P1 标准开发：`新增节点`、`新建节点`、`create node`、`add node`
- P2 深度重构：`重构`、`refactor`、`整理代码`、`优化架构`
- P3 Bug 修复：`bug`、`报错`、`error`、`不生效`、`fix this`
- P4 同步存储：`同步到项目目录`、`存储到项目`、`保存节点`、`save to project`
- P5 性能优化：`性能优化`、`ReactFlow`、`memo`、`useMemo`、`useCallback`、`reflow`、`repaint`、`能力矩阵`、`capability matrix`

## 项目上下文

- 技术栈：React 19 + TypeScript + Electron + `@xyflow/react` + Zustand + Tailwind CSS v4 + Biome。
- 重点区域：`src/main`（Electron 主进程与 IPC）、`src/preload`（Context Bridge）、`src/renderer`（React UI）、`src/shared`（共享类型与工具）。
- 用户偏好：使用中文交流；新增节点前必须先展示方案和生成计划，并等待确认；节点元信息需要可同步到项目目录；Canvas/ReactFlow 优先关注记忆化、稳定依赖、避免回流重绘、OSS 缩略图、能力建模与状态驱动 UI。
- 注意：旧 `.claude` 内容中的路径可作为候选清单，不可盲用；实施前必须搜索并读取当前工作区的真实文件结构。

## 通用执行原则

1. 先读取相关文件和现有实现，再修改代码。
2. 对新节点、重构、批量修改等高影响操作，先给出计划并等待用户确认。
3. 只做用户请求范围内的修改，不顺手扩展功能或大范围重构。
4. 修改后不要自动运行 build、format、lint、test；仅在用户明确要求时执行。
5. UI 与性能变更遵循 [检查清单](./references/checklists.md)；节点开发遵循 [节点开发流程](./references/node-development.md)。

## P0：快速检查流程

1. 确定检查范围：当前文件、用户指定文件、某个组件、某类问题或整个功能。
2. 读取相关代码，按 [检查清单](./references/checklists.md) 检查代码规范、React/ReactFlow 性能规范、UI 规范、命名规范。
3. 只输出问题与建议，不直接修改代码，除非用户明确要求修复。
4. 输出包含：通过项、需修改项、建议修改方式；复杂问题拆分为后续任务。

## P1：新增 Canvas 节点流程

新增节点必须按以下顺序执行：

1. 需求分析：确认节点名称、节点类型 ID、分组、核心功能、输入参数、输出类型。
2. 搜索现有节点实现和注册位置，确认当前项目真实文件路径。
3. 展示 2-3 个实现方案对比，说明复杂度、扩展性、适用场景，并给出推荐方案。
4. 用户选择方案后，展示生成计划：新增文件、修改文件、节点配置、风险点。
5. 等待用户明确确认后再创建或修改代码。
6. 按现有代码风格实现节点组件、类型、store 分支、菜单与注册项。
7. 完成后提示用户可触发 P4 同步节点元信息。

新增涉及模型差异、参数差异或输出差异的节点时，先定义能力矩阵（Capability Matrix），再实现状态驱动 UI，避免在组件中堆叠不可维护的 `if/else`。

节点开发详细清单、方案模板、生成计划模板见 [节点开发流程](./references/node-development.md)。代码骨架参考 [节点模板](./references/node-templates.md)。

## P2：深度重构流程

1. 先定位重构范围和目标：组件拆分、类型整理、store 整理、重复逻辑抽取或架构调整。
2. 读取相关文件，列出当前问题与影响范围。
3. 提供分步骤重构计划，优先小步可回滚改动。
4. 等待用户确认后实施。
5. 避免改变外部行为；必要时说明建议的手动验证方式。

## P3：Bug 修复流程

1. 收集错误信息、复现步骤、预期行为和实际行为；若信息已足够，直接开始定位。
2. 优先检查最近相关代码、状态更新、store selector、异步流程、import 路径、类型错误、IPC 通道一致性。
3. 先定位根因，再做最小修复。
4. 修改完成后说明修复点和建议验证步骤，不自动运行测试或构建。

## P4：节点元信息同步流程

1. 当用户要求“同步到项目目录/保存节点”时触发。
2. 读取当前已注册节点、节点类型、菜单配置和组件文件路径。
3. 生成或更新 `{projectPath}/.jike/nodes-meta.json`，记录节点开发进度。
4. 同步字段与结构见 [节点同步规范](./references/node-sync.md)。
5. 写入前如会覆盖已有手工数据，先提示并确认。

## P5：性能优化流程

1. 优先检查 `<ReactFlow>` 相关 props：对象、数组、配置项、nodeTypes、edgeTypes、viewport、defaultEdgeOptions 等应在组件外定义或使用 `useMemo`。
2. 检查作为 props 传递的函数，尤其是传给 `<ReactFlow>`、节点组件和子组件的回调，应使用 `useCallback`，且依赖数组必须稳定。
3. 如果 `useMemo` 或 `useCallback` 依赖频繁变化的引用（例如未 memo 的函数或临时对象），先稳定依赖，再谈记忆化。
4. 节点组件必须使用 `memo`，并避免订阅过大的 Zustand state。
5. 避免会触发高频 reflow/repaint 的实现；动画和交互优先使用不会导致布局抖动的属性，谨慎使用会造成重绘压力的 `transform` 组合和动态样式。
6. 图片、视频、OSS 资源展示必须优先使用 OSS 缩略图或可控尺寸资源，避免直接加载原图造成 Canvas 卡顿。
7. 对模型能力差异大的功能，先建立能力矩阵，再通过状态驱动 UI 渲染可用能力、禁用态、参数表单和提示文案。

## 完成标准

- 变更范围与用户请求一致。
- 新增节点在类型、注册、菜单、store、组件之间保持一致。
- ReactFlow props、节点组件、传递回调和派生对象具备稳定引用，避免无效记忆化。
- 模型差异通过能力矩阵和状态驱动 UI 管理，不在组件里堆叠失控的 `if/else`。
- OSS 媒体资源展示优先使用缩略图或轻量预览资源。
- UI 符合主题色、Tailwind 和 `cn()` 规范。
- TypeScript 避免不必要的 `any`，无明显未使用 import。
- 已给出用户可执行的验证建议；未在未授权情况下运行构建、格式化、lint 或测试。
