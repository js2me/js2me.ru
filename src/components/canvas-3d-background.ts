import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

// Каждая строка фона: js2mejs2mejs2me... (повторяющаяся надпись)
const CHARS = ['j', 's', '2', 'm', 'e'];
const REPEATS_PER_ROW = 3; // сколько раз "js2me" в одной строке
const GRID_COLS = REPEATS_PER_ROW * CHARS.length; // 15 — в ряду ровно "js2mejs2mejs2me"
const GRID_ROWS = 5; // +1 сверху, +1 снизу — заполняют весь фон
const CHAR_SIZE = 1.25; // крупнее, чтобы буквы заполняли задний фон
const REFLECT_TINT = 0x1f67c4; // оттенок отблеска на металле (буквы остаются металлическими)

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let meshes: THREE.Mesh[] = [];
let frameId: number;
let canvasEl: HTMLCanvasElement | null = null;
const mouseWorld = { x: 0, y: 0 };
const mouseTarget = { x: 0, y: 0 };
let hasMouse = false;

const REPEL_RADIUS = 2.8;
const REPEL_STRENGTH = 4.7;
const MOUSE_LERP = 0.14;
/** Сила поворота букв в сторону курсора (0..1) когда мышь в радиусе */
const LOOK_AT_STRENGTH = 0.3;
/** Плавность поворота к курсору (0.1 = медленно, 0.3 = быстрее) — убирает резкие скачки */
const ROTATION_LERP = 0.11;
/** Увеличение букв в радиусе: чем дальше от курсора — тем крупнее */
const SCALE_AMOUNT = 0.14;
/** Отодвигаемые буквы смещаются вперёд по Z (визуально поверх остальных) */
const Z_ABOVE = 0.2;
/** Подъём отодвигаемых букв вверх по Y (чем сильнее отталкивание — тем выше) */
const Y_RISE = 0.18;
/** Плавность перехода подъёма/масштаба/Z (0.06 = медленнее, 0.15 = быстрее) */
const LIFT_LERP = 0.075;

const tempLookAt = new THREE.Object3D();
const targetQuat = new THREE.Quaternion();
const restQuat = new THREE.Quaternion();
const lookAtQuat = new THREE.Quaternion();
const restEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function createMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x4a443c, // нейтральный металл (бронза/серый)
    metalness: 0.85,
    roughness: 0.28,
    envMapIntensity: 1.3,
    clearcoat: 0.45,
    clearcoatRoughness: 0.2,
  });
}

const vec = new THREE.Vector3();
const dir = new THREE.Vector3();

export function setMousePosition(clientX: number, clientY: number): void {
  if (!canvasEl || !camera) return;
  const rect = canvasEl.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  vec.set(ndcX, ndcY, 0.5).unproject(camera);
  dir.copy(vec).sub(camera.position).normalize();
  const t = -camera.position.z / dir.z;
  mouseTarget.x = camera.position.x + t * dir.x;
  mouseTarget.y = camera.position.y + t * dir.y;
  hasMouse = true;
}

export function clearMousePosition(): void {
  hasMouse = false;
}

export function initCanvas3D(container: HTMLCanvasElement): void {
  // Перед повторной инициализацией (например после astro:page-load) полностью очищаем предыдущее состояние
  disposeCanvas3D();

  canvasEl = container;
  const width = container.clientWidth;
  const height = container.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
  camera.position.set(0, 0, 7);
  camera.lookAt(0, 0, 0);

  const loader = new FontLoader();
  loader.load('/fonts/helvetiker_bold.typeface.json', (font) => {
    const material = createMaterial();
    // Строгий шаг сетки: построчно читается "js2mejs2mejs2me"
    const spacingX = 1.35;
    const spacingY = 1.33 + 24 / 140; // + ещё ~24px по вертикали между строками
    const offsetX = ((GRID_COLS - 1) * spacingX) / 2;
    const offsetY = ((GRID_ROWS - 1) * spacingY) / 2;

    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const char = CHARS[(row * GRID_COLS + col) % CHARS.length];
        const geom = new TextGeometry(char, {
          font,
          size: CHAR_SIZE,
          depth: 0.2,
          curveSegments: 10,
          bevelEnabled: true,
          bevelThickness: 0.04,
          bevelSize: 0.04,
          bevelSegments: 2,
        });
        geom.center();
        const mesh = new THREE.Mesh(geom, material.clone());
        // Строго по сетке, без случайных смещений — построчное отображение
        const baseX = col * spacingX - offsetX;
        const baseY = row * spacingY - offsetY;
        mesh.position.x = baseX;
        mesh.position.y = baseY;
        mesh.userData.baseX = baseX;
        mesh.userData.baseY = baseY;
        mesh.userData.currentZ = 0;
        mesh.userData.currentYRise = 0;
        mesh.userData.currentScale = 1;
        mesh.rotation.z = 0;
        mesh.rotation.y = 0;
        scene.add(mesh);
        meshes.push(mesh);
      }
    }

    // Металл остаётся металлом; отблески — оттенок #1f67c4
    const ambient = new THREE.AmbientLight(0x333333);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.95); // основной свет — белый
    dir.position.set(3, 2, 4);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(REFLECT_TINT, 0.5); // отблеск 1f67c4
    fill.position.set(-2, -1, 3);
    scene.add(fill);
    const back = new THREE.DirectionalLight(REFLECT_TINT, 0.35);
    back.position.set(0, 0, -2);
    scene.add(back);
    const rim = new THREE.DirectionalLight(REFLECT_TINT, 0.28); // блики по краям
    rim.position.set(2, 1, 2);
    scene.add(rim);
  });

  renderer = new THREE.WebGLRenderer({ canvas: container, alpha: false, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  function animate() {
    frameId = requestAnimationFrame(animate);
    if (hasMouse) {
      mouseWorld.x += (mouseTarget.x - mouseWorld.x) * MOUSE_LERP;
      mouseWorld.y += (mouseTarget.y - mouseWorld.y) * MOUSE_LERP;
    }
    const t = performance.now() * 0.0012;
    meshes.forEach((m, i) => {
      const baseX = m.userData.baseX as number;
      const baseY = m.userData.baseY as number;
      let dist = 0;

      let targetZ = 0;
      let targetYRise = 0;
      let targetScale = 1;
      let repelY = 0;

      if (hasMouse) {
        const dx = baseX - mouseWorld.x;
        const dy = baseY - mouseWorld.y;
        dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL_RADIUS && dist > 0.001) {
          const falloff = 1 - dist / REPEL_RADIUS;
          const force = falloff * falloff * REPEL_STRENGTH;
          const nx = dx / dist;
          const ny = dy / dist;
          m.position.x = baseX + nx * force;
          repelY = ny * force;
          targetZ = Z_ABOVE;
          targetYRise = falloff * Y_RISE;
          targetScale = 1 + (dist / REPEL_RADIUS) * SCALE_AMOUNT;
        } else {
          m.position.x = baseX;
        }
      } else {
        m.position.x = baseX;
      }

      const curZ = (m.userData.currentZ as number) ?? 0;
      const curYRise = (m.userData.currentYRise as number) ?? 0;
      const curScale = (m.userData.currentScale as number) ?? 1;
      m.userData.currentZ = curZ + (targetZ - curZ) * LIFT_LERP;
      m.userData.currentYRise = curYRise + (targetYRise - curYRise) * LIFT_LERP;
      m.userData.currentScale = curScale + (targetScale - curScale) * LIFT_LERP;

      m.position.y = baseY + repelY + (m.userData.currentYRise as number);
      m.position.z = m.userData.currentZ as number;
      m.scale.setScalar(m.userData.currentScale as number);

      const phase = i * 0.18;
      const restY = Math.sin(t + phase) * 0.35;
      const restX = Math.sin(t * 0.7 + phase * 1.3) * 0.12;
      const restZ = Math.sin(t * 0.5 + phase * 0.8) * 0.08;

      restEuler.set(restX, restY, restZ, 'YXZ');
      restQuat.setFromEuler(restEuler);

      if (hasMouse) {
        if (dist < REPEL_RADIUS && dist > 0.001) {
          const blend = (1 - dist / REPEL_RADIUS) * LOOK_AT_STRENGTH;
          tempLookAt.position.set(m.position.x, m.position.y, m.position.z);
          tempLookAt.lookAt(mouseWorld.x, mouseWorld.y, 0);
          lookAtQuat.copy(tempLookAt.quaternion);
          targetQuat.slerpQuaternions(restQuat, lookAtQuat, blend);
        } else {
          targetQuat.copy(restQuat);
        }
      } else {
        targetQuat.copy(restQuat);
      }

      m.quaternion.slerp(targetQuat, ROTATION_LERP);
    });
    renderer.render(scene, camera);
  }
  frameId = requestAnimationFrame(animate);
}

export function resizeCanvas3D(container: HTMLCanvasElement): void {
  if (!camera || !renderer) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

export function disposeCanvas3D(): void {
  canvasEl = null;
  hasMouse = false;
  if (frameId) {
    cancelAnimationFrame(frameId);
    frameId = 0;
  }
  meshes.forEach((m) => {
    m.geometry.dispose();
    if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
    else m.material.dispose();
  });
  meshes = [];
  renderer?.dispose();
}
