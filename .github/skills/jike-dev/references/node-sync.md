# 节点元信息同步规范

## 触发场景

当用户说以下内容时触发：

- 同步到项目目录
- 存储到项目
- 保存节点
- save to project

## 目标文件

```text
{projectPath}/.jike/nodes-meta.json
```

`projectPath` 应以当前项目或用户指定项目为准，不使用旧记忆中的硬编码路径。

## 数据结构

```json
{
  "version": "1.0",
  "lastSync": "2026-04-12T19:07:00.000Z",
  "nodes": {
    "image": {
      "nodeId": "image",
      "nodeType": "image",
      "category": "primary",
      "displayName": "图片",
      "createdAt": "2026-04-12T19:07:00.000Z",
      "updatedAt": "2026-04-12T19:07:00.000Z",
      "status": "completed",
      "files": {
        "component": "src/renderer/pages/Canvas/CustomNodes/ImageNode/index.tsx"
      },
      "description": "图片节点，支持上传和处理图片"
    }
  }
}
```

## 字段说明

| 字段 | 说明 |
| --- | --- |
| `nodeId` | 节点 ID，如 `image`、`video`、`audio` |
| `nodeType` | 创建节点时使用的类型 |
| `category` | 分组，如 `primary`、`assistant`、`efficiency-tools` |
| `displayName` | 中文显示名称 |
| `status` | `draft` 或 `completed` |
| `files` | 组件、hook、utils、注册文件等相对路径 |
| `description` | 节点用途描述 |
| `createdAt` / `updatedAt` | 创建和更新时间 |

## 同步流程

1. 读取现有 `nodes-meta.json`，保留未知字段和用户手写内容。
2. 搜索当前 `nodeTypes`、菜单、store 和组件目录，汇总已注册节点。
3. 对缺失节点追加记录，对已有节点更新 `updatedAt`、`files`、`displayName` 等可推导字段。
4. 如果会覆盖已有字段或删除节点记录，必须先询问用户。
5. 写入 JSON 时保持可读缩进。
