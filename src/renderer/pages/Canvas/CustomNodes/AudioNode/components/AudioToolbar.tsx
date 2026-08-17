import { IconDownload, IconTrash, IconUpload } from "@tabler/icons-react";
import { memo, useCallback, useRef, useState } from "react";
import { uploadFileToOSS } from "service/oss";
import { GenerationStatus } from "shared/constants/enum";
import type { AudioNodeType } from "shared/types/flow";
import { cn, downloadImageFromUrl } from "shared/utils/utils";
import useMessage from "@/hooks/useMessage";
import { useCanvasFlowStore } from "@/stores/canvasFlowStore";
import { getAudioDownloadExtension, isSupportedUploadAudioFile } from "../utils/audioFile";

type AudioToolbarProps = {
    nodeId: string;
    data: AudioNodeType["data"];
    onDelete: () => void;
};

export const AudioToolbar = memo(({ nodeId, data, onDelete }: AudioToolbarProps) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const updateAudioNodeData = useCanvasFlowStore((state) => state.updateAudioNodeData);
    const { success, warning, error } = useMessage();
    const audioUrl = data.result?.data?.[0]?.url;

    const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!isSupportedUploadAudioFile(file)) {
            warning("请上传 MP3、WAV、OGG 或 AAC 格式的音频文件");
            return;
        }

        setIsUploading(true);
        try {
            const result = await uploadFileToOSS(file);
            if (!result.url) {
                warning("上传成功但未返回音频地址");
                return;
            }
            updateAudioNodeData(nodeId, {
                status: GenerationStatus.COMPLETED,
                progress: 100,
                isUpload: true,
                result: { type: "audio", data: [{ url: result.url }] },
            });
            success("上传成功");
        } catch (uploadError: any) {
            console.error("上传音频失败:", uploadError);
            error("上传失败，请重试");
        } finally {
            setIsUploading(false);
            event.target.value = "";
        }
    }, [error, nodeId, success, updateAudioNodeData, warning]);

    const handleDownload = useCallback(async () => {
        if (!audioUrl || isDownloading) return;

        setIsDownloading(true);
        try {
            await downloadImageFromUrl(audioUrl, `audio_${nodeId}.${getAudioDownloadExtension(data.result?.data?.[0]?.format)}`);
            success("下载成功");
        } catch (downloadError: any) {
            if (downloadError?.message !== "取消下载") error(downloadError?.message ?? "下载失败");
        } finally {
            setIsDownloading(false);
        }
    }, [audioUrl, data.result, error, isDownloading, nodeId, success]);

    return (
        <>
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-neutral-900/90 px-2 py-1.5 shadow-lg backdrop-blur-sm">
                <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all", isUploading ? "cursor-not-allowed text-white/30" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                    <IconUpload size={14} />
                    <span>{isUploading ? "上传中" : "上传"}</span>
                </button>
                <button onClick={() => void handleDownload()} disabled={!audioUrl || isDownloading} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all", !audioUrl || isDownloading ? "cursor-not-allowed text-white/30" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                    <IconDownload size={14} />
                    <span>{isDownloading ? "下载中" : "下载"}</span>
                </button>
                <button onClick={onDelete} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white">
                    <IconTrash size={14} />
                    <span>删除</span>
                </button>
            </div>
        </>
    );
});

AudioToolbar.displayName = "AudioToolbar";
