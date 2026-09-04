import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// A physical instrument, not a logo: a glass prism suspended in a dark
// measurement volume, splitting one beam of light into a continuous,
// desaturated spectrum. Rendered with real refraction (IOR ~1.5, glass),
// not an emissive glow. Pointer movement reads as inspecting the object
// from different angles, not a decorative parallax trick.
export default function PrismInstrument({ className }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const state = { raf: 0, w: 0, h: 0 };

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.35, 8.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // --- environment: a soft studio gradient used only for reflections/refractions ---
    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(20, 32, 32);
    const envCanvas = document.createElement('canvas');
    envCanvas.width = 2;
    envCanvas.height = 256;
    const ectx = envCanvas.getContext('2d');
    const grad = ectx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#3a382f');
    grad.addColorStop(0.45, '#141311');
    grad.addColorStop(1, '#040403');
    ectx.fillStyle = grad;
    ectx.fillRect(0, 0, 2, 256);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.colorSpace = THREE.SRGBColorSpace;
    const envMat = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;

    // --- the prism: a real triangular glass prism, physically proportioned ---
    const prismGroup = new THREE.Group();

    const h = 2.1; // prism length
    const triShape = new THREE.Shape();
    const r = 1.05;
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + (i * (Math.PI * 2)) / 3;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) triShape.moveTo(x, y);
      else triShape.lineTo(x, y);
    }
    triShape.closePath();
    const prismGeo = new THREE.ExtrudeGeometry(triShape, {
      depth: h,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
      curveSegments: 1,
    });
    prismGeo.rotateX(Math.PI / 2);
    prismGeo.translate(0, 0, -h / 2);
    prismGeo.computeVertexNormals();

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xf3f1ea,
      metalness: 0,
      roughness: 0.02,
      transmission: 1,
      thickness: 1.6,
      ior: 1.52,
      envMap,
      envMapIntensity: 1.1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      attenuationColor: new THREE.Color(0xf7efe0),
      attenuationDistance: 3.2,
    });

    const prism = new THREE.Mesh(prismGeo, glassMat);
    prism.rotation.y = Math.PI / 5;
    prismGroup.add(prism);

    // fine edge lines to read as a precise, engineered object, not a blob
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(prismGeo, 20),
      new THREE.LineBasicMaterial({ color: 0x2a2822, transparent: true, opacity: 0.35 })
    );
    edges.rotation.copy(prism.rotation);
    prismGroup.add(edges);

    scene.add(prismGroup);

    // --- incoming beam (single, warm-white, understated) ---
    const beamInGeo = new THREE.CylinderGeometry(0.012, 0.012, 4.6, 10, 1, true);
    const beamInMat = new THREE.MeshBasicMaterial({
      color: 0xf0e9da,
      transparent: true,
      opacity: 0.65,
    });
    const beamIn = new THREE.Mesh(beamInGeo, beamInMat);
    beamIn.rotation.z = Math.PI / 2;
    beamIn.position.set(-3.1, 0.02, 0);
    scene.add(beamIn);

    // --- dispersed spectrum: a fan of thin, desaturated rays (not neon) ---
    const spectrumColors = [
      0xb4756a, // muted red
      0xc79a5c, // amber
      0xb9b06a, // olive gold
      0x7fa585, // sage green
      0x6f93a8, // slate blue
      0x7f7fb0, // violet grey
    ];
    const rays = [];
    const rayGroup = new THREE.Group();
    spectrumColors.forEach((c, i) => {
      const spread = (i - (spectrumColors.length - 1) / 2) * 0.052;
      const geo = new THREE.CylinderGeometry(0.007, 0.007, 4.2, 8, 1, true);
      const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.5 });
      const ray = new THREE.Mesh(geo, mat);
      ray.rotation.z = Math.PI / 2 + spread * 0.55;
      ray.position.set(2.6, spread * 3.1, spread * 0.4);
      ray.userData.spread = spread;
      rayGroup.add(ray);
      rays.push(ray);
    });
    scene.add(rayGroup);

    // --- lighting: soft key + rim, no colored point lights (keeps glass honest) ---
    const key = new THREE.DirectionalLight(0xfff3df, 1.6);
    key.position.set(4, 5, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb3c9, 0.7);
    rim.position.set(-5, -2, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x2a2822, 0.5));

    // --- interaction: gentle inspection, not spin ---
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e) => {
      const rect = mount.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      pointer.tx = THREE.MathUtils.clamp(px, -1, 1);
      pointer.ty = THREE.MathUtils.clamp(py, -1, 1);
    };
    window.addEventListener('pointermove', onMove);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      state.w = rect.width;
      state.h = rect.height;
      renderer.setSize(state.w, state.h, false);
      camera.aspect = state.w / Math.max(state.h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let t = 0;
    const clock = new THREE.Clock();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animate = () => {
      state.raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      t += dt;

      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;

      if (!reduceMotion) {
        prismGroup.rotation.y = Math.PI / 5 + pointer.x * 0.35 + Math.sin(t * 0.15) * 0.05;
        prismGroup.rotation.x = pointer.y * -0.18;
        edges.rotation.y = prismGroup.rotation.y;
        edges.rotation.x = prismGroup.rotation.x;

        rays.forEach((ray, i) => {
          const flicker = Math.sin(t * 0.6 + i) * 0.05;
          ray.material.opacity = 0.38 + flicker * 0.4 + 0.12;
        });
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      window.removeEventListener('pointermove', onMove);
      mount.removeChild(renderer.domElement);
      prismGeo.dispose();
      glassMat.dispose();
      envGeo.dispose();
      envMat.dispose();
      envTex.dispose();
      pmrem.dispose();
      rays.forEach((r) => {
        r.geometry.dispose();
        r.material.dispose();
      });
      beamInGeo.dispose();
      beamInMat.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
