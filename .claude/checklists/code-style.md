# 代码规范检查清单

## TypeScript 规范

- [ ] 使用 `interface` 定义对象结构
- [ ] 使用 `type` 定义联合类型/别名
- [ ] 避免使用 `any`，优先使用具体类型
- [ ] 所有接口必须有 JSDoc 注释
- [ ] 使用双引号

```typescript
// ✅ 正确
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "blue" | "ghost";
  loading?: boolean;
}

// ❌ 错误
interface Props { ... }
const data: any = ...
```

## React 组件规范

- [ ] 使用 `React.memo` 包裹所有组件
- [ ] 使用 `useCallback` 包装回调函数
- [ ] 使用 `useMemo` 缓存计算结果
- [ ] 组件使用 PascalCase
- [ ] 函数使用 camelCase

```typescript
// ✅ 正确
const ImageContent = React.memo(function ImageContent({ data }) {
  return <div>{data.prompt}</div>;
});

// ❌ 错误
function imageContent(props) { ... }
```

## Biome 规范

- [ ] 缩进：2 空格
- [ ] 双引号
- [ ] 无未使用的 import（error 级别）
- [ ] 禁止 console.log（允许 error/warn）

## 文件命名

- [ ] 组件文件：PascalCase，如 `ImageNode.tsx`
- [ ] 工具文件：kebab-case，如 `use-video-url.ts`
- [ ] Store 文件：`useXxxStore.ts` 或 `xxxStore.ts`
