import "./App.css";
import { Home } from "./app/Home";
import { Toaster } from "./components/ui/sonner";
import Navbar from "./app/_component/navigation/Navbar";
import { useEffect } from "react";
import { hasApiKey } from "./store/configStore";
import { setSettingsDialogOpen, setSettingsDialogTab } from "./store/uiStore";
// import { ConsoleProvider } from "./components/ConsoleContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { Separator } from "./components/ui/separator";


function App() {
  // Check if API key is configured on mount
  useEffect(() => {
    if (!hasApiKey()) {
      // Open settings dialog with API Keys tab selected
      setSettingsDialogTab('apikeys');
      setSettingsDialogOpen(true);
    }
  }, []); // Only run once on mount

  return (

      <TooltipProvider>
        <main>
          <div className="h-[35px]">
            <Navbar />
          </div>
          <Separator />
          <Home />
          <Toaster />
          
        </main>
      </TooltipProvider>

  );
}

export default App;
