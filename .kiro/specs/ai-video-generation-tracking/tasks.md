# AI 视频生成埋点记录系统 - 实现任务

## 任务清单

### 1. 数据库相关

- [ ] 1.1 创建 `SQL/ai_video_track_logs.sql` 表结构
  - 需求: DB-001, DB-002

### 2. 后端实体层

- [ ] 2.1 创建 `src/main/java/com/jike/jjs/entity/VideoTrackEntity.java` 实体类
  - 需求: DB-001, BE-002
- [ ] 2.2 创建 `src/main/java/com/jike/jjs/dto/VideoTrackDTO.java` 数据传输对象
  - 需求: BE-002, BE-003
- [ ] 2.3 创建 `src/main/java/com/jike/jjs/mapper/VideoTrackMapper.java` Mapper 接口
  - 需求: DB-001
- [ ] 2.4 创建 `src/main/resources/mapper/VideoTrackMapper.xml` MyBatis XML
  - 需求: DB-001

### 3. 后端服务层

- [ ] 3.1 创建 `src/main/java/com/jike/jjs/config/AsyncConfig.java` 异步线程池配置
  - 需求: BE-003
- [ ] 3.2 创建 `src/main/java/com/jike/jjs/service/VideoTrackService.java` 埋点业务服务
  - 需求: BE-003, BE-004

### 4. 后端拦截器

- [ ] 4.1 创建 `src/main/java/com/jike/jjs/interceptor/VideoTrackInterceptor.java` 拦截器
  - 需求: BE-001, BE-002
- [ ] 4.2 修改 `src/main/java/com/jike/jjs/config/WebMvcConfig.java` 注册拦截器
  - 需求: BE-001

### 5. IPC 通道 (Electron 主进程)

- [ ] 5.1 创建 `src/main/ipc/handler/tracking.ts` IPC 处理器
  - 需求: FE-001, FE-002
- [ ] 5.2 修改 `src/main/ipc/index.ts` 注册 tracking 通道
  - 需求: FE-001, FE-002

### 6. Preload 暴露

- [ ] 6.1 修改 `src/preload/index.ts` 暴露 tracking API
  - 需求: FE-002

### 7. 前端埋点服务

- [ ] 7.1 创建 `src/renderer/services/aiVideoTracking.ts` 埋点采集服务
  - 需求: FE-001, FE-002, FE-003, FE-004

### 8. 前端 API 集成

- [ ] 8.1 修改 `src/renderer/api/aiRequest.ts` 集成埋点调用
  - 需求: FE-001, FE-004
