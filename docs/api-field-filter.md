# API 字段过滤器使用指南

## 概述

API 字段过滤器是一个自动化的工具，用于过滤前端发送给后端的请求参数，确保只传递后端需要的字段。这可以防止前端不小心传递多余的字段给后端，提高 API 调用的安全性和规范性。

## 工作原理

1. **自动过滤**：在 axios 请求拦截器中自动应用字段过滤
2. **白名单机制**：每个 API 端点都有一个允许的字段白名单
3. **路径匹配**：支持精确路径匹配和路径参数匹配（如 `/v1/images/generations/{id}`）

## 配置文件

### 1. 端点配置 (`src/constants/apiEndpoints.ts`)

所有 API 端点的字段白名单都在这个文件中定义：

```typescript
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: {
    path: '/v1/chat/completions',
    method: 'POST',
    allowedFields: [
      'model',
      'messages',
      'temperature',
      'top_p',
      // ... 其他字段
    ],
  },
  // ... 其他端点
}
```

### 2. 过滤器实现 (`src/utils/apiFieldFilter.ts`)

过滤器的核心逻辑：

```typescript
export const filterRequestData = (url: string, data: any): any => {
  // 1. 匹配端点配置
  // 2. 根据白名单过滤字段
  // 3. 返回过滤后的数据
}
```

### 3. 自动应用 (`src/utils/aiRequest.ts`)

在 axios 请求拦截器中自动应用过滤：

```typescript
service.interceptors.request.use(
  (reqConfig) => {
    // ... 其他逻辑

    // 过滤请求数据，移除后端不需要的字段
    if (reqConfig.data && reqConfig.url) {
      reqConfig.data = filterRequestData(reqConfig.url, reqConfig.data)
    }

    return reqConfig
  },
  (error) => Promise.reject(error)
)
```

## 如何添加新的 API 端点

### 步骤 1：在端点配置中添加新端点

编辑 `src/constants/apiEndpoints.ts`：

```typescript
export const API_ENDPOINTS = {
  // ... 现有端点

  // 新增端点
  NEW_ENDPOINT: {
    path: '/v1/new/endpoint',
    method: 'POST',
    allowedFields: [
      'field1',
      'field2',
      'field3',
    ],
  },
}
```

### 步骤 2：更新端点映射

在同一个文件中，将新端点添加到 `ENDPOINT_MAP`：

```typescript
export const ENDPOINT_MAP: Record<string, { method: string; allowedFields: string[] }> = {
  // ... 现有映射

  [API_ENDPOINTS.NEW_ENDPOINT.path]: {
    method: API_ENDPOINTS.NEW_ENDPOINT.method,
    allowedFields: [...API_ENDPOINTS.NEW_ENDPOINT.allowedFields],
  },
}
```

## 如何调试字段过滤

### 1. 查看允许的字段

```typescript
import { getAllowedFields } from '@/utils/apiFieldFilter'

// 获取特定端点的允许字段
const fields = getAllowedFields('/v1/chat/completions')
console.log('允许的字段:', fields)
```

### 2. 手动测试过滤

```typescript
import { filterRequestData } from '@/utils/apiFieldFilter'

const testData = {
  model: 'gpt-4',
  messages: [],
  extraField: 'should be removed',
}

const filtered = filterRequestData('/v1/chat/completions', testData)
console.log('过滤后的数据:', filtered)
```

### 3. 查看控制台警告

如果请求的端点没有在配置中定义，过滤器会在控制台输出警告：

```javascript
console.warn(`未找到 API 端点 "${url}" 的字段配置，将传递所有字段`)
```

## 注意事项

1. **GET 请求**：GET 请求通常没有请求体，过滤器会返回空对象
2. **FormData 请求**：文件上传等使用 FormData 的请求不需要字段过滤
3. **未配置的端点**：如果端点没有在配置中定义，过滤器会返回原始数据（并输出警告）
4. **路径参数**：支持路径参数匹配，如 `/v1/images/generations/{id}` 会匹配 `/v1/images/generations/123`

## 最佳实践

1. **及时更新配置**：添加新的 API 端点时，及时更新字段白名单配置
2. **定期审查**：定期检查控制台警告，确保所有端点都有正确的配置
3. **文档维护**：保持端点配置的文档更新，方便团队成员查阅
4. **测试覆盖**：为新的端点配置编写测试用例，确保过滤逻辑正确

## 故障排除

### 问题：字段被错误过滤

**解决方案**：
1. 检查端点路径是否正确
2. 确认字段是否在白名单中
3. 查看控制台是否有警告信息

### 问题：未配置的端点警告

**解决方案**：
1. 在 `src/constants/apiEndpoints.ts` 中添加端点配置
2. 如果确实需要传递所有字段，可以暂时忽略警告（但不推荐）

### 问题：路径参数不匹配

**解决方案**：
1. 确保配置中的路径参数格式正确：`{paramName}`
2. 检查实际请求路径是否与配置匹配
