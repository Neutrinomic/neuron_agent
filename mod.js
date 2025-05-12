// JavaScript wrapper for mod.ts
import * as mod from './mod.ts';

// Re-export everything from mod.ts
export * from './mod.ts';

// If this file is executed directly, run the start function
if (import.meta.main) {
  await mod.start();
} 