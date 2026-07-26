"use client";

import { create } from "zustand";

export type ActionToastTone = "success";

type ActionToastState = {
  id: number;
  message: string;
  visible: boolean;
  show: (message?: string) => void;
  hide: () => void;
};

let toastSeq = 0;

/** Global green “Done / Saved” indicator after CRUD completes. */
export const useActionToastStore = create<ActionToastState>((set) => ({
  id: 0,
  message: "Done",
  visible: false,
  show: (message = "Done") => {
    toastSeq += 1;
    set({
      id: toastSeq,
      message: message.trim() || "Done",
      visible: true,
    });
  },
  hide: () => set({ visible: false }),
}));

export function showActionToast(message = "Done") {
  useActionToastStore.getState().show(message);
}
