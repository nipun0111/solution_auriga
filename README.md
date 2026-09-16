# Gathered

A browser-based shared-cost pool tracker for collecting contributions and settling balances fairly.

## Run locally

Install dependencies and generate the deployable stylesheet:

```bash
npm install
npm run build
```

For live CSS rebuilding during development:

```bash
npm run dev
```

Open `index.html` in a browser. Pool data is saved in the browser's local storage.

## Build layout

- `styles/input.css` is the Tailwind source stylesheet and custom component styling.
- `dist/output.css` is the generated, minified stylesheet loaded by the page.
- `src/` contains the pool calculations, settlement logic, persistence, and UI entrypoint.
