# BENCHMARK SMID

App Next.js: **inputs → Apify → reporte** de inteligencia publicitaria competitiva.

## Flujo

1. Abre [`/nuevo`](http://127.0.0.1:3000/nuevo)
2. Ingresa empresa, competencia, datos propios y fuentes
3. Corre el análisis:
   - **Demo** (sin token): reporte ilustrativo SMID en segundos
   - **Live** (con `APIFY_TOKEN`): lanza Actors de Meta / Google / prensa
4. Revisa el entregable en `/analisis/[id]`

## Arranque local

```bash
cd smid-benchmark
cp .env.example .env.local
# pega tu APIFY_TOKEN (opcional para demo)
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Abre: [http://127.0.0.1:3000/nuevo](http://127.0.0.1:3000/nuevo)

## Conectar Apify (modo live)

1. En [Apify Console → Integrations](https://console.apify.com/account/integrations) copia el API token
2. Ponlo en `.env.local`:

```bash
APIFY_TOKEN=apify_api_xxx
```

3. Reinicia `npm run dev`
4. En `/nuevo`, **desmarca** “Forzar modo demo” y corre el análisis

Actors por defecto (configurables):

| Fuente | Variable | Default |
|---|---|---|
| Meta | `APIFY_META_ACTOR_ID` | `apify/facebook-ads-scraper` |
| Google | `APIFY_GOOGLE_ACTOR_ID` | `curious_coder/google-ads-transparency-scraper` |
| Prensa | `APIFY_PRESS_ACTOR_ID` | `apify/website-content-crawler` |

## Deploy en Vercel (MCP o dashboard)

Proyecto ya creado en el team: **smid-benchmark**  
Team: `doblitasgmailcoms-projects`

1. En Vercel → Project → Settings → Environment Variables agrega:
   - `APIFY_TOKEN`
   - (opcional) IDs de Actors
2. Redeploy production (desde MCP `deploy_to_vercel` o conectando el repo Git)
3. URL esperada: `https://smid-benchmark-doblitasgmailcoms-projects.vercel.app`

> El primer deploy vía MCP falló por una versión compactada sin tipos. El código local **sí compila** (`npm run build`). Hay que redeployar con los archivos tipados del directorio `smid-benchmark/`.

## Entregables SMID del reporte

1. Temáticas de comunicación  
2. SOV impresiones medios externos  
3. SOV impresiones medios propios de pago  
4. Inversión estimada Meta / Google  

Las impresiones e inversión se etiquetan siempre como **estimadas**.
