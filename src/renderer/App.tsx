import ToastContainer from "@/components/ui/toastContainer";
import { UpdateManager } from "@/components/UpdateManager";
import AppRouter from "@/router";
import { useUserStore } from "@/stores/useUserStore";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import { getJikeingToken } from "shared/utils/utils";

function App() {
  const fetchUserInfo = useUserStore((state) => state.fetchUserInfo);
  const fetchInternalAccess = useUserStore(
    (state) => state.fetchInternalAccess,
  );

  useEffect(() => {
    const token = getJikeingToken();
    if (token) {
      fetchUserInfo();
      fetchInternalAccess();
    }
  }, [fetchInternalAccess, fetchUserInfo]);

  return (
    <>
      <AppRouter />
      <UpdateManager />
      <ToastContainer />
    </>
  );
}

export default App;
