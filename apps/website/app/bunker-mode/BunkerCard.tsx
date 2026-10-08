"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import Tilt from "react-parallax-tilt";

/** MIT component: https://github.com/mkosir/react-parallax-tilt */
export default function BunkerCard({ src, alt }: { src: string; alt: string }) {
  const reducedMotion = useReducedMotion();
  const target = useRef<{ x: number; y: number } | null>(null);
  const [angles, setAngles] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    let last = performance.now();
    const start = last;
    let x = 0;
    let y = 0;
    function animate(now: number) {
      const elapsed = (now - start) / 1000;
      const idle = {
        x: Math.sin(elapsed * Math.PI / 5) * 2.2,
        y: Math.sin(elapsed * Math.PI / 5 + Math.PI / 2) * 3.5,
      };
      // One motion owner: idle and hover blend rather than stacking rotations.
      const next = target.current || idle;
      const blend = 1 - Math.exp(-Math.min(now - last, 64) / 95);
      x += (next.x - x) * blend;
      y += (next.y - y) * blend;
      last = now;
      setAngles({ x, y });
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  function move(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const py = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    target.current = { x: (0.5 - py) * 16, y: (px - 0.5) * 20 };
  }

  return (
    <div
      className="bunker-card-scene"
      onPointerEnter={move}
      onPointerMove={move}
      onPointerLeave={() => {
        target.current = null;
      }}
      onPointerCancel={() => {
        target.current = null;
      }}
    >
      <Tilt
        className="bunker-card-surface"
        tiltEnable={!reducedMotion}
        tiltAngleXManual={reducedMotion ? 0 : angles.x}
        tiltAngleYManual={reducedMotion ? 0 : angles.y}
        tiltMaxAngleX={8}
        tiltMaxAngleY={10}
        perspective={1000}
        glareEnable={!reducedMotion}
        glareMaxOpacity={0.09}
        glarePosition="all"
        glareColor="#fff8eb"
        glareBorderRadius="8px"
        gyroscope={false}
        transitionSpeed={250}
      >
        <img
          className="bunker-card"
          src={src}
          alt={alt}
          width="1200"
          height="630"
          draggable={false}
        />
      </Tilt>
    </div>
  );
}
