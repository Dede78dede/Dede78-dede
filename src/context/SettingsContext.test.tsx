import { renderHook, act } from '@testing-library/react';
import { SettingsProvider, useSettings, defaultMacros, defaultProfiles } from './SettingsContext';
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SettingsContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  it('should initialize with default settings', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    
    expect(result.current.settings.macros).toEqual(defaultMacros);
    expect(result.current.settings.profiles).toEqual(defaultProfiles);
    expect(result.current.settings.activeProfileId).toBe('profile-default');
  });

  it('should allow adding a new macro', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    
    const newMacro = {
      id: 'test-macro',
      trigger: 'test',
      label: 'Test Macro',
      template: 'This is a test macro'
    };

    act(() => {
      result.current.updateSettings({
        macros: [...result.current.settings.macros, newMacro]
      });
    });

    expect(result.current.settings.macros).toHaveLength(defaultMacros.length + 1);
    expect(result.current.settings.macros).toContainEqual(newMacro);
  });

  it('should allow adding a new profile', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    
    const newProfile = {
      id: 'test-profile',
      name: 'Test Profile',
      icon: 'User',
      systemPrompt: 'You are a test profile.',
      masterModel: 'test-model',
      fallbackModel: 'test-fallback'
    };

    act(() => {
      result.current.updateSettings({
        profiles: [...result.current.settings.profiles, newProfile]
      });
    });

    expect(result.current.settings.profiles).toHaveLength(defaultProfiles.length + 1);
    expect(result.current.settings.profiles).toContainEqual(newProfile);
  });

  it('should allow changing the active profile', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    
    act(() => {
      result.current.updateSettings({
        activeProfileId: 'profile-coder'
      });
    });

    expect(result.current.settings.activeProfileId).toBe('profile-coder');
  });
});
