import ToastContainer from "@/components/ui/toastContainer";
import AppRouter from "@/router";
import { useUserStore } from "@/stores/useUserStore";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import { getJikeingToken } from "shared/utils/utils";

function App() {
  const fetchUserInfo = useUserStore((state) => state.fetchUserInfo);

  useEffect(() => {
    const token = getJikeingToken();
    if (token) {
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
