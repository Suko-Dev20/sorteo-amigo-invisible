import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import * as THREE from 'three';

export type Gift3DStage = 'idle' | 'opening' | 'diving' | 'revealed';

interface BurtonGift3DCanvasProps {
  stage: Gift3DStage;
  leftDone: boolean;
  rightDone: boolean;
  onLeftPullChange: (value: number) => void;
  onRightPullChange: (value: number) => void;
  onLeftDone: () => void;
  onRightDone: () => void;
}

/** Textura procedural de raso a rayas estilo Jack Skellington con ribete dorado */
function createBurtonStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Fondo marfil hueso
  ctx.fillStyle = '#f2ead7';
  ctx.fillRect(0, 0, 256, 256);

  // Rayas oscuras verticales/diagonales elegantes
  ctx.fillStyle = '#131022';
  const stripeW = 24;
  for (let x = 0; x < 256; x += stripeW * 2) {
    ctx.fillRect(x, 0, stripeW, 256);
  }

  // Ribete dorado fino en los bordes laterales del raso
  ctx.fillStyle = '#e3b25a';
  ctx.fillRect(0, 0, 8, 256);
  ctx.fillRect(248, 0, 8, 256);

  // Brillo sutil satinado
  const sheen = ctx.createLinearGradient(0, 0, 256, 0);
  sheen.addColorStop(0, 'rgba(0,0,0,0.22)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.14)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Textura procedural de terciopelo carmesí oscuro con marco cosido estilo Tim Burton */
function createVelvetBoxTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(256, 210, 40, 256, 256, 360);
  grad.addColorStop(0, '#9e1c36');
  grad.addColorStop(0.6, '#6e1125');
  grad.addColorStop(1, '#3d0816');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Textura sutil de papel/terciopelo
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,245,225,0.03)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Costura decorativa uniforme cerca del borde
  ctx.strokeStyle = 'rgba(242, 234, 215, 0.32)';
  ctx.lineWidth = 4;
  ctx.setLineDash([14, 12]);
  ctx.strokeRect(28, 28, 456, 456);

  // Marco interior fino dorado
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(227, 178, 90, 0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, 484, 484);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Sprite circular luminoso para partículas mágicas 3D */
function createGlowSpriteTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 250, 224, 1)');
  grad.addColorStop(0.35, 'rgba(227, 178, 90, 0.8)');
  grad.addColorStop(0.7, 'rgba(167, 125, 216, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Geometría rectangular con esquinas suavemente biseladas (sin huecos ni aristas cortantes) */
function createRoundedSlab(width: number, depth: number, height: number, radius = 0.08) {
  const w = width / 2 - radius;
  const d = depth / 2 - radius;
  const shape = new THREE.Shape();
  shape.moveTo(-w, -d - radius);
  shape.lineTo(w, -d - radius);
  shape.quadraticCurveTo(w + radius, -d - radius, w + radius, -d);
  shape.lineTo(w + radius, d);
  shape.quadraticCurveTo(w + radius, d + radius, w, d + radius);
  shape.lineTo(-w, d + radius);
  shape.quadraticCurveTo(-w - radius, d + radius, -w - radius, d);
  shape.lineTo(-w - radius, -d);
  shape.quadraticCurveTo(-w - radius, -d - radius, -w, -d - radius);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.035,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

/** Crea una mitad del lazo 3D (bucle abullonado + cola rizada + bolita dorada de agarre) */
function createHalfBow(
  side: -1 | 1,
  ribbonMat: THREE.MeshStandardMaterial,
  goldMat: THREE.MeshStandardMaterial
) {
  const group = new THREE.Group();

  // Bucle curvo principal en 3D
  const loopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(side * 0.42, 0.56, 0.14),
    new THREE.Vector3(side * 1.05, 0.48, 0.05),
    new THREE.Vector3(side * 1.12, 0.16, -0.06),
    new THREE.Vector3(side * 0.52, 0.02, -0.04),
    new THREE.Vector3(0, 0.04, 0),
  ]);
  const loopGeo = new THREE.TubeGeometry(loopCurve, 44, 0.13, 12, false);
  // Aplanar ligeramente en Z para que parezca cinta de raso real y no un tubo redondo
  loopGeo.scale(1, 0.92, 0.52);
  const loopMesh = new THREE.Mesh(loopGeo, ribbonMat);
  loopMesh.castShadow = true;
  group.add(loopMesh);

  // Segundo bucle ligeramente más pequeño y girado para volumen escultórico
  const innerCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.04, 0),
    new THREE.Vector3(side * 0.34, 0.44, -0.18),
    new THREE.Vector3(side * 0.85, 0.34, -0.26),
    new THREE.Vector3(side * 0.78, 0.08, -0.14),
    new THREE.Vector3(0, 0.04, 0),
  ]);
  const innerGeo = new THREE.TubeGeometry(innerCurve, 34, 0.1, 10, false);
  innerGeo.scale(1, 0.9, 0.5);
  const innerMesh = new THREE.Mesh(innerGeo, ribbonMat);
  group.add(innerMesh);

  // Cola fluida cayendo elegantemente hacia afuera (de donde tiras)
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * 0.08, 0.04, 0.06),
    new THREE.Vector3(side * 0.55, 0.02, 0.34),
    new THREE.Vector3(side * 1.08, -0.06, 0.52),
    new THREE.Vector3(side * 1.48, -0.14, 0.42),
  ]);
  const tailGeo = new THREE.TubeGeometry(tailCurve, 32, 0.075, 10, false);
  tailGeo.scale(1, 0.48, 1);
  const tailMesh = new THREE.Mesh(tailGeo, ribbonMat);
  group.add(tailMesh);

  // Borla / perla dorada luminosa justo en la punta del lazo para agarrar intuitivamente
  const tipOrb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 20), goldMat);
  tipOrb.position.set(side * 1.5, -0.14, 0.42);
  tipOrb.name = side === -1 ? 'left-tip' : 'right-tip';
  group.add(tipOrb);

  return { group, tipOrb };
}

export function BurtonGift3DCanvas({
  stage,
  leftDone,
  rightDone,
  onLeftPullChange,
  onRightPullChange,
  onLeftDone,
  onRightDone,
}: BurtonGift3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Refs mutables para el bucle de renderizado WebGL a 60fps sin re-montar la escena
  const stateRef = useRef({
    stage,
    leftTarget: 0,
    rightTarget: 0,
    leftSmooth: 0,
    rightSmooth: 0,
    leftDone,
    rightDone,
    openAnimTime: 0,
    diveAnimTime: 0,
  });

  stateRef.current.stage = stage;
  stateRef.current.leftDone = leftDone;
  stateRef.current.rightDone = rightDone;
  if (leftDone) stateRef.current.leftTarget = 1;
  if (rightDone) stateRef.current.rightTarget = 1;

  // Posiciones 2D proyectadas desde los extremos reales del lazo 3D para indicadores súper integrados
  const [tips2D, setTips2D] = useState<{
    left: { x: number; y: number };
    right: { x: number; y: number };
  }>({
    left: { x: 22, y: 36 },
    right: { x: 78, y: 36 },
  });

  const dragRef = useRef<{
    side: 'left' | 'right' | null;
    startX: number;
    startY: number;
  }>({ side: null, startX: 0, startY: 0 });
  const [activeSide, setActiveSide] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 320;

    // 1. Escena, Cámara y Renderer transparente con antialiasing nítido
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.set(0, 2.35, 6.2);
    camera.lookAt(0, 0.15, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Iluminación nocturna cinematográfica estilo Tim Burton
    const ambient = new THREE.AmbientLight('#8f84b8', 0.85);
    scene.add(ambient);

    // Luz de luna principal fría-marfil desde arriba-izquierda
    const moonLight = new THREE.DirectionalLight('#f4ecd6', 2.0);
    moonLight.position.set(-4, 6.5, 5);
    scene.add(moonLight);

    // Luz de recorte dorada desde la derecha para perfilar biseles y lazos
    const rimLight = new THREE.DirectionalLight('#e3b25a', 1.35);
    rimLight.position.set(5, 3, -3.5);
    scene.add(rimLight);

    // Luz de relleno violeta suave por abajo
    const fillLight = new THREE.PointLight('#6a4fa3', 1.2, 12);
    fillLight.position.set(-3, -2, 3);
    scene.add(fillLight);

    // 3. Materiales y texturas procedurales
    const velvetTex = createVelvetBoxTexture();
    const stripeTex = createBurtonStripeTexture();
    const glowTex = createGlowSpriteTexture();

    const boxMat = new THREE.MeshStandardMaterial({
      map: velvetTex,
      roughness: 0.52,
      metalness: 0.08,
    });
    const innerVelvetMat = new THREE.MeshStandardMaterial({
      color: '#1b0b1a',
      roughness: 0.85,
      metalness: 0.05,
    });
    const ribbonMat = new THREE.MeshStandardMaterial({
      map: stripeTex,
      roughness: 0.3,
      metalness: 0.12,
      transparent: true,
      opacity: 1,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: '#e5b860',
      roughness: 0.25,
      metalness: 0.78,
      emissive: '#6e4910',
      emissiveIntensity: 0.35,
    });

    // 4. Grupo raíz de la caja de regalo 3D (hueca por dentro, paredes gruesas, cero huecos)
    const giftRoot = new THREE.Group();
    scene.add(giftRoot);

    const W = 2.55;
    const H = 1.65;
    const D = 2.55;
    const T = 0.14; // Grosor real de las paredes

    // Suelo sólido
    const floorMesh = new THREE.Mesh(createRoundedSlab(W, D, T, 0.07), boxMat);
    floorMesh.position.y = -H / 2 + T / 2;
    giftRoot.add(floorMesh);

    // 4 Paredes sólidas encajadas sin rendijas
    const wallFront = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), boxMat);
    wallFront.position.set(0, 0, D / 2 - T / 2);
    giftRoot.add(wallFront);

    const wallBack = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), boxMat);
    wallBack.position.set(0, 0, -D / 2 + T / 2);
    giftRoot.add(wallBack);

    const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(T, H, D - T * 1.9), boxMat);
    wallLeft.position.set(-W / 2 + T / 2, 0, 0);
    giftRoot.add(wallLeft);

    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(T, H, D - T * 1.9), boxMat);
    wallRight.position.set(W / 2 - T / 2, 0, 0);
    giftRoot.add(wallRight);

    // Forro interior de terciopelo oscuro en el fondo y bordes dorados superiores
    const innerFloor = new THREE.Mesh(new THREE.PlaneGeometry(W - T * 2, D - T * 2), innerVelvetMat);
    innerFloor.rotation.x = -Math.PI / 2;
    innerFloor.position.y = -H / 2 + T + 0.01;
    giftRoot.add(innerFloor);

    // Portal brillante en el fondo interior de la caja (visible al abrir y bucear dentro)
    const portalMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: '#ffefc2',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const portalGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), portalMat);
    portalGlow.rotation.x = -Math.PI / 2;
    portalGlow.position.y = -H / 2 + T + 0.03;
    giftRoot.add(portalGlow);

    // Luz cálida INTERIOR que se enciende al abrirse la tapa
    const innerPointLight = new THREE.PointLight('#ffdb8a', 0, 10);
    innerPointLight.position.set(0, -0.1, 0);
    giftRoot.add(innerPointLight);

    // Moldura dorada fina en el borde inferior de la caja
    const baseTrim = new THREE.Mesh(createRoundedSlab(W + 0.05, D + 0.05, 0.06, 0.07), goldMat);
    baseTrim.position.y = -H / 2 + 0.02;
    giftRoot.add(baseTrim);

    // Cintas de raso envolviendo el cuerpo de la caja (se aflojan y desaparecen al desatar)
    const bodyStrapsGroup = new THREE.Group();
    const strapW = 0.38;
    const strapZ = new THREE.Mesh(new THREE.BoxGeometry(strapW, H + 0.02, D + 0.045), ribbonMat);
    const strapX = new THREE.Mesh(new THREE.BoxGeometry(W + 0.045, H + 0.02, strapW), ribbonMat);
    bodyStrapsGroup.add(strapZ, strapX);
    giftRoot.add(bodyStrapsGroup);

    // 5. TAPA 3D SÓLIDA BISELADA CON BISAGRA TRASERA REAL (CERO HUECOS)
    const LW = W + 0.22;
    const LD = D + 0.22;
    const LH = 0.36;
    const LT = 0.11;

    const lidPivot = new THREE.Group();
    // Bisagra exacta en el borde superior trasero de la caja
    lidPivot.position.set(0, H / 2, -LD / 2);
    giftRoot.add(lidPivot);

    const lidGroup = new THREE.Group();
    // Desplazado hacia adelante desde la bisagra para quedar centrado sobre la caja
    lidGroup.position.set(0, 0.05, LD / 2);
    lidPivot.add(lidGroup);

    // Placa superior biselada (una sola pieza maciza redondeada)
    const lidTop = new THREE.Mesh(createRoundedSlab(LW, LD, 0.12, 0.09), boxMat);
    lidTop.position.y = LH / 2 - 0.05;
    lidGroup.add(lidTop);

    // 4 faldones sólidos de la tapa perfectamente solapados con la placa superior
    const skirtFront = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.02, LH, LT), boxMat);
    skirtFront.position.set(0, 0, LD / 2 - LT / 2);
    lidGroup.add(skirtFront);

    const skirtBack = new THREE.Mesh(new THREE.BoxGeometry(LW - 0.02, LH, LT), boxMat);
    skirtBack.position.set(0, 0, -LD / 2 + LT / 2);
    lidGroup.add(skirtBack);

    const skirtLeft = new THREE.Mesh(new THREE.BoxGeometry(LT, LH, LD - LT * 1.8), boxMat);
    skirtLeft.position.set(-LW / 2 + LT / 2, 0, 0);
    lidGroup.add(skirtLeft);

    const skirtRight = new THREE.Mesh(new THREE.BoxGeometry(LT, LH, LD - LT * 1.8), boxMat);
    skirtRight.position.set(LW / 2 - LT / 2, 0, 0);
    lidGroup.add(skirtRight);

    // Ribete dorado uniforme alrededor del borde inferior de la tapa
    const lidRimFront = new THREE.Mesh(new THREE.BoxGeometry(LW + 0.02, 0.045, 0.045), goldMat);
    lidRimFront.position.set(0, -LH / 2 + 0.01, LD / 2);
    const lidRimBack = lidRimFront.clone();
    lidRimBack.position.z = -LD / 2;
    const lidRimLeft = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, LD + 0.02), goldMat);
    lidRimLeft.position.set(-LW / 2, -LH / 2 + 0.01, 0);
    const lidRimRight = lidRimLeft.clone();
    lidRimRight.position.x = LW / 2;
    lidGroup.add(lidRimFront, lidRimBack, lidRimLeft, lidRimRight);

    // Cintas de raso abrazando la tapa
    const lidStrapsGroup = new THREE.Group();
    const lidStrapZ = new THREE.Mesh(
      new THREE.BoxGeometry(strapW, LH + 0.09, LD + 0.045),
      ribbonMat
    );
    lidStrapZ.position.y = 0.03;
    const lidStrapX = new THREE.Mesh(
      new THREE.BoxGeometry(LW + 0.045, LH + 0.09, strapW),
      ribbonMat
    );
    lidStrapX.position.y = 0.03;
    lidStrapsGroup.add(lidStrapZ, lidStrapX);
    lidGroup.add(lidStrapsGroup);

    // 6. LAZO ESCULTÓRICO 3D REAL MONTADO ENCIMA DE LA TAPA
    const bowRoot = new THREE.Group();
    bowRoot.position.set(0, LH / 2 + 0.05, 0);
    lidGroup.add(bowRoot);

    const { group: leftBow, tipOrb: leftTipOrb } = createHalfBow(-1, ribbonMat, goldMat);
    const { group: rightBow, tipOrb: rightTipOrb } = createHalfBow(1, ribbonMat, goldMat);
    bowRoot.add(leftBow, rightBow);

    // Nudo central con broche lunar dorado
    const knotGroup = new THREE.Group();
    const knotCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 20), ribbonMat);
    knotCore.scale.set(1.15, 0.85, 1.05);
    knotCore.position.y = 0.08;
    const knotRing = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.032, 12, 28), goldMat);
    knotRing.rotation.x = Math.PI / 2;
    knotRing.position.y = 0.14;
    knotGroup.add(knotCore, knotRing);
    bowRoot.add(knotGroup);

    // 7. PARTÍCULAS MÁGICAS 3D DENTRO Y ALREDEDOR DE LA CAJA (220 estrellas doradas/violetas)
    const particleCount = 220;
    const pPositions = new Float32Array(particleCount * 3);
    const pSpeeds = new Float32Array(particleCount);
    const pRadii = new Float32Array(particleCount);
    const pAngles = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.12 + Math.random() * 1.15;
      pAngles[i] = angle;
      pRadii[i] = radius;
      pSpeeds[i] = 0.5 + Math.random() * 1.4;
      pPositions[i * 3] = Math.cos(angle) * radius;
      pPositions[i * 3 + 1] = -0.5 + Math.random() * 2.2;
      pPositions[i * 3 + 2] = Math.sin(angle) * radius;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const particleMat = new THREE.PointsMaterial({
      map: glowTex,
      color: '#ffefc2',
      size: 0.24,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    giftRoot.add(particles);

    // Resize responsive
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 8. Bucle de animación 60fps súper fluido
    let rafId = 0;
    let lastTime = performance.now();
    const projLeft = new THREE.Vector3();
    const projRight = new THREE.Vector3();
    let frameCounter = 0;

    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      const t = now * 0.001;
      const st = stateRef.current;

      // Suavizado elástico de ambos lazos
      const lerp = 1 - Math.exp(-12 * dt);
      st.leftSmooth += (st.leftTarget - st.leftSmooth) * lerp;
      st.rightSmooth += (st.rightTarget - st.rightSmooth) * lerp;
      const lp = st.leftSmooth;
      const rp = st.rightSmooth;
      const avgPull = (lp + rp) / 2;

      // Deformación física 3D de cada mitad del lazo al tirar
      leftBow.position.set(-lp * 1.45, lp * 0.16 - lp * lp * 0.45, lp * 0.2);
      leftBow.rotation.set(lp * 0.25, -lp * 0.45, lp * 0.65);
      leftBow.scale.set(1 + lp * 0.25, Math.max(0.3, 1 - lp * 0.42), 1);

      rightBow.position.set(rp * 1.45, rp * 0.16 - rp * rp * 0.45, rp * 0.2);
      rightBow.rotation.set(rp * 0.25, rp * 0.45, -rp * 0.65);
      rightBow.scale.set(1 + rp * 0.25, Math.max(0.3, 1 - rp * 0.42), 1);

      // Nudo central se eleva y se desvanece al soltar ambos lazos
      knotGroup.position.y = avgPull * 0.45;
      knotGroup.rotation.y = avgPull * 1.4;
      knotGroup.scale.setScalar(Math.max(0.01, 1 - Math.max(0, avgPull - 0.55) * 2.2));

      // Pulso cálido en las bolitas doradas de agarre
      const pulse = 1 + Math.sin(t * 4.2) * 0.16;
      leftTipOrb.scale.setScalar(st.leftDone ? 0.01 : pulse);
      rightTipOrb.scale.setScalar(st.rightDone ? 0.01 : pulse);

      // Opacidad y caída de las cintas alrededor de la caja
      if (st.stage === 'idle') {
        ribbonMat.opacity = Math.max(0.15, 1 - avgPull * 0.85);
        bodyStrapsGroup.position.y = -avgPull * 0.28;
        lidPivot.rotation.x = -avgPull * 0.22; // Se entreabre ligeramente al tirar

        // Flotación suave + inclinación física hacia el lado del que tiras
        giftRoot.position.y = Math.sin(t * 1.8) * 0.08;
        giftRoot.rotation.y = -0.32 + Math.sin(t * 0.85) * 0.1 + (rp - lp) * 0.42;
        giftRoot.rotation.x = 0.06 + avgPull * 0.08;

        innerPointLight.intensity = avgPull * 2.5;
        particleMat.opacity = avgPull * 0.55;
      }

      if (st.stage === 'opening' || st.stage === 'diving') {
        st.openAnimTime += dt;
        const openEase = 1 - Math.pow(1 - Math.min(1, st.openAnimTime / 0.72), 3);

        // Desaparecen las cintas y el lazo
        ribbonMat.opacity = Math.max(0, 1 - st.openAnimTime * 3.2);
        bowRoot.visible = st.openAnimTime < 0.28;

        // Tapa 3D gira sobre su bisagra trasera suavemente hasta abrirse por completo
        lidPivot.rotation.x = -openEase * 2.15;

        // Centrar la caja para preparar la entrada de cámara
        giftRoot.rotation.y += (0 - giftRoot.rotation.y) * (1 - Math.exp(-7 * dt));
        giftRoot.rotation.x += (0 - giftRoot.rotation.x) * (1 - Math.exp(-7 * dt));
        giftRoot.position.y += (0 - giftRoot.position.y) * (1 - Math.exp(-7 * dt));

        // Luz interior y partículas estelares explotan hacia arriba
        innerPointLight.intensity = 2.5 + openEase * 8.5;
        particleMat.opacity = Math.min(1, 0.35 + openEase * 0.75);
        portalGlow.rotation.z = t * 0.9;
      }

      if (st.stage === 'diving') {
        st.diveAnimTime += dt;
        const u = Math.min(1, st.diveAnimTime / 1.3);
        // Curva cinemática suave (easeInOutCubic) para volar DENTRO de la caja 3D
        const ease = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;

        // La cámara describe un arco elegante sobre el borde y baja recta hacia el interior iluminado
        const camY = 2.35 + Math.sin(ease * Math.PI) * 1.45 - ease * 2.45;
        const camZ = 6.2 * (1 - ease) + 0.06 * ease;
        const lookY = 0.15 * (1 - ease) - 0.85 * ease;

        camera.position.set(0, camY, camZ);
        camera.lookAt(0, lookY, 0);
        camera.fov = 42 + ease * 36; // Efecto gran angular de inmersión 3D
        camera.updateProjectionMatrix();

        innerPointLight.intensity = 10 + ease * 14;
      }

      // Animar partículas 3D subiendo en espiral desde el interior
      if (particleMat.opacity > 0.02) {
        const pos = particleGeo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < particleCount; i++) {
          pAngles[i] += dt * (0.7 + pSpeeds[i] * 0.4);
          let py = pos.getY(i) + dt * pSpeeds[i] * (st.stage === 'diving' ? 2.4 : 1.1);
          if (py > 2.6) py = -0.6;
          const r = pRadii[i] * (0.65 + (py + 0.6) * 0.22);
          pos.setXYZ(i, Math.cos(pAngles[i]) * r, py, Math.sin(pAngles[i]) * r);
        }
        pos.needsUpdate = true;
      }

      renderer.render(scene, camera);

      // Proyectar coordenadas 3D de las bolitas de agarre a % de pantalla cada 2 frames
      frameCounter++;
      if (st.stage === 'idle' && frameCounter % 2 === 0) {
        leftTipOrb.getWorldPosition(projLeft);
        rightTipOrb.getWorldPosition(projRight);
        projLeft.project(camera);
        projRight.project(camera);

        setTips2D({
          left: {
            x: Math.max(8, Math.min(92, (projLeft.x * 0.5 + 0.5) * 100)),
            y: Math.max(10, Math.min(88, (-projLeft.y * 0.5 + 0.5) * 100)),
          },
          right: {
            x: Math.max(8, Math.min(92, (projRight.x * 0.5 + 0.5) * 100)),
            y: Math.max(10, Math.min(88, (-projRight.y * 0.5 + 0.5) * 100)),
          },
        });
      }

      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      velvetTex.dispose();
      stripeTex.dispose();
      glowTex.dispose();
      boxMat.dispose();
      innerVelvetMat.dispose();
      ribbonMat.dispose();
      goldMat.dispose();
      portalMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // --- Interacción directa e intuitiva sobre la caja/lazos 3D ---
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stage !== 'idle') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;

    let chosen: 'left' | 'right' | null = null;
    if (!leftDone && !rightDone) {
      chosen = relX < 0.5 ? 'left' : 'right';
    } else if (!leftDone) {
      chosen = 'left';
    } else if (!rightDone) {
      chosen = 'right';
    }

    if (!chosen) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { side: chosen, startX: e.clientX, startY: e.clientY };
    setActiveSide(chosen);
    navigator.vibrate?.(12);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const side = dragRef.current.side;
    if (!side || stage !== 'idle') return;

    const dx =
      side === 'left'
        ? dragRef.current.startX - e.clientX
        : e.clientX - dragRef.current.startX;
    const dy = Math.abs(e.clientY - dragRef.current.startY) * 0.35;
    const raw = (Math.max(0, dx) + dy) / 88;
    const progress = Math.max(0, Math.min(1, raw));

    if (side === 'left') {
      stateRef.current.leftTarget = progress;
      onLeftPullChange(progress);
      if (progress >= 0.85) {
        dragRef.current.side = null;
        setActiveSide(null);
        stateRef.current.leftTarget = 1;
        onLeftDone();
        navigator.vibrate?.(25);
      }
    } else {
      stateRef.current.rightTarget = progress;
      onRightPullChange(progress);
      if (progress >= 0.85) {
        dragRef.current.side = null;
        setActiveSide(null);
        stateRef.current.rightTarget = 1;
        onRightDone();
        navigator.vibrate?.(25);
      }
    }
  };

  const handlePointerUp = () => {
    const side = dragRef.current.side;
    if (!side || stage !== 'idle') return;
    dragRef.current.side = null;
    setActiveSide(null);

    if (side === 'left') {
      if (stateRef.current.leftTarget >= 0.6) {
        stateRef.current.leftTarget = 1;
        onLeftDone();
        navigator.vibrate?.(25);
      } else {
        stateRef.current.leftTarget = 0;
        onLeftPullChange(0);
      }
    } else {
      if (stateRef.current.rightTarget >= 0.6) {
        stateRef.current.rightTarget = 1;
        onRightDone();
        navigator.vibrate?.(25);
      } else {
        stateRef.current.rightTarget = 0;
        onRightPullChange(0);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className={`relative mx-auto h-76 w-full select-none sm:h-80 ${
        stage === 'idle'
          ? activeSide
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : 'cursor-default'
      }`}
    >
      {/* Indicadores mínimos pegados en tiempo real a las puntas doradas del lazo 3D */}
      {stage === 'idle' && !leftDone && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200"
          style={{
            left: `${tips2D.left.x}%`,
            top: `${tips2D.left.y}%`,
            opacity: activeSide === 'right' ? 0.3 : 1,
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e3b25a]/85 bg-[#141122]/65 text-sm font-bold text-[#f8eed8] shadow-[0_0_20px_rgba(227,178,90,0.65)] backdrop-blur-[2px]">
            ←
          </span>
        </div>
      )}

      {stage === 'idle' && !rightDone && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-200"
          style={{
            left: `${tips2D.right.x}%`,
            top: `${tips2D.right.y}%`,
            opacity: activeSide === 'left' ? 0.3 : 1,
          }}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e3b25a]/85 bg-[#141122]/65 text-sm font-bold text-[#f8eed8] shadow-[0_0_20px_rgba(227,178,90,0.65)] backdrop-blur-[2px]">
            →
          </span>
        </div>
      )}
    </div>
  );
}
