import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
    isDirectorDeskMessage,
    type DirectorDeskImage,
} from "shared/types/DirectorDeskMessage";

type DirectorDeskWorkspaceProps = {
    sourceNodeId: string | null;
    onClose: () => void;
    onSendImages: (sourceNodeId: string, images: DirectorDeskImage[]) => void;
};

/**
 * 独立导演台页面的 iframe 容器。
 * 仅接受该 iframe、同源且符合共享协议结构的消息，避免其他页面向画布注入数据。
 */
export const DirectorDeskWorkspace = ({
    sourceNodeId,
    onClose,
    onSendImages,
}: DirectorDeskWorkspaceProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const directorDeskUrl = useMemo(
        () =>
            new URL(
                `${import.meta.env.BASE_URL}director-desk.html`,
                window.location.href,
            ).href,
        [],
    );

    useEffect(() => {
        const expectedOrigin = new URL(directorDeskUrl).origin;
        const handleMessage = (event: MessageEvent<unknown>) => {
            if (event.source !== iframeRef.current?.contentWindow) {
                return;
            }

            if (event.origin !== expectedOrigin || !isDirectorDeskMessage(event.data)) {
                return;
            }

            if (event.data.type === "close") {
                onClose();
                return;
            }

            if (event.data.type === "send-images" && sourceNodeId) {
                onSendImages(sourceNodeId, event.data.images);
            }
        };

        window.addEventListener("message", handleMessage);
        return () => window.removeEventListener("message", handleMessage);
    }, [directorDeskUrl, onClose, onSendImages, sourceNodeId]);

    if (typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-100 bg-black/85">
            <iframe
                ref={iframeRef}
                src={directorDeskUrl}
                className="absolute inset-0 size-full border-0"
            />
        </div>,
        document.body,
    );
};
