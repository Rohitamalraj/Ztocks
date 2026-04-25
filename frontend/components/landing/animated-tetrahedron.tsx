"use client";

import { useEffect, useRef } from "react";

export function AnimatedTetrahedron() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const activeRef = useRef(false);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const chars = "░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯";
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const observer = new IntersectionObserver(([e]) => { activeRef.current = e.isIntersecting; }, { threshold: 0.1 });
    observer.observe(canvas);

    const vertices = [
      { x: 0, y: 1, z: 0 },
      { x: -0.943, y: -0.333, z: -0.5 },
      { x: 0.943, y: -0.333, z: -0.5 },
      { x: 0, y: -0.333, z: 1 },
    ];

    const edges = [[0,1],[0,2],[0,3],[1,2],[2,3],[3,1]];
    const faces = [[0,1,2],[0,2,3],[0,3,1],[1,3,2]];

    const rotateY = (p: {x:number;y:number;z:number}, a: number) => ({ x: p.x*Math.cos(a)-p.z*Math.sin(a), y: p.y, z: p.x*Math.sin(a)+p.z*Math.cos(a) });
    const rotateX = (p: {x:number;y:number;z:number}, a: number) => ({ x: p.x, y: p.y*Math.cos(a)-p.z*Math.sin(a), z: p.y*Math.sin(a)+p.z*Math.cos(a) });
    const rotateZ = (p: {x:number;y:number;z:number}, a: number) => ({ x: p.x*Math.cos(a)-p.y*Math.sin(a), y: p.x*Math.sin(a)+p.y*Math.cos(a), z: p.z });

    const render = (timestamp: number) => {
      if (!activeRef.current) { frameRef.current = requestAnimationFrame(render); return; }
      if (timestamp - lastTimeRef.current < 33) { frameRef.current = requestAnimationFrame(render); return; }
      lastTimeRef.current = timestamp;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const scale = Math.min(rect.width, rect.height) * 0.7;

      ctx.font = "18px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const points: { x:number; y:number; z:number; char:string }[] = [];

      edges.forEach(([i, j]) => {
        const v1 = vertices[i], v2 = vertices[j];
        for (let t = 0; t <= 1; t += 0.05) {
          let p = { x: v1.x+(v2.x-v1.x)*t, y: v1.y+(v2.y-v1.y)*t, z: v1.z+(v2.z-v1.z)*t };
          p = rotateY(p, time*0.4); p = rotateX(p, time*0.3); p = rotateZ(p, time*0.2);
          const depth = (p.z+1.5)/3;
          const ci = Math.floor(depth*(chars.length-1));
          points.push({ x: centerX+p.x*scale, y: centerY-p.y*scale, z: p.z, char: chars[Math.min(ci,chars.length-1)] });
        }
      });

      faces.forEach(([i,j,k]) => {
        const v1=vertices[i], v2=vertices[j], v3=vertices[k];
        for (let u=0; u<=1; u+=0.12) {
          for (let v=0; v<=1-u; v+=0.12) {
            const w=1-u-v;
            let p = { x: v1.x*u+v2.x*v+v3.x*w, y: v1.y*u+v2.y*v+v3.y*w, z: v1.z*u+v2.z*v+v3.z*w };
            p = rotateY(p,time*0.4); p = rotateX(p,time*0.3); p = rotateZ(p,time*0.2);
            const depth=(p.z+1.5)/3;
            const ci=Math.floor(depth*(chars.length-1));
            points.push({ x: centerX+p.x*scale, y: centerY-p.y*scale, z: p.z, char: chars[Math.min(ci,chars.length-1)] });
          }
        }
      });

      points.sort((a,b)=>a.z-b.z);
      points.forEach((p) => {
        const alpha = Math.min(0.15+(p.z+1.5)*0.25, 0.9);
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.fillText(p.char, p.x, p.y);
      });

      time += 0.015;
      frameRef.current = requestAnimationFrame(render);
    };

    frameRef.current = requestAnimationFrame(render);
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(frameRef.current); observer.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block", willChange: "transform" }} />;
}
