// Must be the first import: enables immer Map/Set support and migrates the
// legacy redux-persist localStorage layout before the stores hydrate.
import "./store/init";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/theme-provider";
import { SettingsProvider } from "./app/contexts/SettingsContext";

//
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </ThemeProvider>
  </React.StrictMode>
);
