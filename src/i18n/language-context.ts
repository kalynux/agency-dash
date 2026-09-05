import { createContext } from 'react';

import type { LanguageCode, LanguageDescriptor } from './config';

export interface LanguageContextValue {
  /** The language the UI is rendering in right now. */
  language: LanguageCode;
  /** Every language the dashboard can render, for pickers. */
  languages: readonly LanguageDescriptor[];
  /**
   * Switch the UI immediately. Used by the Account → Profile picker so the
   * preview is live before the user commits with Save; the durable value is
   * `preferred_language` on the agency profile.
   */
  setLanguage: (code: LanguageCode) => void;
  /**
   * Adopt the server's `preferred_language`. Called once the session loads and
   * again after a profile save. A no-op when it already matches, and a no-op
   * once the user has made a choice in this session.
   */
  syncFromProfile: (value: string | null | undefined) => void;
  /** False until the initial (possibly lazily fetched) bundle is in memory. */
  ready: boolean;
}

/**
 * Split out of `LanguageProvider.tsx` so that file exports a component and
 * nothing else — react-refresh can only hot-reload a module whose exports are
 * all components.
 */
export const LanguageContext = createContext<LanguageContextValue | null>(null);
