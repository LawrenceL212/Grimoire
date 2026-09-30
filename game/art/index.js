// index.js: imports every art pack so the registry is populated, and re-exports the registry.
// Add a pack by importing it here.
import './samples.js';
import './materials.js';
import './furniture.js';
// the client sectors, one district each
import './sectors/lab.js';
import './sectors/gym.js';
import './sectors/school.js';
import './sectors/clinic.js';
import './sectors/hall.js';
import './sectors/coworking.js';

export * from './registry.js';
