import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import type { ModelInfo } from "@/app/lib/models/modelFetcher";

interface ModelSelectorProps {
    models: ModelInfo[];
    value: string;
    onValueChange: (value: string) => void;
    isLoading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    searchPlaceholder?: string;
}

function formatContextWindow(tokens: number): string {
    if (tokens >= 1_000_000) {
        const millions = tokens / 1_000_000;
        return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M tokens`;
    }
    if (tokens >= 1_000) {
        return `${Math.round(tokens / 1_000)}K tokens`;
    }
    return `${tokens} tokens`;
}

function buildDetailRows(model: ModelInfo): { label: string; value: string }[] {
    const rows: { label: string; value: string }[] = [];

    if (model.provider) {
        rows.push({ label: "Provider", value: model.provider });
    }
    if (model.inputTypes?.length) {
        rows.push({
            label: "Input type",
            value: model.inputTypes
                .map((type) => type.charAt(0).toUpperCase() + type.slice(1))
                .join(", "),
        });
    }
    if (typeof model.supportsReasoning === "boolean") {
        rows.push({
            label: "Reasoning",
            value: model.supportsReasoning ? "Supported" : "Not supported",
        });
    }
    if (typeof model.contextWindow === "number") {
        rows.push({
            label: "Context window",
            value: formatContextWindow(model.contextWindow),
        });
    }

    return rows;
}

function ModelDetailsContent({ model }: { model: ModelInfo }) {
    const rows = buildDetailRows(model);

    return (
        <div className="flex w-full flex-col gap-2">
            <span className="text-xs font-semibold">{model.label}</span>
            {rows.length > 0 && (
                <dl className="flex w-full flex-col gap-1">
                    {rows.map((row) => (
                        <div key={row.label} className="grid grid-cols-[7rem_1fr] gap-2">
                            <dt className="text-xs opacity-70">{row.label}</dt>
                            <dd className="truncate text-xs font-medium">{row.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
            {model.description && (
                <p className="line-clamp-3 text-xs/relaxed opacity-80">
                    {model.description}
                </p>
            )}
        </div>
    );
}

export function ModelSelector({
    models,
    value,
    onValueChange,
    isLoading = false,
    disabled = false,
    placeholder = "Select a model",
    searchPlaceholder = "Search models...",
}: ModelSelectorProps) {
    const [open, setOpen] = useState(false);
    const [hoveredModel, setHoveredModel] = useState<ModelInfo | null>(null);
    const [visible, setVisible] = useState(false);
    const [pointer, setPointer] = useState({ x: 0, y: 0 });

    const selectedModel = useMemo(
        () => models.find((model) => model.value === value),
        [models, value]
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const openTimerRef = useRef<number | null>(null);

    const clearOpenTimer = () => {
        if (openTimerRef.current) {
            clearTimeout(openTimerRef.current);
            openTimerRef.current = null;
        }
    };

    const handleEnter = (model: ModelInfo, e: React.MouseEvent) => {
        setHoveredModel(model);
        setPointer({ x: e.clientX, y: e.clientY });
        if (visible) return;
        clearOpenTimer();
        openTimerRef.current = window.setTimeout(() => setVisible(true), 150);
    };

    const handleLeave = () => {
        clearOpenTimer();
        setHoveredModel(null);
        setVisible(false);
    };

    const handleMove = (e: React.MouseEvent) => {
        setPointer({ x: e.clientX, y: e.clientY });
    };

    // Close when clicking outside
    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    // Reset tooltip state whenever the dropdown closes
    useEffect(() => {
        if (!open) {
            clearOpenTimer();
            setHoveredModel(null);
            setVisible(false);
        }
    }, [open]);

    // Cleanup timers on unmount
    useEffect(() => clearOpenTimer, []);

    const cardStyle = visible
        ? { opacity: 1, transform: "scale(1)" }
        : { opacity: 0, transform: "scale(0.95)" };

    const showCard = open && Boolean(hoveredModel);

    const cardLeft = Math.min(Math.max(8, pointer.x + 16), window.innerWidth - 304);
    const cardTop = Math.min(Math.max(8, pointer.y + 16), window.innerHeight - 220);

    return (
        <div ref={containerRef} className="relative w-full">
            <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between px-3 font-normal"
                disabled={disabled || isLoading}
                onClick={() => setOpen((prev) => !prev)}
            >
                <span className="truncate">
                    {isLoading
                        ? "Loading models..."
                        : selectedModel
                            ? selectedModel.label
                            : placeholder}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>

            {open && (
                <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md ring-1 ring-foreground/10">
                    <Command>
                        <CommandInput placeholder={searchPlaceholder} />
                        <CommandList
                                            onWheel={(e) => e.stopPropagation()}
                                            onMouseLeave={handleLeave}
                                        >
                            <CommandEmpty>No models found.</CommandEmpty>
                            <CommandGroup heading="Available Models">
                                {models.map((model) => (
                                    <CommandItem
                                        key={model.value}
                                        value={model.label}
                                        onSelect={() => {
                                            onValueChange(model.value);
                                            setOpen(false);
                                        }}
                                        onMouseEnter={(e) => handleEnter(model, e)}
                                        onMouseMove={handleMove}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === model.value ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <div className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate">{model.label}</span>
                                            {model.value !== model.label && (
                                                <span className="text-[10px] text-muted-foreground truncate max-w-[400px]">
                                                    {model.value}
                                                </span>
                                            )}
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </div>
            )}
            {hoveredModel &&
                showCard &&
                createPortal(
                    <div
                        className="pointer-events-none fixed z-[60] w-72 rounded-lg border bg-popover p-3 text-left text-popover-foreground shadow-lg transition-[opacity,transform] duration-150 ease-out"
                        style={{
                            left: cardLeft,
                            top: cardTop,
                            ...cardStyle,
                        }}
                    >
                        <ModelDetailsContent model={hoveredModel} />
                    </div>,
                    document.body
                )}
        </div>
    );
}
