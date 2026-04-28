# AI 视频生成埋点记录系统 - 需求文档

## 1. 用户故事

**作为** 平台运营者
**我想要** 记录用户调用 AI 视频生成模型的行为数据
**以便** 追溯用户在什么时间点调用了什么 AI 模型进行视频生成

## 2. 功能需求

### 2.1 前端埋点采集

| 需求编号 | 需求描述 | 验收条件 |
|---------|---------|---------|
| FE-001 | 视频生成功能模块集成埋点数据采集 | 每次调用视频生成 API 时自动触发埋点 |
| FE-002 | 自动附加用户标识信息 | 用户 ID 和 Token 必须附加到每个埋点请求中 |
| FE-003 | 调用参数前端验证 | 对 model、prompt 等必填参数进行格式校验 |
| FE-004 | 埋点数据与业务请求一致性 | 埋点中的 taskId 必须与实际 API 返回的 taskId 一致 |

### 2.2 后端埋点记录

| 需求编号 | 需求描述 | 验收条件 |
|---------|---------|---------|
| BE-001 | 视频生成 API 添加埋点拦截器 | 仅针对 `/sorotask/v1/*` 路径实施拦截 |
| BE-002 | 捕获埋点关键信息 | 在 API 入口处捕获 userId、timestamp、model、taskId |
| BE-003 | 异步写入埋点数据 | 使用异步线程池写入，不阻塞主业务请求 |
| BE-004 | 异常处理不影响核心业务 | 埋点记录异常不应导致 API 请求失败 |

### 2.3 数据库设计

| 需求编号 | 需求描述 | 验收条件 |
|---------|---------|---------|
| DB-001 | 创建埋点记录表 | 包含用户标识、调用时间（精确到毫秒）、模型信息等必填字段 |
| DB-002 | 索引优化 | 支持按 userId 和 createTime 高效查询 |

## 3. 数据模型

### 3.1 埋点记录表 (ai_video_track_logs)

| 字段名 | 类型 | 必填 | 说明 |
|-------|------|-----|------|
| id | BIGINT | 是 | 主键，雪花ID |
| user_id | VARCHAR(64) | 是 | 用户标识 |
| user_uuid | VARCHAR(64) | 否 | 用户UUID |
| api_name | VARCHAR(256) | 是 | API 名称 |
| model | VARCHAR(128) | 是 | 模型名称（如 sora-2, veo3-pro） |
| model_version | VARCHAR(64) | 否 | 模型版本 |
| task_id | VARCHAR(128) | 是 | 任务ID（上游返回） |
| prompt | TEXT | 否 | 视频描述提示词 |
| provider | VARCHAR(64) | 否 | 服务提供商（dashscope/kuaizi 等） |
| request_params | TEXT | 否 | 请求参数 JSON |
| response_task_id | VARCHAR(128) | 否 | 响应返回的 task_id |
| status | VARCHAR(32) | 是 | 状态：SUCCESS/FAIL/PENDING |
| error_message | TEXT | 否 | 错误信息 |
| create_time | BIGINT | 是 | 创建时间（毫秒时间戳） |

### 3.2 索引设计

- PRIMARY KEY (`id`)
- INDEX `idx_user_id` (`user_id`)
- INDEX `idx_create_time` (`create_time`)
- INDEX `idx_task_id` (`task_id`)

## 4. 接口规范

### 4.1 埋点数据格式

```json
{
  "userId": "123456",
  "userUuid": "uuid-xxx",
  "apiName": "/api/v1/services/aigc/video-generation/video-synthesis",
  "model": "sora-2",
  "taskId": "task-xxx-123",
  "prompt": "一个奔跑的马",
  "provider": "dashscope",
  "requestParams": {},
  "status": "PENDING",
  "timestamp": 1714304000000
}
```

### 4.2 埋点 API 端点

- **端点**: `POST /sorotask/v1/track`
- **内容类型**: `application/json`
- **请求头**: 需要 `x-token` 进行用户认证

## 5. 技术约束

- 前端仅针对视频生成相关 API 实施埋点
- 埋点记录必须异步处理，不影响主流程性能
- 埋点系统异常不能影响核心业务功能
- 数据库采用 MySQL，使用 MyBatis-Plus

## 6. 成功标准

1. 能够清晰追溯：什么用户在什么时间调用了什么 AI 模型
2. 埋点数据完整、准确记录到数据库
3. 埋点记录不影响视频生成 API 的响应时间
4. 埋点系统故障不影响核心业务运行
