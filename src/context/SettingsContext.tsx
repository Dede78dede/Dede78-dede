import React, { ReactNode } from 'react';
import { useSettingsStore, AppSettings, Macro, Profile, defaultMacros, defaultProfiles } from '../store/settingsStore';

export type { AppSettings, Macro, Profile };
export { defaultMacros, defaultProfiles };

/**
 * SettingsProvider is now a simple pass-through component,
 * as state is managed globally by Zustand.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/**
 * Custom hook to access the settings context.
 * Now uses Zustand under the hood for better performance.
 */
export function useSettings() {
  return useSettingsStore();
}

