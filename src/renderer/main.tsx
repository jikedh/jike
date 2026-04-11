import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// tset
createRoot(document.getElementById("root")!).render(
  // <StrictMode>
  <App />,
  // {/* </StrictMode>, */}
);
