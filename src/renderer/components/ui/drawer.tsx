"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "shared/utils/utils";

function Drawer({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-40 bg-slate-900/35 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 duration-200",
        className,
      )}
      {...props}
    />
  );
}

type DrawerContentProps = React.ComponentProps<
  typeof DialogPrimitive.Content
> & {
  withOverlay?: boolean;
};

function DrawerContent({
  className,
  withOverlay = true,
  ...props
}: DrawerContentProps) {
  return (
    <DrawerPortal>
      {withOverlay ? <DrawerOverlay /> : null}
      <DialogPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "fixed top-0 right-0 z-50 h-screen w-105 border-l border-slate-200 bg-white shadow-[-16px_0_40px_rgba(15,23,42,0.15)] outline-hidden",
          "data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0",
          "data-open:slide-in-from-right-full data-closed:slide-out-to-right-full duration-300",
          className,
        )}
        {...props}
      />
    </DrawerPortal>
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-sm font-semibold text-slate-800", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn("mt-0.5 text-xs text-slate-500", className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
