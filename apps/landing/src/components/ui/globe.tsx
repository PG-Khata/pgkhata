"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface GlobeProps {
  className?: string;
}

export function Globe({ className = "" }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    let animationFrame: number;
    let angle = 0;

    function draw() {
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      // Draw globe outline
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.3)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw meridians
      for (let i = 0; i < 6; i++) {
        const meridianAngle = (i * Math.PI) / 3 + angle;
        ctx.beginPath();
        ctx.ellipse(
          centerX,
          centerY,
          radius * Math.abs(Math.cos(meridianAngle)),
          radius,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw parallels
      for (let i = 1; i < 5; i++) {
        const y = centerY - radius + (i * radius * 2) / 5;
        const parallelRadius = Math.sqrt(
          radius * radius - (y - centerY) * (y - centerY)
        );
        ctx.beginPath();
        ctx.ellipse(centerX, y, parallelRadius, parallelRadius * 0.3, 0, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Draw dots for locations
      const locations = [
        { lat: 28.6, lng: 77.2 }, // Delhi
        { lat: 19.0, lng: 72.8 }, // Mumbai
        { lat: 12.9, lng: 77.5 }, // Bangalore
        { lat: 22.5, lng: 88.3 }, // Kolkata
        { lat: 13.0, lng: 80.2 }, // Chennai
      ];

      locations.forEach((loc) => {
        const x =
          centerX +
          radius *
            Math.cos((loc.lat * Math.PI) / 180) *
            Math.sin(((loc.lng + angle * 50) * Math.PI) / 180);
        const y =
          centerY -
          radius * Math.sin((loc.lat * Math.PI) / 180);

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.8)";
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
        ctx.fill();
      });

      angle += 0.005;
      animationFrame = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={400}
      className={cn("w-full h-full", className)}
    />
  );
}
