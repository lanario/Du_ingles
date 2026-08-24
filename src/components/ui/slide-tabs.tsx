"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Navegação em pílula com cursor deslizante. O cursor é um único nó animado
 * que mede a aba de destino e viaja até ela — em vez de um fundo por aba
 * aparecendo e sumindo, o que perde a leitura de "a seleção se moveu".
 *
 * Regra de repouso: o cursor mora na aba ativa; o hover só o empresta e, ao
 * sair, ele volta. Assim a barra nunca fica sem indicar onde você está —
 * diferente do modelo original (fundo preto), que escondia o cursor no
 * mouseleave e servia só a uma home de marketing.
 */

/** Âncora de seção na mesma página (`#planos`). */
export type SlideTabHash = `#${string}`;

export interface SlideTabItem {
  label: string;
  /**
   * Rota (`<Link>`, ativo lido do pathname) ou âncora `#secao` (`<a>`, ativo
   * lido da seção visível). Sem `href` a aba vira `button` controlável.
   */
  href?: Route | SlideTabHash;
  /** Identificador para uso controlado. Default: `href` ou o próprio label. */
  value?: string;
  icon?: ReactNode;
  /**
   * Contador ao lado do rótulo (ex.: quantas turmas têm chat). Herda a cor da
   * aba, então funciona tanto sob o cursor quanto fora dele.
   */
  badge?: ReactNode;
  disabled?: boolean;
}

/**
 * `app` e `admin` reproduzem o chrome sólido de cada área (§8.1) — navy com
 * cursor dourado, dourado com cursor navy. `surface` é a versão para o canvas
 * branco, quando a barra vive dentro de um card e não pode carregar peso.
 */
export type SlideTabsTone = "app" | "admin" | "surface";

export interface SlideTabsProps {
  items?: SlideTabItem[];
  /** Uso controlado: `value` do item ativo. */
  value?: string;
  /** Uso não controlado: ativo inicial. Default: primeiro item. */
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  tone?: SlideTabsTone;
  /** Ocupa toda a largura do container, com as abas dividindo o espaço em partes iguais. */
  fullWidth?: boolean;
  className?: string;
  /** Rótulo acessível do `<nav>` (links) ou do `tablist` (abas). */
  label?: string;
}

const DEFAULT_ITEMS: SlideTabItem[] = [
  { label: "Home" },
  { label: "Planos" },
  { label: "Recursos" },
  { label: "Docs" },
  { label: "Blog" },
];

const TONES: Record<
  SlideTabsTone,
  { shell: string; cursor: string; idleText: string; activeText: string }
> = {
  app: {
    shell: "bg-app-shell ring-1 ring-inset ring-app-shell-border",
    cursor: "bg-accent shadow-[0_2px_12px_rgba(201,162,39,0.35)]",
    idleText: "text-app-shell-foreground/70 hover:text-app-shell-foreground",
    activeText: "text-accent-foreground",
  },
  admin: {
    shell: "bg-admin-shell ring-1 ring-inset ring-admin-shell-border",
    cursor: "bg-navy-900 shadow-[0_2px_12px_rgba(10,31,68,0.35)]",
    idleText: "text-admin-shell-foreground/75 hover:text-admin-shell-foreground",
    activeText: "text-primary-foreground",
  },
  surface: {
    shell: "bg-background ring-1 ring-inset ring-border shadow-[var(--shadow-card)]",
    cursor: "bg-primary shadow-[0_2px_12px_rgba(15,44,92,0.25)]",
    idleText: "text-muted-foreground hover:text-foreground",
    activeText: "text-primary-foreground",
  },
};

const tabClass = cn(
  "relative flex items-center gap-2 rounded-full px-4 py-2 sm:px-5",
  "whitespace-nowrap text-xs font-semibold uppercase tracking-[0.12em]",
  "transition-colors duration-200",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
  "[&_svg]:size-4",
);

function itemValue(item: SlideTabItem): string {
  return item.value ?? item.href ?? item.label;
}

function isHash(href: string | undefined): href is SlideTabHash {
  return !!href && href.startsWith("#");
}

/** Casa a rota com o `href` mais específico da lista (senão "/" venceria "/turmas"). */
function matchPathname(items: SlideTabItem[], pathname: string | null): string | null {
  if (!pathname) return null;
  let best: SlideTabItem | null = null;
  for (const item of items) {
    if (!item.href || isHash(item.href)) continue;
    const hit =
      pathname === item.href ||
      (item.href !== "/" && pathname.startsWith(`${item.href}/`));
    if (hit && (!best || item.href.length > (best.href?.length ?? 0))) best = item;
  }
  return best ? itemValue(best) : null;
}

/** Fração da altura da janela onde fica a linha que decide a seção atual. */
const SPY_LINE = 0.4;

/**
 * Scroll-spy das abas-âncora: ativa a seção que cruza uma linha imaginária a
 * 40% da altura da janela. Uma linha, e não uma faixa, porque com faixa duas
 * seções se qualificam ao mesmo tempo na fronteira e o cursor pisca entre as
 * duas. Nenhuma seção sob a linha (topo da página, rodapé) = nenhuma ativa.
 */
function useSectionSpy(items: SlideTabItem[], enabled: boolean): string | null {
  const [active, setActive] = useState<string | null>(null);
  const hashes = items
    .filter((item) => isHash(item.href))
    .map((item) => `${item.href}|${itemValue(item)}`)
    .join(",");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const sections: Array<{ node: Element; value: string }> = [];
    for (const entry of hashes.split(",").filter(Boolean)) {
      const sep = entry.indexOf("|");
      const node = document.querySelector(entry.slice(0, sep));
      if (node) sections.push({ node, value: entry.slice(sep + 1) });
    }
    if (sections.length === 0) return;

    const update = () => {
      const line = window.innerHeight * SPY_LINE;
      let current: string | null = null;
      for (const { node, value } of sections) {
        const rect = node.getBoundingClientRect();
        if (rect.top <= line && rect.bottom > line) {
          current = value;
          break;
        }
      }
      setActive(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Imagem ou fonte que carrega depois empurra as seções sem gerar scroll:
    // sem observar a altura do documento, a aba ativa fica congelada até o
    // próximo movimento do usuário.
    const resize =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resize?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      resize?.disconnect();
    };
  }, [hashes, enabled]);

  return active;
}

export function SlideTabs({
  items = DEFAULT_ITEMS,
  value,
  defaultValue,
  onValueChange,
  tone = "app",
  fullWidth = false,
  className,
  label = "Navegação",
}: SlideTabsProps) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const styles = TONES[tone];

  const hasHash = items.some((item) => isHash(item.href));

  // Numa nav de âncoras ninguém está "em" uma seção antes do primeiro scroll:
  // o padrão é nenhuma aba ativa (cursor escondido), não a primeira.
  const [uncontrolled, setUncontrolled] = useState<string | null>(
    () => defaultValue ?? (hasHash ? null : items[0] ? itemValue(items[0]) : null),
  );
  const routeValue = matchPathname(items, pathname);
  const sectionValue = useSectionSpy(items, hasHash);
  const activeValue = value ?? routeValue ?? sectionValue ?? uncontrolled;

  const [hovered, setHovered] = useState<string | null>(null);
  const cursorValue = hovered ?? activeValue;

  const listRef = useRef<HTMLUListElement>(null);
  const tabRefs = useRef(new Map<string, HTMLLIElement>());
  const [cursor, setCursor] = useState<{ left: number; width: number } | null>(null);

  const measure = useCallback(() => {
    const node = cursorValue ? tabRefs.current.get(cursorValue) : null;
    if (!node) {
      setCursor(null);
      return;
    }
    setCursor({ left: node.offsetLeft, width: node.offsetWidth });
  }, [cursorValue]);

  useLayoutEffect(measure, [measure, items]);

  // A largura das abas muda com o container e com a troca da fonte; sem
  // observar os dois, o cursor fica desalinhado até o próximo hover.
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(list);
    for (const node of tabRefs.current.values()) observer.observe(node);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => observer.disconnect();
  }, [measure]);

  const select = (item: SlideTabItem) => {
    const next = itemValue(item);
    if (value === undefined) setUncontrolled(next);
    onValueChange?.(next);
  };

  const isNav = items.some((item) => item.href);

  const list = (
    <ul
      ref={listRef}
      role={isNav ? undefined : "tablist"}
      aria-label={isNav ? undefined : label}
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "relative flex items-center gap-1 rounded-full p-1",
        fullWidth && "w-full",
        styles.shell,
      )}
    >
      {cursor ? (
        <li
          aria-hidden
          style={{
            transform: `translateX(${cursor.left}px)`,
            width: cursor.width,
            transitionDuration: reduceMotion ? "0ms" : undefined,
          }}
          className={cn(
            "pointer-events-none absolute inset-y-1 left-0 z-0 rounded-full",
            "transition-[transform,width] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
            styles.cursor,
          )}
        />
      ) : null}

      {items.map((item) => {
        const key = itemValue(item);
        const isCursor = key === cursorValue;
        const isActive = key === activeValue;
        const content = (
          <>
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge !== null ? (
              <span
                aria-hidden
                className="tabular rounded-full bg-current/15 px-1.5 py-px text-[0.6875rem] leading-4 tracking-normal"
              >
                {item.badge}
              </span>
            ) : null}
          </>
        );
        const textClass = cn(
          tabClass,
          fullWidth && "w-full justify-center",
          isCursor ? styles.activeText : styles.idleText,
          item.disabled && "opacity-50",
        );

        return (
          <li
            key={key}
            ref={(node) => {
              if (node) tabRefs.current.set(key, node);
              else tabRefs.current.delete(key);
            }}
            className={cn("relative z-10", fullWidth && "flex-1")}
            onMouseEnter={() => {
              if (!item.disabled) setHovered(key);
            }}
          >
            {isHash(item.href) ? (
              // Âncora na mesma página: `<a>` puro. Passar por `<Link>` aqui
              // faria o router tratar como navegação e perder o scroll suave
              // nativo do CSS.
              <a
                href={item.href}
                aria-current={isActive ? "location" : undefined}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
                onClick={() => select(item)}
                className={cn(textClass, item.disabled && "pointer-events-none")}
              >
                {content}
              </a>
            ) : item.href ? (
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
                onClick={() => select(item)}
                className={cn(textClass, item.disabled && "pointer-events-none")}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={item.disabled}
                onFocus={() => setHovered(key)}
                onBlur={() => setHovered(null)}
                onClick={() => select(item)}
                className={cn(textClass, item.disabled && "cursor-not-allowed")}
              >
                {content}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return isNav ? (
    <nav aria-label={label} className={cn("inline-flex", className)}>
      {list}
    </nav>
  ) : (
    <div className={cn("inline-flex", className)}>{list}</div>
  );
}
