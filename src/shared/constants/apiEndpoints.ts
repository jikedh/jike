// /**
//  * API 端点配置
//  * 定义每个 API 端点允许的请求字段
//  */

// // API 端点字段白名单配置
// export const API_ENDPOINTS = {
//   // 账户余额相关
//   BALANCE: {
//     path: '/v1/balance',
//     method: 'GET',
//     allowedFields: [],
//   },

//   // 图片生成相关
//   IMAGE_GENERATIONS: {
//     path: '/v1/images/generations',
//     method: 'POST',
//     allowedFields: [
//       'model',
//       'prompt',
//       'n',
//       'size',
//       'quality',
//       'style',
//       'response_format',
//       'user',
//     ],
//   },
//   IMAGE_GENERATIONS_STATUS: {
//     path: '/v1/images/generations/{id}',
//     method: 'GET',
//     allowedFields: [],
//   },

//   // 视频生成相关
//   VIDEO_GENERATIONS: {
//     path: '/v1/videos/generations',
//     method: 'POST',
//     allowedFields: [
//       'model',
//       'prompt',
//       'n',
//       'size',
//       'duration',
//       'fps',
//       'style',
//       'response_format',
//       'user',
//     ],
//   },
//   VIDEO_GENERATIONS_STATUS: {
//     path: '/v1/videos/generations/{id}',
//     method: 'GET',
//     allowedFields: [],
//   },

//   // 聊天相关
//   CHAT_COMPLETIONS: {
//     path: '/v1/chat/completions',
//     method: 'POST',
//     allowedFields: [
//       'model',
//       'messages',
//       'temperature',
//       'top_p',
//       'n',
//       'stream',
//       'stop',
//       'max_tokens',
//       'presence_penalty',
//       'frequency_penalty',
//       'logit_bias',
//       'user',
//       'functions',
//       'function_call',
//       'tools',
//       'tool_choice',
//     ],
//   },
//   MESSAGES: {
//     path: '/v1/messages',
//     method: 'POST',
//     allowedFields: [
//       'model',
//       'messages',
//       'max_tokens',
//       'metadata',
//       'stop_sequences',
//       'stream',
//       'system',
//       'temperature',
//       'top_k',
//       'top_p',
//     ],
//   },

//   // 文件上传相关
//   UPLOAD_IMAGE: {
//     path: '/v1/uploads/images',
//     method: 'POST',
//     allowedFields: [], // FormData，不需要过滤
//   },

//   // Midjourney 相关
//   MJ_SUBMIT_IMAGINE: {
//     path: '/mj/submit/imagine',
//     method: 'POST',
//     allowedFields: [
//       'prompt',
//       'bot_type',
//       'account_id',
//     ],
//   },
//   MJ_TASK_FETCH: {
//     path: '/mj/task/{id}/fetch',
//     method: 'GET',
//     allowedFields: [],
//   },
// } as const

// // 端点路径到配置的映射
// export const ENDPOINT_MAP: Record<string, { method: string; allowedFields: string[] }> = {
//   [API_ENDPOINTS.BALANCE.path]: {
//     method: API_ENDPOINTS.BALANCE.method,
//     allowedFields: [...API_ENDPOINTS.BALANCE.allowedFields],
//   },
//   [API_ENDPOINTS.IMAGE_GENERATIONS.path]: {
//     method: API_ENDPOINTS.IMAGE_GENERATIONS.method,
//     allowedFields: [...API_ENDPOINTS.IMAGE_GENERATIONS.allowedFields],
//   },
//   [API_ENDPOINTS.IMAGE_GENERATIONS_STATUS.path]: {
//     method: API_ENDPOINTS.IMAGE_GENERATIONS_STATUS.method,
//     allowedFields: [...API_ENDPOINTS.IMAGE_GENERATIONS_STATUS.allowedFields],
//   },
//   [API_ENDPOINTS.VIDEO_GENERATIONS.path]: {
//     method: API_ENDPOINTS.VIDEO_GENERATIONS.method,
//     allowedFields: [...API_ENDPOINTS.VIDEO_GENERATIONS.allowedFields],
//   },
//   [API_ENDPOINTS.VIDEO_GENERATIONS_STATUS.path]: {
//     method: API_ENDPOINTS.VIDEO_GENERATIONS_STATUS.method,
//     allowedFields: [...API_ENDPOINTS.VIDEO_GENERATIONS_STATUS.allowedFields],
//   },
//   [API_ENDPOINTS.CHAT_COMPLETIONS.path]: {
//     method: API_ENDPOINTS.CHAT_COMPLETIONS.method,
//     allowedFields: [...API_ENDPOINTS.CHAT_COMPLETIONS.allowedFields],
//   },
//   [API_ENDPOINTS.MESSAGES.path]: {
//     method: API_ENDPOINTS.MESSAGES.method,
//     allowedFields: [...API_ENDPOINTS.MESSAGES.allowedFields],
//   },
//   [API_ENDPOINTS.UPLOAD_IMAGE.path]: {
//     method: API_ENDPOINTS.UPLOAD_IMAGE.method,
//     allowedFields: [...API_ENDPOINTS.UPLOAD_IMAGE.allowedFields],
//   },
//   [API_ENDPOINTS.MJ_SUBMIT_IMAGINE.path]: {
//     method: API_ENDPOINTS.MJ_SUBMIT_IMAGINE.method,
//     allowedFields: [...API_ENDPOINTS.MJ_SUBMIT_IMAGINE.allowedFields],
//   },
//   [API_ENDPOINTS.MJ_TASK_FETCH.path]: {
//     method: API_ENDPOINTS.MJ_TASK_FETCH.method,
//     allowedFields: [...API_ENDPOINTS.MJ_TASK_FETCH.allowedFields],
//   },
// }
