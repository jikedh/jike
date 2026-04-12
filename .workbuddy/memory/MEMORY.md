# MEMORY.md - 跨会话记忆

## 项目信息

- **项目路径**: `e:\code\jiketool\jike\`
- **项目名称**: 即刻（Jike）- 视频工作流工具
- **技术栈**: React 19 + TypeScript + Electron + @xyflow/react + Zustand + Tailwind CSS v4

## 用户偏好

- **中文界面**: 用户使用中文交流
- **生成前确认**: 新增节点前必须展示计划，确认后才执行
- **数据同步**: 需要将节点元信息同步到项目路径的 `.jike/nodes-meta.json`

## Skill 优化记录

### 2026-04-12 - 优化 jikeskill-dev

1. **P1 开发新节点：方案对比 + 生成前确认**
   - 先分析需求，对比 2-3 个方案让用户选
   - 用户选择后再展示详细生成计划
   - 用户点击"是"才执行生成
   - 其他任务（P0/P2/P3/P4）跳过方案对比

2. **P4 同步存储技能**
   - 触发词：同步到项目目录、存储到项目、保存节点
   - 同步文件：`{projectPath}/.jike/nodes-meta.json`
   - 目的：保持草稿数据不丢失，记录节点开发进度

3. **同步内容**
   - nodeId、nodeType、category、displayName
   - status（draft/completed）
   - files（组件路径）
   - createdAt/updatedAt

## 项目存储结构

```
{storagePath}/                          # 默认 Documents/jike-projects
└── {projectName}/
    ├── canvas.json                    # Canvas 数据
    ├── image/                         # 用户上传图片
    ├── video/                         # 用户上传视频
    ├── audio/                         # 用户上传音频
    ├── generate_image/                # AI 生成图片
    └── generate_video/                 # AI 生成视频
```
