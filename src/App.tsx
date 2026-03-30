import AppRouter from '@/router'
import ToastContainer from '@/components/ui/toastContainer'
// 注意：@xyflow/react/dist/style.css 已在 index.css 中通过 @import 引入，此处移除重复导入

function App() {
  return (
    <>
      <AppRouter />
      <ToastContainer />
    </>
  )
}

export default App