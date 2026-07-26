"use client";

import { create } from "zustand";

export type ToolbarMenu = "filter" | "sort" | "customize" | null;

type UiState = {
  notificationsOpen: boolean;
  toolbarMenu: ToolbarMenu;
  /** Active lead preview sidebar (null = closed / closing). */
  previewLeadId: string | null;
  /** Right filter panel on leads page. */
  filterSidebarOpen: boolean;
  setNotificationsOpen: (open: boolean) => void;
  toggleNotifications: () => void;
  setToolbarMenu: (menu: ToolbarMenu) => void;
  toggleToolbarMenu: (menu: Exclude<ToolbarMenu, null>) => void;
  openLeadPreview: (leadId: string) => void;
  closeLeadPreview: () => void;
  toggleLeadPreview: (leadId: string) => void;
  openFilterSidebar: () => void;
  closeFilterSidebar: () => void;
  toggleFilterSidebar: () => void;
  closeOverlays: () => void;
  resetSession: () => void;
};

/**
 * Ephemeral UI chrome only — overlays/menus/preview.
 * Isolated from leads data so selection/filter never re-render navbar chrome
 * (and overlay toggles never re-render the table body).
 */
export const useUiStore = create<UiState>()((set, get) => ({
  notificationsOpen: false,
  toolbarMenu: null,
  previewLeadId: null,
  filterSidebarOpen: false,

  setNotificationsOpen: (open) =>
    set((state) => {
      if (state.notificationsOpen === open) return state;
      return {
        notificationsOpen: open,
        toolbarMenu: open ? null : state.toolbarMenu,
      };
    }),

  toggleNotifications: () =>
    set((state) => ({
      notificationsOpen: !state.notificationsOpen,
      toolbarMenu: null,
    })),

  setToolbarMenu: (menu) =>
    set((state) => {
      if (state.toolbarMenu === menu && !state.notificationsOpen) return state;
      return { toolbarMenu: menu, notificationsOpen: false };
    }),

  toggleToolbarMenu: (menu) =>
    set((state) => ({
      toolbarMenu: state.toolbarMenu === menu ? null : menu,
      notificationsOpen: false,
    })),

  openLeadPreview: (leadId) =>
    set((state) => {
      if (state.previewLeadId === leadId && !state.filterSidebarOpen) {
        return state;
      }
      return {
        previewLeadId: leadId,
        filterSidebarOpen: false,
        toolbarMenu: null,
        notificationsOpen: false,
      };
    }),

  closeLeadPreview: () =>
    set((state) => {
      if (state.previewLeadId === null) return state;
      return { previewLeadId: null };
    }),

  toggleLeadPreview: (leadId) => {
    const current = get().previewLeadId;
    if (current === leadId) {
      set({ previewLeadId: null });
      return;
    }
    set({
      previewLeadId: leadId,
      filterSidebarOpen: false,
      toolbarMenu: null,
      notificationsOpen: false,
    });
  },

  openFilterSidebar: () =>
    set({
      filterSidebarOpen: true,
      previewLeadId: null,
      toolbarMenu: null,
      notificationsOpen: false,
    }),

  closeFilterSidebar: () =>
    set((state) => {
      if (!state.filterSidebarOpen) return state;
      return { filterSidebarOpen: false };
    }),

  toggleFilterSidebar: () => {
    const open = get().filterSidebarOpen;
    if (open) {
      set({ filterSidebarOpen: false });
      return;
    }
    set({
      filterSidebarOpen: true,
      previewLeadId: null,
      toolbarMenu: null,
      notificationsOpen: false,
    });
  },

  closeOverlays: () => {
    const state = get();
    if (!state.notificationsOpen && state.toolbarMenu === null) return;
    set({ notificationsOpen: false, toolbarMenu: null });
  },

  resetSession: () =>
    set({
      notificationsOpen: false,
      toolbarMenu: null,
      previewLeadId: null,
      filterSidebarOpen: false,
    }),
}));
