import fs from "node:fs";
import path from "node:path";
import { Image, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { PDF_FONT } from "@/lib/pdf/fonts";

/**
 * Identidade visual dos PDFs da plataforma (aula e tarefa).
 *
 * As cores são as mesmas de `globals.css` — o react-pdf não lê CSS, então
 * elas são repetidas aqui. O logo é o de `public/du_ingles_logo.svg`,
 * rasterizado uma vez para PNG em `./brand` (o react-pdf não desenha SVG de
 * arquivo); a pasta vai para o bundle do servidor via
 * `outputFileTracingIncludes` em `next.config.ts`, como as fontes.
 *
 * Geometria: as páginas usam 40pt de margem lateral e `PAGE_TOP` de margem
 * superior. O cabeçalho sangra até a borda com margem negativa, então só a
 * primeira página o tem — as seguintes começam direto no conteúdo.
 */

export const BRAND = {
  navy950: "#050f22",
  navy900: "#0a1f44",
  navy800: "#0f2c5c",
  navy700: "#143a76",
  navy100: "#dbe5f5",
  navy50: "#eef3fb",
  gold700: "#8a6d1b",
  gold600: "#a8842a",
  gold500: "#c9a227",
  gold400: "#d9b45b",
  gold300: "#e7cd8c",
  gold100: "#f7edd2",
  gold50: "#fdf8ec",
  cream: "#faf6ec",
  ink: "#0b1a33",
  muted: "#64748b",
  line: "#e6dcc3",
  white: "#ffffff",
} as const;

export const PAGE_SIDE = 40;
export const PAGE_TOP = 36;
export const PAGE_BOTTOM = 64;

const brandDir = path.join(process.cwd(), "src", "lib", "pdf", "brand");

let logoCache: Buffer | null = null;
function logo(): Buffer {
  logoCache ??= fs.readFileSync(path.join(brandDir, "du_ingles_logo.png"));
  return logoCache;
}

const styles = StyleSheet.create({
  header: {
    marginTop: -PAGE_TOP,
    marginHorizontal: -PAGE_SIDE,
    backgroundColor: BRAND.navy900,
    paddingHorizontal: PAGE_SIDE,
    paddingTop: 30,
    paddingBottom: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  orb: {
    position: "absolute",
    top: -90,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: BRAND.navy800,
  },
  orbInner: {
    position: "absolute",
    top: -40,
    right: -10,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: BRAND.navy700,
    opacity: 0.55,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logoTile: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: BRAND.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  logo: { width: 40, height: 34 },
  schoolName: { fontSize: 17, fontWeight: 700, color: BRAND.white },
  tagline: { fontSize: 8.5, color: BRAND.gold300, marginTop: 3, letterSpacing: 0.4 },
  badge: {
    minWidth: 150,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: BRAND.gold500,
    alignItems: "flex-end",
  },
  badgeKicker: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.6,
    color: BRAND.navy900,
  },
  badgeValue: { fontSize: 24, fontWeight: 700, color: BRAND.navy950, marginTop: 2 },
  badgeCaption: { fontSize: 8, color: BRAND.navy900, marginTop: 1 },
  stripe: {
    marginHorizontal: -PAGE_SIDE,
    height: 4,
    backgroundColor: BRAND.gold500,
  },
  subBar: {
    marginHorizontal: -PAGE_SIDE,
    paddingHorizontal: PAGE_SIDE,
    paddingVertical: 8,
    backgroundColor: BRAND.cream,
    borderBottom: `0.75pt solid ${BRAND.line}`,
    fontSize: 8.5,
    color: BRAND.muted,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 34,
    paddingHorizontal: PAGE_SIDE,
    backgroundColor: BRAND.cream,
    borderTop: `0.75pt solid ${BRAND.line}`,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    fontFamily: PDF_FONT,
    fontSize: 7.5,
    color: BRAND.muted,
  },
  footerBrand: { color: BRAND.gold700, fontWeight: 700 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.6,
    color: BRAND.gold700,
    marginRight: 10,
  },
  sectionRule: { flex: 1, height: 0.75, backgroundColor: BRAND.line },
});

export const brandPageStyle = {
  paddingTop: PAGE_TOP,
  paddingBottom: PAGE_BOTTOM,
  paddingHorizontal: PAGE_SIDE,
  fontFamily: PDF_FONT,
  color: BRAND.ink,
  backgroundColor: BRAND.white,
} as const;

/** Faixa azul-marinho com logo, nome da escola e o selo dourado do documento. */
export function BrandHeader({
  schoolName,
  tagline,
  kicker,
  value,
  caption,
  subBar,
}: {
  schoolName: string;
  tagline: string;
  kicker: string;
  value: string;
  caption?: string;
  subBar?: string;
}) {
  return (
    <View>
      <View style={styles.header}>
        <View style={styles.orb} />
        <View style={styles.orbInner} />
        <View style={styles.brandRow}>
          <View style={styles.logoTile}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- Image do react-pdf, não <img> */}
            <Image src={{ data: logo(), format: "png" }} style={styles.logo} />
          </View>
          <View>
            <Text style={styles.schoolName}>{schoolName}</Text>
            <Text style={styles.tagline}>{tagline}</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeKicker}>{kicker}</Text>
          <Text style={styles.badgeValue}>{value}</Text>
          {caption ? <Text style={styles.badgeCaption}>{caption}</Text> : null}
        </View>
      </View>
      <View style={styles.stripe} />
      {subBar ? <Text style={styles.subBar}>{subBar}</Text> : null}
    </View>
  );
}

/** Rodapé fixo em toda página: marca à esquerda, paginação à direita. */
export function BrandFooter({ label }: { label: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>
        <Text style={styles.footerBrand}>Du Inglês</Text>
        {`  ·  ${label}`}
      </Text>
      <Text
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

/** Rótulo de seção em caixa-alta dourada com fio até a margem. */
export function BrandSection({
  label,
  children,
}: {
  label: string;
  children?: ReactNode;
}) {
  return (
    <View>
      <View style={styles.sectionRow} minPresenceAhead={60}>
        <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
        <View style={styles.sectionRule} />
      </View>
      {children}
    </View>
  );
}
