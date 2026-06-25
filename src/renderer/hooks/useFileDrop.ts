import { useCallback, useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
    detectMediaType,
    type MediaFileType,
} from "shared/constants/mediaTypes";
import {
    FILE_DROP_MAX_COUNT,
    FILE_DROP_MAX_SIZE,
} from "shared/constants/fileDrop";
import {
    insertFileDropIntoCanvas,
    applyAspectRatioToNode,
    uploadFilesToOss,
} from "@/pages/Canvas/utils/fileDropInsert";

export type FileDragState = {
    active: boolean;
    /** CSS 像素屏幕坐标 */
    position: { x: number; y: number };
    fileCount: number;
    fileType: MediaFileType;
    previewUrl: string;
};

const INITIAL_DRAG_STATE: FileDragState = {
    active: false,
    position: { x: 0, y: 0 },
    fileCount: 0,
    fileType: "unknown",
    previewUrl: "",
};

const PLACEHOLDER_OFFSET = { x: 140, y: 90 };

type TauriDragPayload = {
    type: "enter" | "over" | "drop" | "leave" | "cancelled";
    paths?: string[];
    position?: { x: number; y: number };
};

/** 将 Tauri 物理像素坐标转为 CSS 像素 */
const toCssPos = (pos: { x: number; y: number }) => {
    const dpr = window.devicePixelRatio || 1;
    return { x: pos.x / dpr, y: pos.y / dpr };
};

/** 检查坐标是否在给定 DOM 元素的边界内 */
const isWithinElement = (
    el: HTMLElement,
    pos: { x: number; y: number },
): boolean => {
    const rect = el.getBoundingClientRect();
    return (
        pos.x >= rect.left &&
        pos.x <= rect.right &&
        pos.y >= rect.top &&
        pos.y <= rect.bottom
    );
};

const MIME_MAP: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
    svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm",
    mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
    flv: "video/x-flv", wmv: "video/x-ms-wmv", mp3: "audio/mpeg",
    wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac",
    aac: "audio/aac", wma: "audio/x-ms-wma", m4a: "audio/mp4",
};

const inferMimeType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    return MIME_MAP[ext] || "application/octet-stream";
};

/** 从绝对路径读取文件并返回 File 对象 */
const readFileFromPath = async (path: string): Promise<File> => {
    const name = path.split(/[/\\]/).pop() || "file";
    const bytes: number[] = await (window as any).storage.readAbsoluteFile(path);
    const buffer = new Uint8Array(bytes);
    const mime = inferMimeType(name);
    const blob = new Blob([buffer], { type: mime });
    return new File([blob], name, { type: mime, lastModified: Date.now() });
};

/** 从文件路径生成预览 URL（仅图片） */
const createPreviewFromPath = async (path: string): Promise<string> => {
    try {
        const file = await readFileFromPath(path);
        const mediaType = detectMediaType(file.name, file.type);
        if (mediaType === "image") {
            return URL.createObjectURL(file);
        }
    } catch { /* 预览失败静默 */ }
    return "";
};

export function useFileDrop(
    screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
) {
    const dragStateRef = useRef<FileDragState>({ ...INITIAL_DRAG_STATE });
    const [dragActive, setDragActive] = useState(false);
    const processingRef = useRef(false);
    const isOverCanvasRef = useRef(false);

    const clearPreview = useCallback(() => {
        if (dragStateRef.current.previewUrl) {
            URL.revokeObjectURL(dragStateRef.current.previewUrl);
        }
    }, []);

    const resetDragState = useCallback(() => {
        clearPreview();
        dragStateRef.current = { ...INITIAL_DRAG_STATE };
        setDragActive(false);
    }, [clearPreview]);

    const handleFilesDrop = useCallback(
        async (paths: string[], cssPos: { x: number; y: number }) => {
            if (processingRef.current || paths.length === 0) return;
            processingRef.current = true;

            try {
                const toProcess = paths.slice(0, FILE_DROP_MAX_COUNT);
                if (paths.length > FILE_DROP_MAX_COUNT) {
                    toast.warning(`最多支持一次拖入 ${FILE_DROP_MAX_COUNT} 个文件，已截断`);
                }

                const files: File[] = [];
                const unsupported: string[] = [];
                let oversizeCount = 0;

                for (const path of toProcess) {
                    try {
                        const file = await readFileFromPath(path);
                        if (file.size > FILE_DROP_MAX_SIZE) {
                            oversizeCount++;
                            continue;
                        }
                        const mediaType = detectMediaType(file.name, file.type);
                        if (mediaType === "unknown") {
                            unsupported.push(file.name);
                        } else {
                            files.push(file);
                        }
                    } catch (err) {
                        console.warn(`[useFileDrop] failed to read ${path}:`, err);
                    }
                }

                if (oversizeCount > 0) {
                    toast.warning(`已跳过 ${oversizeCount} 个超过 500MB 的文件`);
                }
                if (unsupported.length > 0) {
                    toast.warning(
                        `不支持的文件类型，已跳过：${unsupported.slice(0, 3).join("、")}${unsupported.length > 3 ? `等 ${unsupported.length} 个` : ""
                        }`,
                    );
                }
                if (files.length === 0) {
                    resetDragState();
                    return;
                }

                const uploadResults = await uploadFilesToOss(files);
                const flowPosition = screenToFlowPosition({
                    x: cssPos.x - PLACEHOLDER_OFFSET.x,
                    y: cssPos.y - PLACEHOLDER_OFFSET.y,
                });

                let createdCount = 0;
                for (const result of uploadResults) {
                    if (!result) continue;
                    const nodeId = insertFileDropIntoCanvas(
                        result.file,
                        result.uploadResult,
                        flowPosition,
                    );
                    if (nodeId) {
                        createdCount++;
                        const mediaType = detectMediaType(result.file.name, result.file.type);
                        void applyAspectRatioToNode(nodeId, mediaType, result.uploadResult.url);
                    }
                }

                if (createdCount > 0) {
                    toast.success(`已创建 ${createdCount} 个节点`);
                }
            } catch (error) {
                console.error("[useFileDrop] drop processing failed:", error);
                toast.error("文件处理失败，请重试");
            } finally {
                processingRef.current = false;
                resetDragState();
            }
        },
        [screenToFlowPosition, resetDragState],
    );

    useEffect(() => {
        let cancelled = false;
        const unlisteners: UnlistenFn[] = [];

        const setup = async () => {
            try {
                unlisteners.push(
                    await listen<TauriDragPayload>("tauri://drag-enter", (event) => {
                        const cssPos = event.payload.position
                            ? toCssPos(event.payload.position)
                            : { x: 0, y: 0 };
                        const paths = event.payload.paths ?? [];

                        const el = document.querySelector(".react-flow") as HTMLElement | null;
                        if (!el || !isWithinElement(el, cssPos)) return;

                        isOverCanvasRef.current = true;
                        el.classList.add("file-drop-allowed");
                        setDragActive(true);
                        dragStateRef.current.active = true;
                        dragStateRef.current.position = cssPos;
                        dragStateRef.current.fileCount = paths.length;

                        if (paths.length > 0 && !dragStateRef.current.previewUrl) {
                            void createPreviewFromPath(paths[0]).then((url) => {
                                if (!cancelled && dragStateRef.current.active) {
                                    dragStateRef.current.previewUrl = url;
                                    dragStateRef.current.fileType = detectMediaType(
                                        paths[0].split(/[/\\]/).pop() || "", "",
                                    );
                                }
                            });
                        }
                    }),
                );

                unlisteners.push(
                    await listen<TauriDragPayload>("tauri://drag-over", (event) => {
                        if (!event.payload.position) return;
                        const cssPos = toCssPos(event.payload.position);
                        const el = document.querySelector(".react-flow") as HTMLElement | null;
                        if (!el) return;

                        const isOver = el ? isWithinElement(el, cssPos) : false;
                        if (isOver !== isOverCanvasRef.current) {
                            isOverCanvasRef.current = isOver;
                            if (isOver) {
                                el?.classList.add("file-drop-allowed");
                                setDragActive(true);
                            } else {
                                el?.classList.remove("file-drop-allowed");
                                resetDragState();
                            }
                        }
                        if (isOver) {
                            dragStateRef.current.position = cssPos;
                        }
                    }),
                );

                unlisteners.push(
                    await listen<TauriDragPayload>("tauri://drag-drop", (event) => {
                        const el = document.querySelector(".react-flow") as HTMLElement | null;
                        el?.classList.remove("file-drop-allowed");

                        const cssPos = event.payload.position
                            ? toCssPos(event.payload.position)
                            : { x: 0, y: 0 };
                        const paths = event.payload.paths ?? [];

                        if (isOverCanvasRef.current && paths.length > 0) {
                            void handleFilesDrop(paths, cssPos);
                        } else {
                            resetDragState();
                        }
                    }),
                );

                unlisteners.push(
                    await listen<TauriDragPayload>("tauri://drag-leave", () => {
                        const el = document.querySelector(".react-flow") as HTMLElement | null;
                        el?.classList.remove("file-drop-allowed");
                        resetDragState();
                    }),
                );
            } catch (err) {
                console.warn("[useFileDrop] Tauri event setup failed:", err);
            }
        };

        void setup();

        return () => {
            cancelled = true;
            unlisteners.forEach((fn) => fn());
            document.querySelector(".react-flow")?.classList.remove("file-drop-allowed");
            clearPreview();
        };
    }, [handleFilesDrop, resetDragState, clearPreview]);

    return { dragStateRef, dragActive };
}
