import { useEffect } from "react";
import AppRouter from "@/router";
import ToastContainer from "@/components/ui/toastContainer";
import { useUserStore } from "@/store/useUserStore";
// import { getJikeingToken } from "shared/utils/utils";
import "@xyflow/react/dist/style.css";
import { getJikeingToken } from "shared/utils/utils";
// import { getJikeingToken } from "shared/utils/utils";

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
