import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Theme, ToastViewport } from "silver-ui";
import "silver-ui/styles.css";
import { App } from "./App.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Theme>
      <App />
      <ToastViewport position="bottomEnd" />
    </Theme>
  </StrictMode>,
);
