"use client";

/**
 * Moldura de tablet que "deita e levanta" conforme a seção passa pela
 * viewport. Só a moldura é client: o conteúdo entra por children, então
 * quem usa pode manter o texto renderizado no servidor.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

export function ContainerScroll({
  titleComponent,
  children,
  className,
}: {
  titleComponent: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const query = window.matchMedia("(max-width: 768px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const { scrollYProgress } = useScroll({ target: containerRef });

  const scaleDimensions = isMobile ? [0.7, 0.9] : [1.05, 1];
  const rotate = useTransform(scrollYProgress, [0, 1], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], scaleDimensions);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center p-2 md:p-20",
        className,
      )}
    >
      <div className="relative w-full py-10 md:py-24" style={{ perspective: "1000px" }}>
        <Header translate={reduceMotion ? undefined : translate}>
          {titleComponent}
        </Header>
        <Card
          rotate={reduceMotion ? undefined : rotate}
          scale={reduceMotion ? undefined : scale}
        >
          {children}
        </Card>
      </div>
    </div>
  );
}

type Track = MotionValue<number>;

function Header({ translate, children }: { translate?: Track; children: ReactNode }) {
  return (
    <motion.div
      style={{ translateY: translate }}
      className="mx-auto max-w-5xl text-center"
    >
      {children}
    </motion.div>
  );
}

function Card({
  rotate,
  scale,
  children,
}: {
  rotate?: Track;
  scale?: Track;
  children: ReactNode;
}) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003",
      }}
      className="mx-auto -mt-10 h-auto min-h-[26rem] w-full max-w-5xl rounded-[30px] border-4 border-navy-900 bg-navy-900 p-2 shadow-2xl md:min-h-[40rem] md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-2xl bg-background md:rounded-2xl md:p-4">
        {children}
      </div>
    </motion.div>
  );
}
