// test-fixtures.js: TEST ONLY. Loaded by the catalogue when its URL asks for it:
//   ?test-bad=1   registers three deliberately broken assets (over budget, NaN vertex, off-footprint)
//                 plus one healthy asset with a raised, reasoned budget
//   ?stress=N     registers N clones of the sample assets at distinct ids (load test)
// Never imported by index.js, so the game and the normal catalogue never see these.
import * as THREE from 'three';
import { register, get, list } from './registry.js';
import { toon } from '../engine/kit.js';

const mat = toon(0x9a6b4a);

export function registerBad() {
  register('test-bad-over-budget', {
    category: 'prop', tiles: [1, 1], budget: 50,
    build() { // a 64x32 sphere: ~4000 triangles against a budget of 50
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 64, 32), mat);
      m.position.y = 0.3;
      return new THREE.Group().add(m);
    },
  });
  register('test-bad-nan', {
    category: 'prop', tiles: [1, 1],
    build() {
      const g = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      g.translate(0, 0.25, 0);
      g.attributes.position.setX(3, NaN);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.25, 0), 0.5); // keep three from warning about NaN radius
      g.boundingBox = new THREE.Box3(new THREE.Vector3(-0.25, 0, -0.25), new THREE.Vector3(0.25, 0.5, 0.25));
      return new THREE.Group().add(new THREE.Mesh(g, mat));
    },
  });
  register('test-bad-oversized', {
    category: 'prop', tiles: [1, 1],
    build() { // 1.6 wide and shifted off-centre, on a 1x1 footprint
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.6), mat);
      m.position.set(0.5, 0.2, 0);
      return new THREE.Group().add(m);
    },
  });
}

// Not broken: a budget above the prop default, with the reason the catalogue must show.
export function registerRaised() {
  register('test-raised-budget', {
    category: 'prop', tiles: [1, 1], budget: 4000, budgetReason: 'test fixture: a raised budget with its reason',
    build() {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), mat);
      m.position.y = 0.25;
      return new THREE.Group().add(m);
    },
  });
}

export function registerStress(n) {
  const samples = list().filter((a) => a.id.startsWith('sample-')).map((a) => get(a.id));
  if (!samples.length) return;
  for (let i = 0; i < n; i++) {
    const s = samples[i % samples.length];
    register(`stress-${String(i).padStart(3, '0')}`, { category: s.category, sector: s.sector, tiles: s.tiles, build: s.build });
  }
}
