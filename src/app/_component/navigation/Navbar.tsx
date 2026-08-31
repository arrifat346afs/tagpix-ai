import { Button } from "@/components/ui/button";
import Settings from "../settings/Settings";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { SettingsIcon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  VscChromeClose,
  VscChromeMaximize,
  VscChromeMinimize,
  VscChromeRestore,
} from "react-icons/vsc";
import { ItemMedia } from "@/components/ui/item";
import logo from "../../../assets/descify.svg";
import { useEffect, useState } from "react";
import { useUiStore, setSettingsDialogOpen } from "@/store/uiStore";
import { ThemeToggle } from "@/components/mode-toggle";
import { UpdateChecker } from "@/components/UpdateChecker";
// import { ConsolePopover } from "../ConsolePopover";

const Navbar = () => {
  const appWindow = getCurrentWindow();
  const [isMaximized, setIsMaximized] = useState(false);
  const isSettingsOpen = useUiStore((state) => state.settingsDialog.isOpen);

  useEffect(() => {
    // Check initial maximized state
    const checkMaximized = async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    };
    checkMaximized();

    // Listen for window resize events to update maximized state
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);
  return (
    <div className="flex justify-between items-center h-full">
      <div className="flex w-full">
        <div
          data-tauri-drag-region
          className="flex justify-center items-center pl-2"
        >
          <ItemMedia variant="image">
            <img
              src={logo}
              alt="logo"
              style={{
                width: "25px",
                height: "auto",
              }}
            />
          </ItemMedia>
        </div>
        <div className="flex justify-center items-center">
          <Dialog
            open={isSettingsOpen}
            onOpenChange={setSettingsDialogOpen}
          >
            <DialogTrigger asChild>
              <Button variant={"ghost"} className="cursor-pointer">
                <SettingsIcon />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[85vw] md:max-w-4xl h-[80vh] max-h-[800px] p-0 flex flex-col">
              <Settings />
            </DialogContent>
          </Dialog>
          <ThemeToggle />
          {/* <ConsolePopover /> */}
        </div>
        <div data-tauri-drag-region className="flex-1" />
      </div>
      <div className="flex">
        <UpdateChecker />
        <Button
          variant={"ghost"}
          onClick={() => appWindow.minimize()}
          className="h-[35px] w-10 rounded-none  hover:bg-zinc-500/30"
        >
          <VscChromeMinimize />
        </Button>
        <Button
          variant={"ghost"}
          onClick={() => appWindow.toggleMaximize()}
          className="h-[35px] w-10 rounded-none hover:bg-zinc-500/30"
        >
          {isMaximized ? <VscChromeRestore /> : <VscChromeMaximize />}
        </Button>
        <Button
          variant={"ghost"}
          onClick={() => appWindow.close()}
          className="h-[35px] w-10 rounded-none hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
        >
          <VscChromeClose />
        </Button>
      </div>
    </div>
  );
};

export default Navbar;
