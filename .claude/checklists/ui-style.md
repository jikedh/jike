# UI 规范检查清单

## 主题色

- [ ] 主色：`#B43FEB`（紫色）
- [ ] 背景色：`#121214`（深色背景）或透明
- [ ] 边框色：`border-white/10`
- [ ] 文字色：`text-white/70`（次要）、`text-white`（主要）

## Tailwind CSS

- [ ] 使用 Tailwind 类名，**禁止**混用内联 style
- [ ] 使用 `cn()` 工具函数合并类名
- [ ] 复杂样式集中到 `xxxStyles.ts` 常量对象

```typescript
// ✅ 正确
import { cn } from "shared/utils/utils";

<div className={cn(
  "flex items-center gap-2",
  isActive && "bg-[#B43FEB]/10",
)} />

// ❌ 错误
<div className="flex items-center" style={{ color: "#B43FEB" }} />
```

## 样式优先级

1. Tailwind 类名（首选）
2. `xxxStyles.ts` 常量（复杂样式）
3. CSS 文件（共享样式）
4. 内联 style（仅限动态值）

## 组件样式

- [ ] 圆角：`rounded-xl` 或 `rounded-lg`
- [ ] 阴影：`shadow-lg`
- [ ] 过渡：`transition-all duration-200`
- [ ] 悬停效果：`hover:bg-white/10`

## 按钮样式

使用 `Button` 组件，variant：
- `default`：透明背景，白色文字
- `blue`：紫色背景，主色调
- `ghost`：完全透明
