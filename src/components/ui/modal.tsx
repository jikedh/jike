"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Modal({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return <DialogPrimitive.Root data-slot="modal" {...props} />
}

function ModalPortal({
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return <DialogPrimitive.Portal data-slot="modal-portal" {...props} />
}

function ModalOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="modal-overlay"
            className={cn(
                "fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0 duration-200",
                className,
            )}
            {...props}
        />
    )
}

function ModalContent({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
    return (
        <ModalPortal>
            <ModalOverlay />
            <DialogPrimitive.Content
                data-slot="modal-content"
                className={cn(
                    "fixed top-1/2 left-1/2 z-50 w-[min(920px,92vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#121214] shadow-2xl outline-hidden",
                    "data-open:animate-in data-closed:animate-out data-open:fade-in-0 data-closed:fade-out-0",
                    "data-open:zoom-in-95 data-closed:zoom-out-95 duration-200",
                    className,
                )}
                {...props}
            />
        </ModalPortal>
    )
}

function ModalTitle({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="modal-title"
            className={cn("text-lg font-semibold text-white/90", className)}
            {...props}
        />
    )
}

function ModalDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="modal-description"
            className={cn("mt-1 text-sm text-white/50", className)}
            {...props}
        />
    )
}

export {
    Modal,
    ModalContent,
    ModalDescription,
    ModalOverlay,
    ModalPortal,
    ModalTitle,
}
