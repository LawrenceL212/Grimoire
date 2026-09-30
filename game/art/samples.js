// samples.js: three placeholder assets so the catalogue and its test have something to show
// before the real packs land. Later tasks may delete this file (and its import in index.js).
import * as THREE from 'three';
import { register } from './registry.js';
import { part, rbox, cyl, torus, themed, toon } from '../engine/kit.js';

const metal = toon(0x2d2925);

register('sample-crate', {
  category: 'prop', tiles: [1, 1],
  build() {
    const g = new THREE.Group();
    part(rbox(0.72, 0.62, 0.72, 0.05), themed('palette.tileWood'), { y: 0.31, parent: g });
    for (const y of [0.14, 0.48]) part(rbox(0.76, 0.07, 0.76, 0.02), themed('palette.gold'), { y, outline: 0, parent: g });
    return g;
  },
});

register('sample-bench', {
  category: 'furniture', sector: 'gym', tiles: [2, 1],
  build() {
    const g = new THREE.Group();
    part(rbox(1.5, 0.14, 0.46, 0.06), themed('shirts.bea'), { y: 0.5, parent: g });
    for (const x of [-0.6, 0.6]) {
      part(cyl(0.04, 0.04, 0.42, 8), metal, { x, y: 0.22, outline: 0.012, parent: g });
      part(rbox(0.12, 0.05, 0.5, 0.02), metal, { x, y: 0.025, outline: 0.012, parent: g });
    }
    return g;
  },
});

register('sample-pillar', {
  category: 'structure', tiles: [1, 1],
  build() {
    const g = new THREE.Group();
    part(rbox(0.9, 0.2, 0.9, 0.04), themed('palette.wall'), { y: 0.1, parent: g });
    part(cyl(0.3, 0.34, 3.0, 14), themed('palette.wall'), { y: 1.7, parent: g });
    part(rbox(0.9, 0.2, 0.9, 0.04), themed('palette.wall'), { y: 3.3, parent: g });
    part(torus(0.33, 0.035, 6, 20), themed('palette.gold'), { y: 0.5, rx: Math.PI / 2, outline: 0, parent: g });
    return g;
  },
});
