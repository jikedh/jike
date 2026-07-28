import {
  Download,
  LoaderCircle,
  Pause,
  Play,
  Trash2,
  Upload,
} from "lucide-react";
import { type ChangeEvent, useRef } from "react";

export interface ReferenceVoiceBinding {
  url: string;
  name?: string;
  duration?: number;
  size?: number;
}

export const WanReferenceVoiceSlot = ({
  binding,
  isUploading,
  isPlaying,
  onUpload,
  onRemove,
  onPreview,
  onDownload,
}: {
  binding?: ReferenceVoiceBinding;
  isUploading: boolean;
  isPlaying: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onPreview: () => void;
  onDownload: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div
      className="nodrag nopan nowheel flex h-7 w-15 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/25 px-1 text-white/65"
      title={binding?.name || binding?.url || "上传参考音色"}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
        className="hidden"
        onChange={handleChange}
      />
      {isUploading ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin text-fuchsia-300" />
      ) : binding ? (
        <div className="flex w-full items-center justify-between gap-0.5">
          <button
            type="button"
            className="flex h-5 w-3.5 items-center justify-center text-fuchsia-200 hover:text-white"
            title={isPlaying ? "暂停试听" : "试听参考音色"}
            onClick={onPreview}
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" fill="currentColor" />
            ) : (
              <Play className="h-3 w-3" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            className="flex h-5 w-3.5 items-center justify-center hover:text-white"
            title="下载参考音色"
            onClick={onDownload}
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="flex h-5 w-3.5 items-center justify-center hover:text-white"
            title="替换参考音色"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="flex h-5 w-3.5 items-center justify-center hover:text-red-300"
            title="删除参考音色"
            onClick={onRemove}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex h-full w-full items-center justify-center gap-1 text-[9px] hover:text-fuchsia-200"
          title="上传参考音色"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-3 w-3" />
          <span>音色</span>
        </button>
      )}
    </div>
  );
};
