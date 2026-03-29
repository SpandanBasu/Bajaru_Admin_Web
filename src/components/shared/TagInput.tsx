import { useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  badgeVariant?: "secondary" | "outline";
  className?: string;
}

export function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter…",
  badgeVariant = "secondary",
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addTags = (raw: string) => {
    const incoming = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t && !value.includes(t));
    if (incoming.length === 0) return;
    onChange([...value, ...incoming]);
    setInputValue("");
  };

  const removeTag = (tag: string) => onChange(value.filter((t) => t !== tag));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTags(inputValue);
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-secondary/50 px-3 py-2 transition-colors",
        "focus-within:bg-background focus-within:ring-1 focus-within:ring-ring",
        className
      )}
    >
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant={badgeVariant}
              className="rounded-full text-xs gap-1 pr-0.5 group/tag cursor-default"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="rounded-full w-3.5 h-3.5 flex items-center justify-center opacity-0 group-hover/tag:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : "Add more…"}
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
      />
    </div>
  );
}
