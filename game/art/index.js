// index.js: imports every art pack so the registry is populated, and re-exports the registry.
// Add a pack by importing it here.
import './samples.js';
import './materials.js';
import './furniture.js';

export * from './registry.js';
