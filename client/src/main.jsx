import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./app/App.jsx";
import SmoothScroll from "./motion/SmoothScroll.jsx";
import { queryClient } from "./lib/queryClient.js";
import "./styles/index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SmoothScroll />
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
