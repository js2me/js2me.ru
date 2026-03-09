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

export function initCanvas3D(container: HTMLCanvasElement): void {
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
        mesh.position.x = col * spacingX - offsetX;
        mesh.position.y = row * spacingY - offsetY;
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
    const t = performance.now() * 0.0012;
    // Анимированный поворот букв — виден объём и глубина (эффект 3D)
    meshes.forEach((m, i) => {
      const phase = i * 0.18;
      m.rotation.y = Math.sin(t + phase) * 0.35; // поворот влево-вправо, видна толщина
      m.rotation.x = Math.sin(t * 0.7 + phase * 1.3) * 0.12; // лёгкий наклон вверх-вниз
      m.rotation.z = Math.sin(t * 0.5 + phase * 0.8) * 0.08; // лёгкий поворот в плоскости
    });
    renderer.render(scene, camera);
  }
  animate();
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
  if (frameId) cancelAnimationFrame(frameId);
  meshes.forEach((m) => {
    m.geometry.dispose();
    if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
    else m.material.dispose();
  });
  meshes = [];
  renderer?.dispose();
}
