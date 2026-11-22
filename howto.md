# Gym · Pinky y Cerebro

Webapp (HTML + CSS + JS con módulos ES, sin build) para planificar y registrar entrenos. Ver `SPEC.md`.

## Librerías (`vendor/`)

- Firebase JS SDK 12.7.0 (Apache-2.0), bundle propio `vendor/firebase.js`.
- Chart.js 4.5.1 (MIT), Pico CSS 2.1.1 (MIT).
- `fuse.7.5.0.min.mjs` no se usa (descartada en la spec).

## Regenerar `vendor/firebase.js` (solo si cambia la versión)

En una carpeta temporal fuera del repo:

```
npm i firebase@12.7.0 esbuild
npx esbuild vendor-src/entry.js --bundle --format=esm --minify --outfile=vendor/firebase.js
```

## Local

`python3 -m http.server 8000` en la raíz del proyecto (en Windows, si `python3` no funciona, usa `python` o `py`) y 
abrir `http://localhost:8000/`.

Sólo si la API key ya está restringida por dominio, añadir `http://localhost:8000/*` y `http://127.0.0.1:8000/*` a 
sus referentes.
