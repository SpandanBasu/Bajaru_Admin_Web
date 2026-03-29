import { useState, useRef, useCallback } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadZoneProps {
  onFilesAdded: (dataUrls: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function ImageUploadZone({ onFilesAdded, multiple = true, className }: ImageUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const fileList = multiple ? Array.from(files) : [files[0]];
      const results: string[] = [];
      let completed = 0;

      fileList.forEach((file) => {
        if (!file.type.startsWith("image/")) {
          completed++;
          if (completed === fileList.length) onFilesAdded(results.filter(Boolean));
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) results.push(e.target.result as string);
          completed++;
          if (completed === fileList.length) onFilesAdded(results.filter(Boolean));
        };
        reader.readAsDataURL(file);
      });
    },
    [multiple, onFilesAdded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles]
  );

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed cursor-pointer transition-colors h-full min-h-[90px] px-3 py-3",
        isDragging
          ? "border-primary bg-primary/10"
          : "border-border/50 bg-secondary/30 hover:border-primary/50 hover:bg-secondary/60",
        className
      )}
    >
      <UploadCloud className={cn("w-6 h-6", isDragging ? "text-primary" : "text-muted-foreground")} />
      <p className="text-xs text-center text-muted-foreground leading-tight">
        <span className="font-semibold text-foreground">Click or drag</span>
        <br />to upload {multiple ? "images" : "image"}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => processFiles(e.target.files)}
      />
    </div>
  );
}
