// Re-export shared types
export * from './types';

// Re-export all services
export * from './services';

// Legacy compatibility for mock-data (if needed, but ideally mock-data imports from types)
// We leave mock-data separate as it's not strictly part of the API definition but data.
import { InventoryItem, User } from './types';
export type { InventoryItem, User };
