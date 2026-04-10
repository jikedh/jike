import { useEffect } from "react";
import AppRouter from "@/router";
import ToastContainer from "@/components/ui/toastContainer";
import { useUserStore } from "@/store/useUserStore";
import { getJikeingToken } from "@/utils/utils";
import "@xyflow/react/dist/style.css";

function App() {
  const fetchUserInfo = useUserStore((state) => state.fetchUserInfo);

  useEffect(() => {
    const token = getJikeingToken();
    if (token) {
      console.log("[App] 检测到已存储的 token，自动获取用户信息");
      fetchUserInfo();
    }
  }, [fetchUserInfo]);

  return (
    <>
      <AppRouter />
      <ToastContainer />
    </>
  );
}

export default App;
