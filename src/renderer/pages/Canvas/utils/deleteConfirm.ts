export const CANVAS_DELETE_CONFIRM_EVENT = "jike:confirm-generating-delete";

export type CanvasDeleteConfirmDetail = {
  title?: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
};

export const requestCanvasDeleteConfirm = (
  detail: CanvasDeleteConfirmDetail,
) => {
  if (typeof window === "undefined") {
    detail.onConfirm();
    return;
  }

  window.dispatchEvent(
    new CustomEvent<CanvasDeleteConfirmDetail>(CANVAS_DELETE_CONFIRM_EVENT, {
      detail,
    }),
  );
};
