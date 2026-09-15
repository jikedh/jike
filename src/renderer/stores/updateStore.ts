import { create } from "zustand";

interface UpdateStore {
    hasAvailableUpdate: boolean;
    isUpdateDialogOpen: boolean;
    setHasAvailableUpdate: (hasAvailableUpdate: boolean) => void;
    setUpdateDialogOpen: (isUpdateDialogOpen: boolean) => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
    hasAvailableUpdate: false,
    isUpdateDialogOpen: false,
    setHasAvailableUpdate: (hasAvailableUpdate) => set({ hasAvailableUpdate }),
    setUpdateDialogOpen: (isUpdateDialogOpen) => set({ isUpdateDialogOpen }),
}));