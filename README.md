# BENCHMARK SMID

Producto de inteligencia publicitaria competitiva: briefing → captura → reporte mensual.

## Cómo usarlo

1. Abre **Nuevo análisis**
2. Completa cliente, competencia, periodo y fuentes
3. Genera el reporte SMID:
   - Temáticas de comunicación
   - SOV de impresiones en medios externos
   - SOV de impresiones en medios propios de pago
   - Inversión estimada Meta / Google

Las impresiones e inversión se presentan como **estimaciones**.

## Producción (Vercel)

1. Conecta el repo `doblitas/smid-benchmark`
2. En **Environment Variables** (Production) agrega:
   - `APIFY_TOKEN` — obligatorio (sin esto no se lanzan fuentes)
   - Opcional: `APIFY_META_ACTOR_ID`, `APIFY_GOOGLE_ACTOR_ID`, `APIFY_PRESS_ACTOR_ID`
   - Opcional: `PRESS_CAPTURE_MODE=apify` (default) o `native`
3. Redeploy

Los análisis y los runs de captura viven en producción (storage remoto). No uses modo muestra local.
