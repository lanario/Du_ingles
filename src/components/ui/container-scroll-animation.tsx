"use client";

/**
 * Moldura de tablet que "deita e levanta" conforme a seção passa pela
 * viewport. Só a moldura é client: o conteúdo entra por children, então
 * quem usa pode manter o texto renderizado no servidor.
 *
 * Abaixo de `md` a moldura fica parada. Um `rotateX` de 20° numa peça que
 * ocupa a largura inteira da tela distorce o texto justamente onde ele já é
 * pequeno, e o `scale` de 0,9 encolhia ainda mais — no celular a peça vira
 * um cartão comum, com bezel fino, e o efeito 3D fica para quem tem tela
 * larga o bastante para ele fazer sentido.
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
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // A seção é bem mais alta que a viewport (a lista inteira mora dentro do
  // tablet), então o offset padrão ("start start" -> "end end") só chegaria
  // a 1 no fim da seção e a moldura ficaria inclinada o tempo todo. Amarramos
  // o progresso à *entrada* da seção: 0 quando o topo dela encosta na base da
  // viewport, 1 quando esse topo alcança o topo da viewport.
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "start start"],
  });

  // A rotação termina antes do fim do trecho, então o tablet já está reto
  // enquanto o conteúdo é lido.
  const rotate = useTransform(scrollYProgress, [0, 0.8], [20, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.8], [1.05, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const still = reduceMotion || isMobile;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex items-center justify-center overflow-x-clip md:p-20",
        className,
      )}
    >
      <div className="relative w-full py-8 md:py-24" style={{ perspective: "1000px" }}>
        <Header translate={still ? undefined : translate}>{titleComponent}</Header>
        <Card rotate={still ? undefined : rotate} scale={still ? undefined : scale}>
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
      className="mx-auto mt-2 h-auto w-full max-w-5xl rounded-3xl border-2 border-navy-900 bg-navy-900 p-1.5 shadow-2xl md:-mt-10 md:min-h-[40rem] md:rounded-[30px] md:border-4 md:p-6"
    >
      <div className="h-full w-full overflow-hidden rounded-[1.15rem] bg-background md:rounded-2xl md:p-4">
        {children}
      </div>
    </motion.div>
  );
}
