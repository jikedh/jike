# 团队管理与积分接口文档

本文档说明前端 [teams.ts](../src/renderer/api/teams.ts) 封装的团队管理与积分接口。

## 基础约定

- **服务地址**：`VITE_JIKE_GO_BASE_URL`
- **接口前缀**：`/v1/team`
- **认证方式**：统一请求实例自动携带登录令牌；所有接口要求登录。
- **响应结构**：

```ts
{
  code: number;
  msg?: string;
  data: T;
}
```

- **分页参数**：`page` 默认 `1`，`pageSize` 默认 `20`，最大 `100`。
- **标识字段**：`teamId`、`userId`、`invitationId`、`operationId` 可能为字符串或数字，前端统一使用 `TeamId`。

## 权限说明

| 角色 | 可执行操作 |
| --- | --- |
| Owner | 团队管理、成员移除、创建/查看团队邀请、积分分配、查看所有当前有效成员的消费记录 |
| Member | 查看团队、成员列表、积分摘要与积分流水；可主动退出团队、处理本人邀请 |

---

## 一、团队管理

### 1. 获取当前用户团队列表

- **方法**：`getTeamList(params?)`
- **请求**：`GET /v1/team`
- **参数**：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | number | 否 | 页码 |
| pageSize | number | 否 | 每页数量 |

- **响应数据**：`{ list: TeamInfo[]; total; page; pageSize }`

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "list": [
      {
        "id": "2080121057768230912",
        "name": "视频创作团队",
        "description": "用于协作制作视频",
        "createdBy": "2063944232192495616",
        "currentRole": "OWNER",
        "createdAt": 1784707200,
        "updatedAt": 1784707200
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

`data.list` 内每个团队对象字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TeamId | 团队 ID |
| name | string | 团队名称 |
| description | string | 团队描述，未填写时为空字符串 |
| createdBy | TeamId | 团队创建者用户 ID |
| currentRole | `OWNER` / `MEMBER` | 当前登录用户在该团队中的角色 |
| createdAt | number | 团队创建时间，Unix 秒级时间戳 |
| updatedAt | number | 团队最后更新时间，Unix 秒级时间戳 |

分页字段说明：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| list | TeamInfo[] | 当前页团队列表 |
| total | number | 满足查询条件的团队总数 |
| page | number | 当前页码 |
| pageSize | number | 当前页每页数量 |

### 2. 创建团队

- **方法**：`createTeam(data)`
- **请求**：`POST /v1/team`

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 是 | 团队名称，1～128 字符 |
| description | string | 否 | 团队描述，最长 1024 字符 |

- **响应数据**：`TeamInfo`
- 创建成功后，当前用户自动成为团队 `OWNER`。

**请求示例：**

```json
{
  "name": "视频创作团队",
  "description": "用于协作制作视频"
}
```

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "id": "2080121057768230912",
    "name": "视频创作团队",
    "description": "用于协作制作视频",
    "createdBy": "2063944232192495616",
    "currentRole": "OWNER",
    "createdAt": 1784707200,
    "updatedAt": 1784707200
  }
}
```

### 3. 获取团队详情

- **方法**：`getTeamDetail(teamId)`
- **请求**：`GET /v1/team/:teamId`
- **权限**：当前有效团队成员。
- **响应数据**：`TeamInfo`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 要查询的团队 ID |

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "id": "2080121057768230912",
    "name": "视频创作团队",
    "description": "用于协作制作视频",
    "createdBy": "2063944232192495616",
    "currentRole": "MEMBER",
    "createdAt": 1784707200,
    "updatedAt": 1784707200
  }
}
```

### 4. 更新团队

- **方法**：`updateTeam(teamId, data)`
- **请求**：`PUT /v1/team/:teamId`
- **权限**：Owner。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | 否 | 新团队名称 |
| description | string | 否 | 新团队描述，可传空字符串清空 |

- 请求体至少传入 `name` 或 `description` 之一。
- **响应数据**：更新后的 `TeamInfo`。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 要更新的团队 ID |

**请求示例：**

```json
{
  "name": "视频创作团队（修订版）",
  "description": "更新后的团队说明"
}
```

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "id": "2080121057768230912",
    "name": "视频创作团队（修订版）",
    "description": "更新后的团队说明",
    "createdBy": "2063944232192495616",
    "currentRole": "OWNER",
    "createdAt": 1784707200,
    "updatedAt": 1784710800
  }
}
```

---

## 二、团队成员

### 1. 获取当前有效成员

- **方法**：`getTeamMembers(teamId)`
- **请求**：`GET /v1/team/:teamId/members`
- **权限**：当前有效团队成员。
- **响应数据**：`{ list: TeamMember[]; currentRole }`
- Owner 排在成员列表首位。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "currentRole": "OWNER",
    "list": [
      {
        "id": "2080125355155640320",
        "userId": "2063944232192495616",
        "nickname": "团队创建者",
        "avatar": "https://example.com/avatar.png",
        "role": "OWNER",
        "joinedAt": 1784707200
      }
    ]
  }
}
```

`TeamMember` 字段：

| 字段 | 说明 |
| --- | --- |
| id | 团队成员关系 ID |
| userId | 用户 ID |
| nickname / avatar | 用户展示信息 |
| role | `OWNER` 或 `MEMBER` |
| joinedAt | 加入时间戳（秒） |

响应根数据字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| currentRole | `OWNER` / `MEMBER` | 当前登录用户在该团队中的角色 |
| list | TeamMember[] | 当前处于 `ACTIVE` 状态的成员列表 |

### 2. 主动退出团队

- **方法**：`leaveTeam(teamId)`
- **请求**：`POST /v1/team/:teamId/leave`
- **权限**：Member。
- **响应数据**：`{ completed: boolean }`
- Owner 不能通过此接口退出团队。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 要退出的团队 ID |

**请求体：**空对象 `{}`。

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "completed": true
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| completed | boolean | `true` 表示成员状态已变更为 `LEFT` |

### 3. 移除团队成员

- **方法**：`removeTeamMember(teamId, userId)`
- **请求**：`DELETE /v1/team/:teamId/members/:userId`
- **权限**：Owner。
- **响应数据**：`{ completed: boolean }`
- Owner 不能移除自身。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |
| userId | TeamId | 是 | 要移除的成员用户 ID |

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "completed": true
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| completed | boolean | `true` 表示成员状态已变更为 `REMOVED` |

---

## 三、团队邀请

### 1. 创建团队邀请

- **方法**：`createTeamInvitation(teamId, data)`
- **请求**：`POST /v1/team/:teamId/invitations`
- **权限**：Owner。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| inviteeUserId | TeamId | 是 | 受邀用户 ID |

- **响应数据**：新建的 `TeamInvitation`；若已有待处理邀请，可能返回 `{ message, invitation }`。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

**请求示例：**

```json
{
  "inviteeUserId": "2067087089279180800"
}
```

**新建邀请响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "id": "2080175131045982208",
    "teamId": "2080121057768230912",
    "teamName": "视频创作团队",
    "inviteeUserId": "2067087089279180800",
    "inviteeNickname": "受邀成员",
    "inviteeAvatar": "",
    "inviterUserId": "2063944232192495616",
    "inviterNickname": "团队创建者",
    "inviterAvatar": "",
    "status": "PENDING",
    "createdAt": 1784707200
  }
}
```

**重复待处理邀请响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "message": "此用户已经收到了你的邀请，不用重复邀请",
    "invitation": {
      "id": "2080175131045982208",
      "status": "PENDING"
    }
  }
}
```

### 2. 查询指定团队邀请

- **方法**：`getTeamInvitations(teamId, params?)`
- **请求**：`GET /v1/team/:teamId/invitations`
- **权限**：Owner。
- **响应数据**：`{ list: TeamInvitation[]; total; page; pageSize }`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

**查询参数：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20，最大 100 |

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "list": [
      {
        "id": "2080175131045982208",
        "teamId": "2080121057768230912",
        "teamName": "视频创作团队",
        "inviteeUserId": "2067087089279180800",
        "inviteeNickname": "受邀成员",
        "inviteeAvatar": "",
        "inviterUserId": "2063944232192495616",
        "inviterNickname": "团队创建者",
        "inviterAvatar": "",
        "status": "PENDING",
        "createdAt": 1784707200
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### 3. 查询当前用户收到的邀请

- **方法**：`getMyTeamInvitations(params?)`
- **请求**：`GET /v1/team/invitations`
- **响应数据**：`{ list: TeamInvitation[]; total; page; pageSize }`

**查询参数：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20，最大 100 |

**完整响应字段：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| list | TeamInvitation[] | 当前用户作为受邀人的邀请列表 |
| total | number | 邀请总数 |
| page | number | 当前页码 |
| pageSize | number | 当前页每页数量 |

`TeamInvitation` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TeamId | 邀请 ID |
| teamId | TeamId | 所属团队 ID |
| teamName | string | 团队名称 |
| inviteeUserId | TeamId | 受邀用户 ID |
| inviteeNickname | string | 受邀用户昵称 |
| inviteeAvatar | string | 受邀用户头像地址 |
| inviterUserId | TeamId | 邀请人用户 ID |
| inviterNickname | string | 邀请人昵称 |
| inviterAvatar | string | 邀请人头像地址 |
| status | `PENDING` / `ACCEPTED` / `REJECTED` | 邀请处理状态 |
| createdAt | number | 创建时间，Unix 秒级时间戳 |
| respondedAt | number | 响应时间，未处理时字段缺省 |

### 4. 接受团队邀请

- **方法**：`acceptTeamInvitation(invitationId)`
- **请求**：`POST /v1/team/invitations/:invitationId/accept`
- **权限**：受邀用户本人。
- **响应数据**：`{ invitationId; status: "ACCEPTED"; memberId }`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| invitationId | TeamId | 是 | 要接受的待处理邀请 ID |

**请求体：**空对象 `{}`。

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "invitationId": "2080175131045982208",
    "status": "ACCEPTED",
    "memberId": "2080176546027991040"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| invitationId | TeamId | 已处理的邀请 ID |
| status | `ACCEPTED` | 接受成功后的状态 |
| memberId | TeamId | 新建或重新激活的团队成员关系 ID |

### 5. 拒绝团队邀请

- **方法**：`rejectTeamInvitation(invitationId)`
- **请求**：`POST /v1/team/invitations/:invitationId/reject`
- **权限**：受邀用户本人。
- **响应数据**：`{ invitationId; status: "REJECTED" }`

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| invitationId | TeamId | 是 | 要拒绝的待处理邀请 ID |

**请求体：**空对象 `{}`。

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "invitationId": "2080175131045982208",
    "status": "REJECTED"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| invitationId | TeamId | 已处理的邀请 ID |
| status | `REJECTED` | 拒绝成功后的状态 |

---

## 四、团队积分

### 1. 获取团队积分摘要

- **方法**：`getTeamCreditSummary(teamId)`
- **请求**：`GET /v1/team/:teamId/credits/summary`
- **权限**：当前有效团队成员。

| 响应字段 | 说明 |
| --- | --- |
| allocatablePersonalCredits | 当前用户可分配的个人积分总额；仅 Owner 有值 |
| teamTotalAllocatedCredits | 团队历史累计分配积分 |
| currentVipScore | 当前用户会员积分余额 |
| currentForScore | 当前用户永久积分余额 |
| currentRole | 当前用户团队角色 |

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "allocatablePersonalCredits": 300,
    "teamTotalAllocatedCredits": 100,
    "currentVipScore": 200,
    "currentForScore": 100,
    "currentRole": "OWNER"
  }
}
```

### 2. 获取团队积分审计流水

- **方法**：`getTeamCreditLedgers(teamId, params?)`
- **请求**：`GET /v1/team/:teamId/credits/ledgers`
- **权限**：当前有效团队成员。
- **响应数据**：`{ list: TeamCreditLedger[]; total; page; pageSize }`
- **排序**：按 `createdAt`、`id` 倒序。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

**查询参数：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20，最大 100 |

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "list": [
      {
        "id": "2080176550251655168",
        "memberId": "2080176546027991040",
        "memberUserId": "2067087089279180800",
        "memberNickname": "团队成员",
        "memberAvatar": "",
        "operatorUserId": "2063944232192495616",
        "operatorNickname": "团队创建者",
        "type": "ALLOCATE",
        "amount": 100,
        "bizType": "team_allocate",
        "bizId": "2080176546027991040",
        "createdAt": 1784707200
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

`TeamCreditLedger` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | TeamId | 团队积分流水 ID |
| memberId | TeamId | 接收积分或关联消费的团队成员关系 ID |
| memberUserId | TeamId | 关联成员用户 ID |
| memberNickname | string | 关联成员昵称 |
| memberAvatar | string | 关联成员头像地址 |
| operatorUserId | TeamId | 操作人用户 ID；系统迁移等场景可能缺省 |
| operatorNickname | string | 操作人昵称 |
| type | TeamCreditLedgerType | 流水类型 |
| amount | number | 本次流水积分数量 |
| bizType | string | 业务类型，例如 `team_allocate` |
| bizId | string | 关联业务 ID，例如积分操作 ID |
| createdAt | number | 流水创建时间，Unix 秒级时间戳 |

`type` 可能值：

| 值 | 说明 |
| --- | --- |
| ALLOCATE | Owner 向成员分配积分 |
| RECLAIM | 历史回收类型，当前业务已不支持回收 |
| TASK_CONSUME | 预留的团队任务消费类型 |
| TASK_CONSUME_REVERSAL | 预留的团队任务消费冲正类型 |
| ACCOUNT_MIGRATION | 历史团队账户余额迁移至个人积分 |

### 3. 向团队成员分配积分

- **方法**：`allocateTeamCredits(teamId, data)`
- **请求**：`POST /v1/team/:teamId/credits/allocate`
- **权限**：Owner。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberUserId | TeamId | 是 | 当前有效成员的用户 ID，可为 Owner 本人 |
| amount | number | 是 | 分配数量，必须大于 0 |
| requestKey | string | 是 | 幂等键，建议每次提交使用唯一值，最长 96 字符 |

- **业务规则**：
  - 从 Owner 个人积分中扣减，优先扣减 `vip_score`，不足时再扣减 `for_score`。
  - 分配金额写入目标成员个人 `vip_score`。
  - 分配后的积分属于成员个人资产，不支持回收。
- **响应数据**：`{ completed; operationId; message }`
- 以相同 `requestKey` 重试不会重复扣减积分。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

**请求示例：**

```json
{
  "memberUserId": "2067087089279180800",
  "amount": 100,
  "requestKey": "allocate-1784707200000"
}
```

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "completed": true,
    "operationId": "2080176546027991040",
    "message": "积分分配完成"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| completed | boolean | `true` 表示 Owner 扣减、成员入账及团队审计流水均已完成 |
| operationId | TeamId | 可用于追踪本次跨服务积分操作的唯一 ID |
| message | string | 当前操作的结果说明 |

### 4. 查询团队成员积分消费明细

- **方法**：`getTeamConsumptionRecords(teamId, params?)`
- **请求**：`GET /v1/team/:teamId/credits/consumption-records`
- **权限**：Owner。
- **查询范围**：当前 `ACTIVE` 成员（包括 Owner）的全部历史 `CONSUME` 个人消费流水。

**路径参数：**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| teamId | TeamId | 是 | 团队 ID |

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| page | number | 否 | 页码，默认 1 |
| pageSize | number | 否 | 每页数量，默认 20，最大 100 |
| memberUserId | TeamId | 否 | 按成员用户 ID 过滤 |
| bizType | string | 否 | 按业务类型过滤 |
| source | string | 否 | 按消费来源过滤 |
| model | string | 否 | 按模型名称过滤 |
| startTime | number | 否 | 开始时间，Unix 秒级时间戳 |
| endTime | number | 否 | 结束时间，Unix 秒级时间戳 |

- **响应数据**：

```ts
{
  list: TeamConsumptionRecord[];
  total: number;
  page: number;
  pageSize: number;
  pageTotalVipScore: number;
  pageTotalForScore: number;
  allTotalVipScore: number;
  allTotalForScore: number;
}
```

其中：

- `vipScore`、`forScore`：单条记录消耗的会员/永久积分。
- `vipBalanceScore`、`forBalanceScore`：消费后的对应余额。
- `pageTotalVipScore`、`pageTotalForScore`：当前页记录的消费汇总。
- `allTotalVipScore`、`allTotalForScore`：当前筛选条件下全部记录的消费汇总。

**完整响应示例：**

```json
{
  "code": 200,
  "msg": "",
  "data": {
    "list": [
      {
        "recordId": 12345,
        "userId": "2067087089279180800",
        "nickname": "团队成员",
        "avatar": "",
        "memberId": "2080176546027991040",
        "memberStatus": "ACTIVE",
        "vipScore": 10,
        "forScore": 0,
        "vipBalanceScore": 90,
        "forBalanceScore": 13633,
        "source": "desktop_proxy",
        "sourceLabel": "桌面端代理",
        "model": "midjourney",
        "bizType": "desktop_video",
        "bizId": "2080177000000000000",
        "taskId": "task-001",
        "createTime": 1784707200,
        "memo": "视频生成积分消费"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20,
    "pageTotalVipScore": 10,
    "pageTotalForScore": 0,
    "allTotalVipScore": 10,
    "allTotalForScore": 0
  }
}
```

`TeamConsumptionRecord` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| recordId | number | 个人积分消费记录 ID |
| userId | TeamId | 消费用户 ID |
| nickname | string | 消费用户昵称 |
| avatar | string | 消费用户头像地址 |
| memberId | TeamId | 当前团队中的成员关系 ID |
| memberStatus | string | 查询时的成员状态，当前接口固定为 `ACTIVE` |
| vipScore | number | 本条消费扣减的会员积分 |
| forScore | number | 本条消费扣减的永久积分 |
| vipBalanceScore | number | 本次消费后的会员积分余额 |
| forBalanceScore | number | 本次消费后的永久积分余额 |
| source | string | 消费来源标识 |
| sourceLabel | string | 消费来源显示名称 |
| model | string | 消费关联的模型名称 |
| bizType | string | 业务类型 |
| bizId | TeamId | 关联业务 ID，后端无关联业务时可能缺省 |
| taskId | string | 关联任务 ID |
| createTime | number | 消费时间，Unix 秒级时间戳 |
| memo | string | 消费备注 |

响应汇总字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| list | TeamConsumptionRecord[] | 当前页消费记录 |
| total | number | 当前筛选条件下的消费记录总数 |
| page | number | 当前页码 |
| pageSize | number | 当前页每页数量 |
| pageTotalVipScore | number | 当前页会员积分消耗总额 |
| pageTotalForScore | number | 当前页永久积分消耗总额 |
| allTotalVipScore | number | 当前筛选条件下全部记录的会员积分消耗总额 |
| allTotalForScore | number | 当前筛选条件下全部记录的永久积分消耗总额 |

---

## 前端调用示例

```ts
import {
  allocateTeamCredits,
  getTeamConsumptionRecords,
  getTeamCreditLedgers,
} from "@/api/teams";

const teamId = "2080121057768230912";

await allocateTeamCredits(teamId, {
  memberUserId: "2067087089279180800",
  amount: 100,
  requestKey: `allocate-${Date.now()}`,
});

const consumption = await getTeamConsumptionRecords(teamId, {
  page: 1,
  pageSize: 20,
  memberUserId: "2067087089279180800",
  bizType: "desktop_video",
  source: "desktop_proxy",
});

const ledgers = await getTeamCreditLedgers(teamId, {
  page: 1,
  pageSize: 20,
});
```
