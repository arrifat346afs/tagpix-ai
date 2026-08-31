import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ApiSettings from "./_component/ApiSettings";
import MetadataSettings from "./_component/MetadataSettings";
import { EmbedSettings } from "./_component/EmbedSettings";
import ApiKeyManagement from "./_component/ApiKeyManagement";
import ExportSettings from "./_component/ExportSettings";
import { useUiStore, setSettingsDialogTab } from "@/store/uiStore";
import {
  Settings as SettingsIcon,
  Key,
  FileText,
  Code,
  FileType2,
  Download,
  Palette,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TemplateManager } from "./_component/TemplateManager";
import { ThemePicker } from "@/components/theme-picker";
import { motion, AnimatePresence } from "motion/react";
import CacheSettings from "./_component/CacheSettings";

const Settings = () => {
  const defaultTab = useUiStore((state) => state.settingsDialog.defaultTab);

  const menuItems = [
    { id: "themes", label: "Themes", icon: Palette },
    { id: "models", label: "Model Selection", icon: SettingsIcon },
    { id: "apikeys", label: "API Keys", icon: Key },
    { id: "metadata", label: "Metadata", icon: FileText },
    { id: "embed", label: "Embed", icon: Code },
    { id: "export", label: "Export", icon: Download },
    { id: "templates", label: "Templates", icon: FileType2 },
    { id: "cache", label: "Cache", icon: HardDrive },
  ];

  const tabContent: Record<string, React.ReactNode> = {
    themes: <ThemePicker />,
    models: <ApiSettings />,
    apikeys: <ApiKeyManagement compact={true} showTitle={false} />,
    metadata: <MetadataSettings />,
    embed: <EmbedSettings />,
    export: <ExportSettings />,
    templates: <TemplateManager />,
    cache: <CacheSettings />,
  };

  return (
    <motion.div
      className="flex flex-col h-full w-full"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: "easeOut", staggerChildren: 0.2 }}
    >
      <DialogHeader className="px-4 sm:px-6 pt-6 pb-4 shrink-0">
        <DialogTitle className="text-xl sm:text-2xl font-bold">
          Settings
        </DialogTitle>
      </DialogHeader>
      <div className="flex flex-1 min-h-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 sm:w-56 md:w-64 border-r bg-muted/30 px-2 sm:px-3 py-4 overflow-y-auto shrink-0">
          <nav className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = defaultTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  onClick={() => setSettingsDialogTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 rounded-md text-xs sm:text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  whileHover={{ x: isActive ? 0 : -5 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden px-4 sm:px-6 py-4 min-w-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={defaultTab}
              className="h-full overflow-y-auto"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18, ease: "easeInOut" }}
            >
              {tabContent[defaultTab]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default Settings;
