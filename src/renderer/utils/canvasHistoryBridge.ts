let historySaver: (() => void) | null = null;

export const registerCanvasHistorySaver = (saver: () => void) => {
  historySaver = saver;
};

export const unregisterCanvasHistorySaver = (saver: () => void) => {
  if (historySaver === saver) {
    historySaver = null;
  }
};

export const saveCurrentCanvasToHistory = () => {
  historySaver?.();
};
