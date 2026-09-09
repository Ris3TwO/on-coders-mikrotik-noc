import { vi } from "vitest";

export const createI18n = vi.fn(() => ({
  global: {
    locale: { value: "es" },
    t: (key: string) => key,
  },
  install: () => {},
}));

export const useI18n = vi.fn(() => ({
  t: (key: string) => key,
  locale: { value: "es" },
}));