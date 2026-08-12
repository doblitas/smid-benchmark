# BENCHMARK SMID

Producto de inteligencia publicitaria competitiva: briefing → análisis → reporte mensual.

## Cómo usarlo

1. Abre **Nuevo análisis**
2. Completa cliente, competencia, periodo y fuentes (Meta Ads, Google Ads, medios digitales)
3. Opcional: marca *Generar muestra ilustrativa* para ver el formato del reporte con datos de ejemplo
4. Genera el reporte SMID y revisa:
   - Temáticas de comunicación
   - SOV de impresiones en medios externos
   - SOV de impresiones en medios propios de pago
   - Inversión estimada Meta / Google

Las impresiones e inversión se presentan siempre como **estimaciones**.

## Arranque local

```bash
cd smid-benchmark
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abre: [http://127.0.0.1:3000/nuevo](http://127.0.0.1:3000/nuevo)

## Desarrollo

Configuración opcional en `.env.local` (no visible en el producto):

- `APIFY_TOKEN` — habilita captura en vivo de Meta / Google
- `PRESS_CAPTURE_MODE` — `native` (default, escaneo liviano de portales) o `apify`
- `APIFY_*_ACTOR_ID` / `APIFY_*_MEMORY_MB` — ajuste fino de fuentes

Si una fuente falla, el reporte se completa con el resto (cobertura parcial).

Deploy: conectar el repo a Vercel y definir las variables de entorno en el proyecto.
