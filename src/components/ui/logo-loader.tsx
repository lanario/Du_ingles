import { cn } from "@/lib/utils";

/**
 * As seis formas da marca (`public/du_ingles_logo.svg`), na ordem em que o
 * traço deve percorrê-las: primeiro o "D" e o "U" em azul marinho, depois os
 * acentos dourados. O `viewBox` recorta a caixa exata do desenho — o arquivo
 * original é 4000×4000 com margem generosa, que num loader de 20px viraria
 * uma marca minúscula no meio do nada.
 */
const VIEW_BOX = "780 507 2620 2620";

const SHAPES: ReadonlyArray<readonly [tone: "navy" | "gold", d: string]> = [
  [
    "navy",
    "M879.74 1189.74L1320.35 1189.75L1454.34 1189.79C1472.77 1189.8 1507.35 1188.87 1524.78 1190.8C1636.14 1203.08 1732.85 1231.73 1832.6 1282.72C1842.73 1287.9 1849.47 1293.02 1852.83 1303.7C1835.53 1351.72 1818.6 1402 1806.02 1451.44C1799.34 1477.69 1788.32 1549.13 1778.62 1567.77C1768.81 1567.65 1717.2 1529.51 1702.03 1520.8C1584.82 1453.47 1476.02 1457.7 1344.31 1457.67L1155.8 1457.68L1144.98 1468.5L1144.98 2539.73L1155.74 2550.45L1376.57 2550.5C1436.23 2550.5 1501.97 2554.25 1559.67 2542.58C1608.84 2532.63 1652.85 2515.1 1696.53 2490.72C1830.49 2415.95 1917.38 2287.76 1953.93 2140.31C1960.47 2113.95 1960.16 2091.29 1963.48 2064.91C1969.49 2017.19 1979.8 1971.47 1991.89 1925C1994.49 1915 1992.3 1909.26 1995.29 1899.12C2026.31 1794.12 2071.21 1705.49 2133.96 1616.19C2164.8 1572.31 2209.26 1525.34 2248.28 1488.52C2274.38 1463.9 2299.42 1439.34 2327.99 1417.35C2436.34 1333.96 2568.93 1273.5 2700.2 1237.18C2764.91 1220.8 2829.83 1209.93 2895.61 1199.36C2914.83 1196.27 2924.4 1198.14 2942.61 1199.79C2950.84 1212.7 2948.2 1267.67 2948.22 1285.99C2948.09 1340.15 2948.25 1394.32 2948.7 1448.49C2944.24 1458.83 2940.85 1463.66 2928.88 1464.86C2645.76 1493.11 2375.9 1650.09 2272.59 1925.57C2265.97 1943.23 2262.3 1962.86 2256.41 1981.06C2236.15 2043.61 2235.84 2110.81 2222.5 2175C2152.87 2526.87 1878.71 2796.6 1514.14 2821.51C1493.34 2822.93 1472.64 2821.8 1451.85 2822.85C1361.77 2828.65 1270.3 2827.95 1180.25 2822.39C1154.63 2822.2 1129.19 2826.09 1103.57 2826.16C1028.84 2826.35 954.106 2826.32 879.377 2826.3L869.092 2816.11L869.092 1200.18L879.74 1189.74Z",
  ],
  [
    "navy",
    "M2503.6 2514.52L2506.6 2508.05C2518.68 2501.9 2540.07 2516.76 2550.34 2519.72C2601.4 2534.48 2656 2529.88 2708.49 2529.1C2713.53 2529.03 2722.26 2524.06 2727.4 2522.87C2748.94 2521.76 2766.57 2515.13 2786.07 2507.3C2927.57 2450.74 3014 2319.07 3024.73 2168.76C3027.7 2127.14 3025.47 2079.5 3025.44 2037.11L3025.42 1827.3C3025.73 1693.1 3116.59 1572.94 3245.49 1534.77C3259.46 1530.63 3284.94 1522 3295.92 1533.45C3298.7 1546.3 3297.5 1585.94 3297.45 1600.78L3297.14 1724.08L3297.27 1999.04C3297.23 2077.38 3301.61 2167.13 3284.19 2243.57C3301.19 2251.84 3291.6 2266.63 3289.73 2282.22C3278.34 2377.4 3235.95 2470.99 3183.4 2550.42C3173.78 2564.82 3154.62 2576.44 3139.58 2584.69C3145.51 2588.35 3146.15 2588.3 3146.67 2594.53C3142.34 2602.5 3129.31 2614.76 3122.46 2621.65C3075.64 2668.88 3022.64 2709.57 2964.9 2742.58C2718.12 2882.44 2388.66 2832.32 2190.82 2631.54C2173.94 2614.41 2154.41 2598.08 2142.61 2576.92C2147.28 2567.97 2153.71 2558.56 2159.55 2550.47C2207.74 2483.69 2244.9 2411.02 2272.81 2333.58C2278.68 2317.31 2283.64 2295.72 2291.45 2280.36C2297.14 2277.78 2294.34 2277.88 2300.1 2279.87C2305.39 2289.68 2299.45 2299.33 2305.41 2307.18C2310.85 2307.04 2313.74 2305.77 2316.92 2309.68C2329.58 2325.25 2341.07 2347.2 2351.67 2364.22C2362.79 2382.01 2375.54 2398.74 2389.75 2414.18C2423.44 2450.73 2457.41 2466.32 2489.55 2501.44C2493.2 2505.43 2501.14 2511.29 2503.6 2514.52Z",
  ],
  [
    "gold",
    "M3284.19 2243.57C3301.19 2251.84 3291.6 2266.63 3289.73 2282.22C3278.34 2377.4 3235.95 2470.99 3183.4 2550.42C3173.78 2564.82 3154.62 2576.44 3139.58 2584.69C3123.86 2600.45 3108.59 2610.99 3089.77 2622.71C2800.59 2802.83 2427.7 2661.9 2315.88 2344.2C2311.7 2332.34 2306.82 2319.47 2305.41 2307.18C2310.85 2307.04 2313.74 2305.77 2316.92 2309.68C2329.58 2325.25 2341.07 2347.2 2351.67 2364.22C2362.79 2382.01 2375.54 2398.74 2389.75 2414.18C2423.44 2450.73 2457.41 2466.32 2489.55 2501.44C2493.2 2505.43 2501.14 2511.29 2503.6 2514.52C2530.64 2535.44 2560.54 2550.2 2590.79 2565.38C2848.75 2694.83 3169.1 2559.34 3267.98 2291.01C3273.78 2275.29 3276.71 2258.69 3284.19 2243.57Z",
  ],
  [
    "gold",
    "M1852.83 1303.7C1857.78 1301.2 1861.22 1298.39 1867 1301.39C1943.81 1341.2 2006.58 1402.89 2062.56 1467.96C2073.65 1480.85 2101.64 1507.4 2092.72 1524.4C2081.16 1546.41 2062.5 1565.48 2048.35 1586.03C2014.16 1636.17 1983.77 1687.57 1959.59 1743.39C1951.58 1761.88 1946.97 1784.3 1931.35 1797.96L1926.93 1798.85C1918.51 1792.11 1895.35 1725.3 1884.92 1710.61C1876.23 1698.38 1865.93 1673.66 1854.84 1660.94C1837.49 1631.88 1794.18 1599.03 1779.46 1575.99L1778.62 1567.77C1788.32 1549.13 1799.34 1477.69 1806.02 1451.44C1818.6 1402 1835.53 1351.72 1852.83 1303.7Z",
  ],
  [
    "gold",
    "M3111.35 752.906C3200.34 738.909 3283.87 799.558 3298.11 888.505C3312.35 977.451 3251.94 1061.15 3163.03 1075.64C3073.77 1090.19 2989.67 1029.48 2975.37 940.186C2961.07 850.89 3022.01 766.958 3111.35 752.906Z",
  ],
  [
    "gold",
    "M2942.61 1199.79C2945.68 1195.62 2948.35 1190.14 2953.19 1189.94C2982.48 1188.75 3016.5 1189.72 3045.42 1189.82L3286.87 1189.71L3297.27 1200.14C3298.68 1245.54 3278.88 1301.91 3255.47 1340.63C3210.12 1415.65 3126.47 1460.26 3039.44 1461.34C3026.8 1461.49 2955.7 1463.25 2949.82 1459.15C2949.42 1455.65 2948.93 1451.98 2948.7 1448.49C2948.25 1394.32 2948.09 1340.15 2948.22 1285.99C2948.2 1267.67 2950.84 1212.7 2942.61 1199.79Z",
  ],
];

/**
 * Abaixo deste tamanho o contorno percorrido não se lê — os traços das seis
 * formas se encostam e a marca vira um borrão. Nesses casos (botão, linha de
 * tabela) sobra só o pulso do preenchimento, em uma única cor.
 */
const COMPACT_BELOW_PX = 28;

/** Espessura do traço em unidades do `viewBox` para render ~1,5px na tela. */
function strokeUnits(sizePx: number): number {
  return Math.round((2620 * 1.5) / sizePx);
}

export interface LogoLoaderProps {
  /** Lado do quadrado, em px. */
  size?: number;
  /**
   * Duração de uma volta do traço, em segundos. O padrão é 4s; na miniatura
   * cai para 1,6s, senão uma ação de 300ms mostraria a marca praticamente
   * parada.
   */
  speed?: number;
  /**
   * `brand` usa azul marinho + dourado; `current` pinta a marca inteira com
   * a cor do texto do contexto — é o que faz o loader aparecer dentro de um
   * botão azul marinho ou dourado sem precisar saber em qual dos dois está.
   */
  tone?: "brand" | "current" | "light";
  className?: string;
  /** Texto lido por leitores de tela. `null` quando algo ao lado já diz. */
  label?: string | null;
}

/**
 * A marca do Du Inglês se desenhando — duas camadas sobre os mesmos seis
 * `path`: a de baixo preenchida, apagando e voltando; a de cima traçando o
 * contorno. Ver `.du-loader` em `globals.css`.
 */
export function LogoLoader({
  size = 96,
  speed,
  tone,
  className,
  label = "Carregando",
}: LogoLoaderProps) {
  const compact = size < COMPACT_BELOW_PX;
  const resolvedTone = tone ?? (compact ? "current" : "brand");
  const resolvedSpeed = speed ?? (compact ? 1.6 : 4);

  return (
    <span
      className={cn("du-loader", className)}
      data-tone={resolvedTone}
      data-compact={compact || undefined}
      style={
        {
          "--du-size": `${size}px`,
          "--du-speed": `${resolvedSpeed}s`,
          "--du-stroke": strokeUnits(size),
        } as React.CSSProperties
      }
      role={label ? "status" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox={VIEW_BOX} focusable="false" aria-hidden>
        <g className="du-fill">
          {SHAPES.map(([shapeTone, d], index) => (
            <path key={index} d={d} className={`du-${shapeTone}`} />
          ))}
        </g>
        {/* O traço só entra quando há pixels para ele. */}
        {!compact && (
          <g className="du-dash">
            {SHAPES.map(([shapeTone, d], index) => (
              <path key={index} d={d} className={`du-${shapeTone}`} pathLength={360} />
            ))}
          </g>
        )}
      </svg>
    </span>
  );
}

export interface LoadingVeilProps {
  /** Legenda sob a marca. `null` mostra só o loader. */
  label?: string | null;
  size?: number;
  /**
   * `true` cobre a viewport inteira. O padrão cobre o ancestral posicionado
   * mais próximo — que é quase sempre o que se quer: desfocar o painel ou a
   * seção que está recarregando, não a navegação em volta.
   */
  fixed?: boolean;
  /**
   * `dark` para superfícies navy (telas de acesso, sala ao vivo): o véu
   * escurece em vez de clarear e a marca herda o branco do texto.
   */
  surface?: "light" | "dark";
  className?: string;
}

/**
 * Véu de carregamento: desfoca o conteúdo atrás e centraliza a marca.
 *
 * Requer um ancestral `relative` quando não é `fixed` — sem isso ele se
 * ancora em algum contêiner distante e cobre a tela errada.
 */
export function LoadingVeil({
  label = "Carregando…",
  size = 88,
  fixed = false,
  surface = "light",
  className,
}: LoadingVeilProps) {
  // A marca fica escondida do leitor de tela e quem anuncia é o véu: com as
  // duas visíveis, um cartão em carregamento diria "carregando" duas vezes.
  return (
    <div
      className={cn("du-veil", className)}
      data-fixed={fixed || undefined}
      data-surface={surface === "dark" ? "dark" : undefined}
      role="status"
      aria-live="polite"
      aria-busy
      aria-label={label ? undefined : "Carregando"}
    >
      <LogoLoader
        size={size}
        tone={surface === "dark" ? "light" : undefined}
        label={null}
      />
      {label ? <span className="du-veil__label">{label}</span> : null}
    </div>
  );
}

export interface PageLoaderProps {
  label?: string | null;
  /** Altura mínima da área coberta. */
  minHeight?: string;
  className?: string;
}

/**
 * Carregamento de rota. O esqueleto atrás dá volume ao desfoque — um véu
 * sobre o vazio some, sobre uma silhueta de página ele lê como "a tela está
 * chegando".
 */
export function PageLoader({
  label = "Carregando…",
  minHeight = "min(70vh, 640px)",
  className,
}: PageLoaderProps) {
  return (
    <div className={cn("relative w-full", className)} style={{ minHeight }} aria-busy>
      <div className="animate-pulse space-y-4 pt-2" aria-hidden>
        <div className="h-8 w-64 max-w-[70%] rounded-lg bg-foreground/5" />
        <div className="h-4 w-96 max-w-full rounded bg-foreground/5" />
        <div className="grid gap-3 pt-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="h-24 rounded-2xl bg-foreground/5" />
          ))}
        </div>
        <div className="grid gap-4 pt-2 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-48 rounded-2xl bg-foreground/5" />
          ))}
        </div>
      </div>
      <LoadingVeil label={label} />
    </div>
  );
}
