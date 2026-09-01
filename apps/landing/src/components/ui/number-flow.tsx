"use client";

import { useEffect, useRef } from "react";
import { motion, useInView, useSpring, useTransform } from "motion/react";

interface NumberFlowProps {
  value: number;
  className?: string;
}

export function NumberFlow({ value, className = "" }: NumberFlowProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  const spring = useSpring(0, {
    mass: 0.8,
    stiffness: 75,
    damping: 15,
  });

  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return (
    <span ref={ref} className={className}>
      <motion.span>{display}</motion.span>
    </span>
  );
}
