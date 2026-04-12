# P0 - 快速检查提示词

## 触发词
检查、review、审查、review code、review this

## 任务
对用户提供的代码或项目进行快速检查，发现潜在问题。

## 检查清单

### 代码规范检查
- [ ] 文件命名是否符合规范（PascalCase/kebab-case）
- [ ] 是否有未使用的 import（Biome 会报错）
- [ ] 组件是否使用 `React.memo`
- [ ] 回调函数是否使用 `useCallback`
- [ ] 是否有 `console.log`（应使用 `console.error/warn`）
- [ ] 是否使用 `any` 类型（应避免）
- [ ] 接口是否有 JSDoc 注释

### UI 规范检查
- [ ] 是否使用 Tailwind 类名而非内联 style
- [ ] 颜色值是否使用主题色 `#B43FEB`
- [ ] 背景色是否使用 `#121214` 或透明
- [ ] 边框是否使用 `border-white/10`
- [ ] 是否使用 `cn()` 合并类名

### 命名检查
- [ ] 组件名是否 PascalCase
- [ ] 工具函数名是否 camelCase
- [ ] 节点类型 ID 是否符合 `xxxNode` 格式

## 输出格式

```markdown
## 🔍 代码审查报告

### ✅ 通过项
- xxx

### ⚠️ 需修改项
| 文件 | 问题 | 建议修改 |
|------|------|---------|
| xxx | xxx | xxx |

### 📝 代码片段（修改建议）
```tsx
// 修改前
xxx
// 修改后
xxx
```
```

## 注意事项
- 只做检查，不要直接修改代码
- 如果用户要求修改，再执行修改
- 复杂问题建议拆分多次检查
