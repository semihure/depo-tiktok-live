// Sabit arka kadraj: kalabalığın arkasından sahneye bakar.
// Olaylarda yalnızca küçük hareketler: vuruş nabzı, hediyede hafif yakınlaşma, drop'ta sarsıntı.
import * as THREE from 'three';
import { CAM } from './sahne.js';

export function createDirector(camera) {
  const D = { shake: 0, zoomT: 0, cur: 'sabit', crowdN: 0, near: 0 };
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  camera.position.copy(CAM.pos); camera.fov = CAM.fov; camera.lookAt(CAM.look); camera.updateProjectionMatrix();

  // eski arayüzle uyumlu: { shot, shake } — plan değişmez, sadece yakınlaşır/sarsılır
  D.focusOn = ({ shake } = {}) => {
    if (shake) D.shake = Math.max(D.shake, shake);
    else D.zoomT = 1.5;
  };

  D.update = (dt, time, beat) => {
    D.zoomT = Math.max(0, D.zoomT - dt);
    D.shake = Math.max(0, D.shake - dt * 0.8);
    const z = Math.sin(Math.min(1, D.zoomT / 1.5) * Math.PI);   // 0 → 1 → 0
    const ph = ((beat % 1) + 1) % 1, pulse = Math.pow(1 - ph, 4);
    // az izleyicide kalabalık küçük kalmasın: 30 kişiden azken 4°, 60'tan azken 2° yaklaş (yumuşak)
    const wantNear = D.crowdN < 30 ? 4 : D.crowdN < 60 ? 2 : 0;
    D.near += (wantNear - D.near) * Math.min(1, dt * 0.8);
    camera.fov = CAM.fov - D.near - 4 * z - 0.6 * pulse;
    const s = D.shake * D.shake * 0.2;
    pos.copy(CAM.pos); look.copy(CAM.look);
    pos.x += Math.sin(time * 0.15) * 0.15 + (Math.random() - 0.5) * s;   // çok hafif nefes
    pos.y += (Math.random() - 0.5) * s;
    camera.position.copy(pos); camera.lookAt(look);
    camera.updateProjectionMatrix();
  };
  return D;
}
