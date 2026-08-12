import type { AdSignal, Confidence, ThemeRow } from "./types";

const THEME_RULES: Array<{ theme: string; pattern: RegExp }> = [
  {
    theme: "Financiamiento",
    pattern:
      /\b(financi|cuota|cr[eé]dito|tasa|banco|leasing|entrada|mensualidad|desde\s*usd|desde\s*\$)\b/i,
  },
  {
    theme: "Promoción",
    pattern:
      /\b(bono|descuento|oferta|promo|%|rebaja|ahorra|gratis|beneficio|especial)\b/i,
  },
  {
    theme: "Test drive",
    pattern: /\b(test\s*drive|prueba\s*de\s*manejo|agenda|cotiz|visita\s*el\s*showroom)\b/i,
  },
  {
    theme: "Lanzamiento",
    pattern: /\b(lanzamiento|nuevo|nueva|llega|estreno|presenta|debut)\b/i,
  },
  {
    theme: "Fecha especial",
    pattern:
      /\b(d[ií]a\s*de\s*la\s*madre|padre|navidad|a[nñ]o\s*nuevo|feriado|fiestas|black\s*friday|cyber)\b/i,
  },
  {
    theme: "Seguridad",
    pattern: /\b(seguridad|airbag|abs|control\s*de\s*estabilidad|adas|5\s*estrellas)\b/i,
  },
  {
    theme: "Posventa",
    pattern: /\b(servicio|taller|garant[ií]a|repuestos|mantenimiento)\b/i,
  },
  {
    theme: "Sostenibilidad",
    pattern: /\b(h[ií]brido|el[eé]ctrico|eco|sustentable|ev\b|phev)\b/i,
  },
  {
    theme: "Producto",
    pattern:
      /\b(sportage|seltos|sorento|rio|picanto|carnival|creta|tucson|santa\s*fe|accent|i10|i20|hb20|staria)\b/i,
  },
];

const MODEL_PATTERNS: Array<{ brandHint: string; product: string; pattern: RegExp }> = [
  { brandHint: "kia", product: "Sportage", pattern: /\bsportage\b/i },
  { brandHint: "kia", product: "Seltos", pattern: /\bseltos\b/i },
  { brandHint: "kia", product: "Sorento", pattern: /\bsorento\b/i },
  { brandHint: "kia", product: "Rio", pattern: /\brio\b/i },
  { brandHint: "kia", product: "Picanto", pattern: /\bpicanto\b/i },
  { brandHint: "kia", product: "Carnival", pattern: /\bcarnival\b/i },
  { brandHint: "hyundai", product: "Creta", pattern: /\bcreta\b/i },
  { brandHint: "hyundai", product: "Tucson", pattern: /\btucson\b/i },
  { brandHint: "hyundai", product: "Santa Fe", pattern: /\bsanta\s*fe\b/i },
  { brandHint: "hyundai", product: "Accent", pattern: /\baccent\b/i },
  { brandHint: "hyundai", product: "HB20", pattern: /\bhb20\b/i },
  { brandHint: "hyundai", product: "Staria", pattern: /\bstaria\b/i },
];

function extractOffer(text: string): string {
  const money =
    text.match(
      /(?:bono|desde|cuota|descuento|ahorra)?[^\d]{0,12}(?:USD|US\$|\$)\s*[\d.,]+(?:\s*(?:\/\s*mes|mensuales?))?/i,
    ) || text.match(/\b\d{1,3}\s*%\s*(?:de\s*)?(?:dto|descuento|bono)?/i);
  if (money?.[0]) return money[0].replace(/\s+/g, " ").trim().slice(0, 80);

  const cue = text.match(
    /\b(?:bono|oferta|cuota|financiamiento|test drive|prueba de manejo)[^.!?]{0,60}/i,
  );
  if (cue?.[0]) return cue[0].replace(/\s+/g, " ").trim().slice(0, 80);
  return "";
}

function detectProduct(brand: string, text: string): string {
  const brandKey = brand.toLowerCase();
  for (const model of MODEL_PATTERNS) {
    if (model.pattern.test(text)) {
      if (!model.brandHint || brandKey.includes(model.brandHint)) {
        return model.product;
      }
      return model.product;
    }
  }
  return brand;
}

function detectTheme(text: string): { theme: string; confidence: Confidence } {
  for (const rule of THEME_RULES) {
    if (rule.pattern.test(text)) {
      return {
        theme: rule.theme,
        confidence: rule.theme === "Producto" ? "Media" : "Media",
      };
    }
  }
  if (text.trim().length > 40) {
    return { theme: "Marca", confidence: "Baja" };
  }
  return { theme: "Otros", confidence: "Baja" };
}

function campaignLabel(theme: string, product: string, offer: string): string {
  if (theme === "Fecha especial") return "Campaña de fecha especial";
  if (theme === "Financiamiento") return `Financiamiento ${product}`;
  if (theme === "Promoción" && offer) return `Promoción · ${offer.slice(0, 40)}`;
  if (theme === "Lanzamiento") return `Lanzamiento ${product}`;
  if (theme === "Test drive") return `Test drive ${product}`;
  if (product && product !== "") return `${theme} · ${product}`;
  return `Campaña · ${theme}`;
}

/** Agrupa anuncios similares en filas comerciales de temáticas. */
export function classifyThemes(ads: AdSignal[]): ThemeRow[] {
  const groups = new Map<string, ThemeRow & { count: number }>();

  for (const ad of ads) {
    const text = `${ad.headline} ${ad.body} ${ad.cta}`.trim();
    if (!text && !ad.brand) continue;

    const { theme, confidence } = detectTheme(text);
    const product = detectProduct(ad.brand, text);
    const offer = extractOffer(text) || (ad.cta ? `CTA: ${ad.cta}` : "Sin oferta explícita");
    const campaign = campaignLabel(theme, product, offer);
    const key = `${ad.brand}|${theme}|${product}|${offer.slice(0, 40)}|${ad.platform}`;

    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    groups.set(key, {
      brand: ad.brand,
      campaign,
      theme,
      product,
      offer,
      platforms: ad.platform,
      evidence: ad.evidence || ad.id,
      confidence,
      count: 1,
    });
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 16)
    .map(({ count: _c, ...row }) => row);
}
