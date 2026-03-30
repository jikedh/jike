import AppRouter from '@/router'
import ToastContainer from '@/components/ui/toastContainer'
import '@xyflow/react/dist/style.css';

function App() {
  return (
    <>
      <AppRouter />
      <ToastContainer />
    </>
  )
}

export default App