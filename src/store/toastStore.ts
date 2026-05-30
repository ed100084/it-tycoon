import { create } from 'zustand';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

export interface EventModalConfig {
  title: string;
  body: string;
  severity?: 'critical' | 'warning' | 'info';
  decisions?: Array<{ label: string; index: number }>;
  decisionId?: string;
}

interface ToastStoreState {
  toasts: Toast[];
  modal: EventModalConfig | null;
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
  showModal: (modal: EventModalConfig) => void;
  dismissModal: () => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  modal: null,

  addToast(type, message, duration = 4000) {
    const id = crypto.randomUUID();
    set((state) => {
      // Keep at most 5 toasts
      const existing = state.toasts.slice(-4);
      return { toasts: [...existing, { id, type, message }] };
    });
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  removeToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  showModal(modal) {
    set({ modal });
  },

  dismissModal() {
    set({ modal: null });
  },
}));
