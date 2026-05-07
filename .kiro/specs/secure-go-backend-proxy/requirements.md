# Secure Go Backend Proxy Requirements

## Introduction

当前 Jike Electron 桌面端存在在前端或客户端侧直接存储第三方 API Key、OSS AccessKey Secret、AI 供应商 Token 等敏感信息的风险。由于 Electron 客户端构建产物、运行环境、环境变量、网络请求和本地资源均可能被逆向分析，必须将第三方服务凭证、签名逻辑、AI 服务调用和视频异步任务处理迁移至独立 Go 后端服务。迁移后，Electron 客户端仅通过基础 App Token 调用后端接口，所有第三方服务请求由后端完成鉴权、签名、转发、日志、错误脱敏和任务状态管理。

## User Stories

### User Story 1: 客户端敏感凭证迁移

As a Jike Electron 桌面端维护者, I want 所有第三方 API Key、OSS AccessKey Secret、AI Token 从客户端迁移到 Go 后端, so that Electron 构建产物和用户本地环境不再暴露敏感凭证。

#### Acceptance Criteria

1. WHEN Electron 客户端需要调用第三方 AI、OSS 或视频任务能力 THEN the system SHALL 仅调用 Go 后端服务接口，而不直接请求第三方服务接口。
2. WHEN Electron 客户端构建或运行 THEN the system SHALL NOT 在前端源码、构建产物、环境变量、配置文件、本地缓存或请求参数中存储第三方 API Key、OSS AccessKey Secret、AI 供应商 Token。
3. WHEN 后端调用第三方服务 THEN the system SHALL 从后端安全配置中读取所需凭证，并在服务端完成鉴权、签名和请求组装。
4. IF 客户端请求包含疑似第三方密钥字段 THEN the system SHALL 拒绝处理该请求并记录脱敏后的安全日志。
5. WHEN 开发人员配置服务 THEN the system SHALL 将第三方凭证限定在后端运行环境或后端配置系统中管理，不向 Electron 客户端下发。

### User Story 2: App Token 身份验证

As a 后端服务维护者, I want 使用基础 App Token 验证 Electron 客户端请求, so that 仅授权的桌面端实例可以访问后端中转能力。

#### Acceptance Criteria

1. WHEN Electron 客户端调用 Go 后端任意受保护接口 THEN the system SHALL 要求请求携带 App Token。
2. IF 请求未携带 App Token THEN the system SHALL 返回未认证错误，并且错误响应不得暴露后端配置、密钥名称或内部实现细节。
3. IF 请求携带无效 App Token THEN the system SHALL 拒绝请求、记录脱敏安全日志，并纳入异常统计。
4. WHEN App Token 校验通过 THEN the system SHALL 继续执行对应业务逻辑。
5. WHEN 后端记录认证相关日志 THEN the system SHALL 对 Token 进行脱敏处理，不记录完整 Token 明文。

### User Story 3: 第三方 API 对接管理

As a Electron 客户端开发者, I want 通过统一 Go 后端接口访问第三方 API, so that 客户端无需理解不同供应商鉴权细节并避免敏感信息泄露。

#### Acceptance Criteria

1. WHEN 客户端请求第三方 API 能力 THEN the system SHALL 通过统一后端入口接收请求并根据业务类型路由到对应服务处理逻辑。
2. WHEN 后端向第三方 API 发起请求 THEN the system SHALL 在服务端完成身份验证、请求签名、Header 注入和必要参数补全。
3. IF 第三方 API 返回错误 THEN the system SHALL 将错误转换为统一错误结构，并对第三方原始响应中的敏感字段进行脱敏。
4. WHEN 第三方 API 调用完成 THEN the system SHALL 记录操作日志，包括请求时间、平台、接口类型、耗时、状态码、任务标识和脱敏后的错误摘要。
5. IF 第三方平台不可用或超时 THEN the system SHALL 返回可识别的上游服务错误，并避免将内部堆栈或凭证信息返回给客户端。

### User Story 4: OSS 文件存储签名生成

As a Electron 桌面端用户, I want 客户端通过后端获取 OSS 上传或访问授权, so that 文件存储操作无需在客户端保存 OSS AccessKey Secret。

#### Acceptance Criteria

1. WHEN 客户端需要上传文件到 OSS THEN the system SHALL 向 Go 后端请求上传授权或签名，而不是在客户端生成 OSS 签名。
2. WHEN 后端生成 OSS 授权 THEN the system SHALL 使用后端保存的 OSS 凭证完成签名并限制授权范围、有效期和目标路径。
3. IF 客户端请求的 OSS 路径或文件类型不符合后端规则 THEN the system SHALL 拒绝生成签名并返回脱敏错误。
4. WHEN OSS 签名返回客户端 THEN the system SHALL 仅返回完成当前上传或访问所需的最小授权信息。
5. WHEN OSS 授权生成失败 THEN the system SHALL 记录脱敏日志并返回统一错误结构。

### User Story 5: 视频异步任务处理

As a Electron 桌面端用户, I want 视频处理任务由 Go 后端异步管理, so that 长耗时任务可以可靠执行、查询和恢复。

#### Acceptance Criteria

1. WHEN 客户端提交视频处理任务 THEN the system SHALL 创建后端任务记录并返回唯一任务 ID。
2. WHEN 视频任务执行中 THEN the system SHALL 支持客户端通过任务 ID 查询任务状态、进度、结果摘要和脱敏错误信息。
3. WHEN 视频任务状态变化 THEN the system SHALL 按照明确状态流转管理任务，包括 pending、running、succeeded、failed、canceled。
4. IF 视频任务执行失败 THEN the system SHALL 保存失败原因摘要、错误分类、重试状态和可恢复信息，且不得暴露敏感凭证或内部堆栈。
5. IF 后端服务重启 THEN the system SHALL 能够识别未完成任务并按配置执行恢复、标记失败或重新调度策略。
6. WHEN 客户端重复提交可识别的同一任务 THEN the system SHALL 支持幂等处理或返回已有任务状态，避免重复创建不可控任务。

### User Story 6: AI Chat 代理服务

As a Electron 桌面端用户, I want AI Chat 请求通过 Go 后端代理, so that 聊天能力可以继续使用且客户端不保存 AI 供应商 Token。

#### Acceptance Criteria

1. WHEN 客户端发起 AI Chat 请求 THEN the system SHALL 将请求发送至 Go 后端 AI Chat 代理接口。
2. WHEN 后端处理 AI Chat 请求 THEN the system SHALL 根据后端配置选择对应供应商凭证并完成服务端鉴权。
3. IF AI Chat 支持流式响应 THEN the system SHALL 支持向 Electron 客户端转发流式响应，并在异常中断时返回可识别的错误事件。
4. IF AI Chat 上游返回敏感错误信息 THEN the system SHALL 对错误内容进行脱敏后再返回客户端。
5. WHEN AI Chat 请求完成 THEN the system SHALL 记录脱敏操作日志，包括平台、模型、耗时、状态和错误摘要。

### User Story 7: 图片和视频生成平台路由

As a Electron 桌面端开发者, I want 图片或视频生成请求额外携带 platform 参数, so that Go 后端可以按平台透传请求到正确的第三方 API 地址。

#### Acceptance Criteria

1. WHEN 用户调用模型生成图片或视频 THEN the system SHALL 在现有请求参数基础上额外传递 `platform` 参数到 Go 后端。
2. WHEN 后端收到 `platform` 为 `kuaizi` 的请求 THEN the system SHALL 将请求透传路由至 `https://aiopenapi.kuaizi.cn/ai-open-platform-api`。
3. WHEN 后端收到 `platform` 为 `dashscope` 的请求 THEN the system SHALL 将请求透传路由至 `https://dashscope.aliyuncs.com`。
4. WHEN 后端收到 `platform` 为 `toapi` 的请求 THEN the system SHALL 将请求透传路由至 `https://dashscope.aliyuncs.com`。
5. WHEN 后端收到 `platform` 为 `zeakai` 的请求 THEN the system SHALL 将请求透传路由至 `https://zeakai-api.api4midjourney.com`。
6. WHEN 后端收到 `platform` 为 `yunwu` 的请求 THEN the system SHALL 将请求透传路由至 `https://yunwu.ai`。
7. IF `platform` 缺失或不属于允许值 THEN the system SHALL 拒绝请求并返回统一参数错误。
8. WHEN 后端透传图片或视频生成请求 THEN the system SHALL 保留客户端现有业务参数，并在服务端注入对应平台所需的鉴权、签名或 Header。
9. WHEN 后端返回平台响应 THEN the system SHALL 将第三方响应中不安全或敏感字段脱敏后返回客户端。

### User Story 8: 错误信息脱敏和操作日志

As a 运维或开发排查人员, I want 后端记录详细但安全的操作日志, so that 可以排查问题且不会泄露敏感信息。

#### Acceptance Criteria

1. WHEN 后端处理任意客户端请求 THEN the system SHALL 记录请求开始、结束、耗时、平台、接口类型、任务 ID、状态和错误摘要。
2. WHEN 日志中包含 Token、API Key、Secret、签名、Authorization Header 或疑似敏感字段 THEN the system SHALL 对字段值进行脱敏处理。
3. WHEN 后端返回错误给 Electron 客户端 THEN the system SHALL 使用统一错误结构，并避免暴露内部堆栈、配置路径、环境变量、密钥名称和第三方完整原始错误。
4. IF 出现后端内部异常 THEN the system SHALL 记录可供服务端排查的脱敏错误详情，并向客户端返回通用内部错误。
5. WHEN 操作日志用于任务排查 THEN the system SHALL 能够通过任务 ID 或请求 ID 关联同一次业务流程。

### User Story 9: 服务稳定性和可维护性

As a 后端服务维护者, I want Go 后端具备清晰结构、健康检查和可靠恢复能力, so that 服务可以稳定支撑 Electron 桌面端功能迁移。

#### Acceptance Criteria

1. WHEN 后端服务启动 THEN the system SHALL 校验必要配置项是否存在，并对缺失或非法配置给出脱敏启动错误。
2. WHEN 监控系统或运维人员检查服务状态 THEN the system SHALL 提供健康检查接口用于识别服务是否可用。
3. IF 上游服务请求超时 THEN the system SHALL 按配置执行超时控制、错误分类和安全响应。
4. IF 可恢复的上游错误发生 THEN the system SHALL 支持按配置执行有限重试，并避免重复执行不可幂等操作。
5. WHEN 后续新增第三方平台 THEN the system SHALL 能够在清晰的模块边界内扩展平台路由、凭证配置、请求适配和错误处理。
6. WHEN 开发人员维护代码 THEN the system SHALL 具备清晰的目录结构、配置说明和接口说明，便于扩展和排查。

### User Story 10: Electron 客户端调用迁移

As a Electron 桌面端开发者, I want 现有客户端调用统一迁移到 Go 后端, so that 用户功能保持可用且敏感服务交互不再发生在客户端。

#### Acceptance Criteria

1. WHEN Electron 客户端执行原第三方 AI、OSS、视频任务或 AI Chat 操作 THEN the system SHALL 使用 Go 后端接口替代原第三方直连逻辑。
2. WHEN 客户端发送请求到 Go 后端 THEN the system SHALL 仅携带业务参数、App Token、platform 和必要上下文，不携带第三方服务凭证。
3. IF 后端返回统一错误结构 THEN the system SHALL 在客户端以现有用户体验可接受的方式展示错误信息。
4. WHEN 客户端配置服务地址 THEN the system SHALL 支持配置 Go 后端基础地址，但不得通过该配置携带第三方密钥。
5. WHEN 迁移完成 THEN the system SHALL 删除或停用客户端侧第三方代理、签名、密钥读取和直连上游服务的实现。
