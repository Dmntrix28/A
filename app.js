import React, { useEffect, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import * as THREE from "https://unpkg.com/three@0.170.0/build/three.module.js";

const PHRASES = ["Te amo", "mi niña", "preciosa", "gracias", "por existir"];

function createCircleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.9)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function sampleTextTargets(text, count, worldW, worldH) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 700;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const ratio = worldW / worldH;
  const size = Math.max(160, Math.min(292, 236 * ratio));
  ctx.font = `900 ${size}px "Arial Black", "Segoe UI", "Arial", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(6, size * 0.055);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const targets = [];
  let attempts = 0;
  const maxAttempts = count * 80;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let y = 0; y < canvas.height; y += 4) {
    for (let x = 0; x < canvas.width; x += 4) {
      const idx = (y * canvas.width + x) * 4 + 3;
      if (data[idx] > 100) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!Number.isFinite(minX)) {
    return targets;
  }

  const pad = 24;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(canvas.width, maxX + pad);
  maxY = Math.min(canvas.height, maxY + pad);

  while (targets.length < count && attempts < maxAttempts) {
    attempts += 1;
    const x = minX + Math.random() * (maxX - minX);
    const y = minY + Math.random() * (maxY - minY);
    const idx = ((Math.floor(y) * canvas.width + Math.floor(x)) * 4) + 3;
    if (data[idx] > 112) {
      const textWidthFactor = ratio < 0.78 ? 0.92 : 0.82;
      const textHeightFactor = ratio < 0.78 ? 0.64 : 0.66;
      const nx = (x / canvas.width - 0.5) * worldW * textWidthFactor;
      const ny = (0.5 - y / canvas.height) * worldH * textHeightFactor;
      const swirl = 0.9;
      targets.push({
        x: nx + (Math.random() - 0.5) * swirl,
        y: ny + (Math.random() - 0.5) * swirl,
      });
    }
  }

  return targets;
}

function sampleHeartTargets(count, worldW, worldH) {
  const targets = [];
  const maxHalfWidth = worldW * 0.34;
  const maxHalfHeight = worldH * 0.3;
  const scale = Math.min(maxHalfWidth / 16, maxHalfHeight / 17);
  const contourCount = Math.floor(count * 0.45);

  for (let i = 0; i < contourCount; i += 1) {
    const t = (i / contourCount) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    targets.push({
      x: x * scale + (Math.random() - 0.5) * 1.0,
      y: y * scale + (Math.random() - 0.5) * 1.0,
    });
  }

  while (targets.length < count) {
    const x = (Math.random() * 2 - 1) * 18;
    const y = (Math.random() * 2 - 1) * 18;
    const equation = (x * x + y * y - 1) ** 3 - x * x * y ** 3;
    if (equation <= 0) {
      targets.push({
        x: x * scale,
        y: y * scale,
      });
    }
  }

  return targets;
}

function ParticleScene() {
  const mountRef = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    mount.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 220;

    const count = window.innerWidth < 600 ? 1800 : 2500;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = Array.from({ length: count }, () => ({ x: 0, y: 0 }));
    const targets = Array.from({ length: count }, () => ({ x: 0, y: 0, mode: "free" }));

    const baseColor = new THREE.Color();
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 260;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
      baseColor.setHSL(0.76 + Math.random() * 0.08, 0.65, 0.66);
      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: window.innerWidth < 600 ? 2.4 : 2.8,
      map: createCircleTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const pointer = { x: 10000, y: 10000, active: false };
    let mode = "ambient";
    let frame = 0;
    let seqStep = -1;
    let seqTimer = 0;

    const updateTargetsForText = (text) => {
      const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      const worldW = worldH * camera.aspect;
      const shape = sampleTextTargets(text, Math.floor(count * 0.8), worldW, worldH);

      for (let i = 0; i < count; i += 1) {
        if (i < shape.length) {
          const p = shape[i];
          targets[i].x = p.x;
          targets[i].y = p.y;
          targets[i].mode = "shape";
        } else {
          targets[i].x = (Math.random() - 0.5) * worldW;
          targets[i].y = (Math.random() - 0.5) * worldH;
          targets[i].mode = "free";
        }
      }
    };

    const updateTargetsForHeart = () => {
      const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
      const worldW = worldH * camera.aspect;
      const shape = sampleHeartTargets(Math.floor(count * 0.88), worldW, worldH);

      for (let i = 0; i < count; i += 1) {
        if (i < shape.length) {
          const p = shape[i];
          targets[i].x = p.x;
          targets[i].y = p.y;
          targets[i].mode = "heart";
        } else {
          targets[i].x = (Math.random() - 0.5) * worldW;
          targets[i].y = (Math.random() - 0.5) * worldH;
          targets[i].mode = "free";
        }
      }
    };

    const onPointerMove = (event) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = -(event.clientY / window.innerHeight) * 2 + 1;
      const vec = new THREE.Vector3(x, y, 0.5).unproject(camera);
      const dir = vec.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const pos = camera.position.clone().add(dir.multiplyScalar(distance));
      pointer.x = pos.x;
      pointer.y = pos.y;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
      pointer.x = 10000;
      pointer.y = 10000;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      material.size = window.innerWidth < 600 ? 2.4 : 2.8;
      if (mode === "heart") updateTargetsForHeart();
      if (mode === "text" && seqStep >= 0 && seqStep < PHRASES.length) {
        updateTargetsForText(PHRASES[seqStep]);
      }
    };

    window.addEventListener("resize", handleResize);

    const animate = () => {
      frame += 1;
      const pos = geometry.attributes.position.array;
      const col = geometry.attributes.color.array;

      if (started) {
        seqTimer += 1;
        if (seqStep < PHRASES.length && (seqStep === -1 || seqTimer > 280)) {
          seqStep += 1;
          seqTimer = 0;
          if (seqStep < PHRASES.length) {
            mode = "text";
            updateTargetsForText(PHRASES[seqStep]);
          } else {
            mode = "heart";
            updateTargetsForHeart();
          }
        }
      }

      for (let i = 0; i < count; i += 1) {
        const idx = i * 3;
        const px = pos[idx];
        const py = pos[idx + 1];

        const tx = targets[i].x;
        const ty = targets[i].y;
        const isShape = targets[i].mode !== "free";
        const pull = isShape ? 0.017 : 0.0028;

        velocities[i].x += (tx - px) * pull + (Math.random() - 0.5) * 0.02;
        velocities[i].y += (ty - py) * pull + (Math.random() - 0.5) * 0.02;

        if (!isShape) {
          velocities[i].x += Math.sin(frame * 0.007 + i * 0.3) * 0.009;
          velocities[i].y += Math.cos(frame * 0.006 + i * 0.2) * 0.009;
        }

        if (pointer.active) {
          const dx = px - pointer.x;
          const dy = py - pointer.y;
          const distSq = dx * dx + dy * dy;
          const radius = 1300;
          if (distSq < radius) {
            const f = (radius - distSq) / radius;
            velocities[i].x += (dx / Math.sqrt(distSq + 0.001)) * f * 0.12;
            velocities[i].y += (dy / Math.sqrt(distSq + 0.001)) * f * 0.12;
          }
        }

        velocities[i].x *= 0.93;
        velocities[i].y *= 0.93;

        pos[idx] += velocities[i].x;
        pos[idx + 1] += velocities[i].y;

        if (mode === "heart" && targets[i].mode === "heart") {
          col[idx] += (1 - col[idx]) * 0.05;
          col[idx + 1] += (0.14 - col[idx + 1]) * 0.05;
          col[idx + 2] += (0.23 - col[idx + 2]) * 0.05;
        } else {
          const hue = (0.65 + 0.12 * Math.sin(frame * 0.002 + i * 0.01)) % 1;
          baseColor.setHSL(hue, 0.72, 0.66);
          col[idx] += (baseColor.r - col[idx]) * 0.03;
          col[idx + 1] += (baseColor.g - col[idx + 1]) * 0.03;
          col[idx + 2] += (baseColor.b - col[idx + 2]) * 0.03;
        }
      }

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [started]);

  return React.createElement(
    "div",
    { className: "scene" },
    React.createElement("div", { ref: mountRef, style: { width: "100%", height: "100%" } }),
    !started
      ? React.createElement(
          "div",
          { className: "start-overlay" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "start-button",
              onClick: () => setStarted(true),
            },
            "Iniciar",
          ),
        )
      : null,
  );
}

createRoot(document.getElementById("root")).render(React.createElement(ParticleScene));
