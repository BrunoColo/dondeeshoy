"use client";

import { useEffect } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";

export function NeonParallax() {
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();

  const mouseX = useSpring(0, { stiffness: 45, damping: 20, mass: 0.35 });
  const mouseY = useSpring(0, { stiffness: 45, damping: 20, mass: 0.35 });

  const scrollYLayerOne = useTransform(scrollYProgress, [0, 1], [-12, 26]);
  const scrollXLayerOne = useTransform(scrollYProgress, [0, 1], [0, -14]);
  const scrollYLayerTwo = useTransform(scrollYProgress, [0, 1], [18, -30]);
  const scrollXLayerTwo = useTransform(scrollYProgress, [0, 1], [0, 18]);

  const layerOneX = useTransform([mouseX, scrollXLayerOne], (latest) => {
    const [m, s] = latest as [number, number];
    return m + s;
  });
  const layerOneY = useTransform([mouseY, scrollYLayerOne], (latest) => {
    const [m, s] = latest as [number, number];
    return m + s;
  });
  const layerTwoX = useTransform([mouseX, scrollXLayerTwo], (latest) => {
    const [m, s] = latest as [number, number];
    return m * -0.65 + s;
  });
  const layerTwoY = useTransform([mouseY, scrollYLayerTwo], (latest) => {
    const [m, s] = latest as [number, number];
    return m * -0.65 + s;
  });

  useEffect(() => {
    if (shouldReduceMotion) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 24;
      const y = (event.clientY / window.innerHeight - 0.5) * 18;
      mouseX.set(x);
      mouseY.set(y);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [mouseX, mouseY, shouldReduceMotion]);

  if (shouldReduceMotion) {
    return (
      <>
        <div aria-hidden className="neon-web-bg" />
        <div aria-hidden className="neon-web-bg neon-web-bg--alt" />
      </>
    );
  }

  return (
    <>
      <motion.div
        aria-hidden
        className="neon-web-bg"
        style={{ x: layerOneX, y: layerOneY }}
      />
      <motion.div
        aria-hidden
        className="neon-web-bg neon-web-bg--alt"
        style={{ x: layerTwoX, y: layerTwoY }}
      />
    </>
  );
}
