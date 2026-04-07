/**
 * @fileoverview Index Scheda - Centralized export for all core domain logic.
 * This file acts as the single source of truth for types, enums, protocols, and constants.
 */

// Enums
export * from './enums';

// Abstract Base Classes & Protocols
export * from './abc/protocols';

// Constants & Dictionaries
export * from './abc/constants';

// Types
export * from './hal/types';
export * from './mcp';
export * from './routing/types';

// Registries (Maps)
export * from './hal/BackendRegistry';
