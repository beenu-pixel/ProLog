"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Popiersie Marka Aureliusza jako obracająca się chmura punktów-SKORUPY.
 * Wczytujemy wstępnie wygenerowany plik `public/marcus-points.bin` (równomierne
 * próbki POWIERZCHNI modelu 3D — patrz `scripts/build-bust-points.mjs`), więc
 * punkty leżą na skorupie, nie we wnętrzu. Punkty są nieprzezroczyste i mają
 * test głębi — przód zasłania tył, dzięki czemu z każdej strony widać, że to
 * popiersie. Całość obraca się bardzo wolno wokół osi pionowej.
 *
 * Kolor punktów podąża za motywem (biel w trybie ciemnym, czerń w jasnym).
 * Renderowane TYLKO gdy animacje są włączone i jest WebGL — decyzję podejmuje
 * rodzic (`landing-hero`).
 */

type Props = {
  src: string; // ścieżka do .bin z punktami
  className?: string;
  onReady?: () => void;
};

const FOV = 42;
const MORPH_MS = 2200;
const ROT_SPEED = 0.09; // rad/s — „bardzo wolno" (~70 s na obrót)
const POINT_SIZE = 0.015; // wyraźne, lekko łączące się kropki (nie lita bryła)
const START_SPIN = 0; // obrót startowy — twarz zwrócona do widza

function pointColor(): number {
  if (typeof document === "undefined") return 0xffffff;
  return document.documentElement.classList.contains("dark") ? 0xffffff : 0x111111;
}

/** Miękka, okrągła „kropka" jako tekstura punktu (z alphaTest → twarda krawędź). */
function makeSprite(): THREE.Texture {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.6, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export default function HeroScene({ src, className, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
    } catch {
      return; // brak WebGL — rodzic pokaże poster
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    const group = new THREE.Group();
    scene.add(group);

    const sprite = makeSprite();
    const material = new THREE.PointsMaterial({
      color: pointColor(),
      size: POINT_SIZE,
      sizeAttenuation: true,
      map: sprite,
      alphaTest: 0.5, // twarda krawędź + poprawne przesłanianie (przód kryje tył)
      transparent: false,
      depthWrite: true,
      depthTest: true,
    });

    let points: THREE.Points | null = null;
    let target = new Float32Array(0);
    let start = new Float32Array(0);
    let count = 0;
    let worldW = 2;

    let raf = 0;
    let running = false;
    let disposed = false;
    let morphStart = 0;
    let lastT = 0;
    let signaled = false;
    let spin = START_SPIN; // narastający kąt obrotu (start: twarz do widza)

    const pointer = { x: 0, y: 0 };
    const tilt = { x: 0, y: 0 };

    const motionOff =
      document.documentElement.classList.contains("no-anim") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function fitCamera() {
      const w = parent!.clientWidth || 1;
      const h = parent!.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      const vFov = (FOV * Math.PI) / 180;
      const fitH = 2 / 2 / Math.tan(vFov / 2);
      const fitW = worldW / 2 / (Math.tan(vFov / 2) * camera.aspect);
      camera.position.z = Math.max(fitH, fitW) * 1.35; // zapas na obrót
      camera.updateProjectionMatrix();
    }

    function render() {
      renderer.render(scene, camera);
    }

    function loop() {
      if (disposed || !running) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = lastT ? (now - lastT) / 1000 : 0;
      lastT = now;

      const attr = points!.geometry.getAttribute("position") as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const t = Math.min(1, (now - morphStart) / MORPH_MS);
      if (t < 1) {
        const e = easeOutCubic(t);
        for (let k = 0; k < arr.length; k++) {
          arr[k] = start[k] + (target[k] - start[k]) * e;
        }
        attr.needsUpdate = true;
      }

      spin += dt * ROT_SPEED;
      // lekki dodatkowy przechył od kursora (parallax) na bazie wolnego obrotu
      tilt.y += (pointer.x * 0.25 - tilt.y) * 0.04;
      tilt.x += (-pointer.y * 0.15 - tilt.x) * 0.04;
      group.rotation.y = spin + tilt.y;
      group.rotation.x = tilt.x;

      render();
      if (!signaled && t > 0.03) {
        signaled = true;
        onReadyRef.current?.();
      }
    }

    function startLoop() {
      if (running || disposed) return;
      running = true;
      lastT = 0;
      raf = requestAnimationFrame(loop);
    }
    function stopLoop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    function build(ab: ArrayBuffer) {
      if (disposed) return;
      count = new Uint32Array(ab, 0, 1)[0];
      const positions = new Float32Array(ab, 4, count * 3);
      // (normalne są w pliku za pozycjami — na razie nieużywane)

      target = new Float32Array(positions); // kopia (widok → własny bufor)
      // szerokość świata z rozpiętości X (do dopasowania kamery)
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < count; i++) {
        const x = target[i * 3];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      worldW = Math.max(0.5, maxX - minX);

      start = new Float32Array(count * 3);
      for (let p = 0; p < count; p++) {
        const r = 2.6 + Math.random() * 2.4;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        start[p * 3] = r * Math.sin(ph) * Math.cos(th);
        start[p * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
        start[p * 3 + 2] = r * Math.cos(ph);
      }

      const geo = new THREE.BufferGeometry();
      const pos = motionOff ? target.slice() : start.slice();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.computeBoundingSphere();
      points = new THREE.Points(geo, material);
      group.add(points);

      fitCamera();

      if (motionOff) {
        group.rotation.y = START_SPIN; // statyczna klatka też twarzą do widza
        render();
        onReadyRef.current?.();
        return;
      }
      morphStart = performance.now();
      startLoop();
    }

    let aborted = false;
    fetch(src)
      .then((r) => r.arrayBuffer())
      .then((ab) => {
        if (!aborted) build(ab);
      })
      .catch(() => {
        /* błąd sieci — rodzic pokaże poster */
      });

    const onPointerMove = (e: PointerEvent) => {
      const r = parent.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    };
    if (!motionOff) window.addEventListener("pointermove", onPointerMove, { passive: true });

    const ro = new ResizeObserver(() => {
      if (count > 0) {
        fitCamera();
        if (motionOff) render();
      }
    });
    ro.observe(parent);

    const themeObs = new MutationObserver(() => {
      material.color.setHex(pointColor());
      if (motionOff && count > 0) render();
    });
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVis = () => {
      if (motionOff || !points) return;
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      aborted = true;
      stopLoop();
      ro.disconnect();
      themeObs.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointerMove);
      points?.geometry.dispose();
      material.dispose();
      sprite.dispose();
      renderer.dispose();
    };
  }, [src]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
