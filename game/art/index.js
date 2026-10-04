// index.js: imports every art pack so the registry is populated, and re-exports the registry.
// Add a pack by importing it here.
import './samples.js';
import './materials.js';
import './furniture.js';
import './home.js';
// the client sectors, one district each
import './sectors/lab.js';
import './sectors/gym.js';
import './sectors/school.js';
import './sectors/clinic.js';
import './sectors/hall.js';
import './sectors/coworking.js';
// the people
import './people.js';
// the player's drone and the effects
import './fx.js';
import './drone.js';

export * from './registry.js';
