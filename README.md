# CSJ Tek — BD Quote Tool

Internal tool for Cap Saint Jacques Tek to build software quotations, slideshows, Excel exports, and service contracts (DOCX).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Local-first storage (`localStorage`)
- ExcelJS (Excel with live formulas)
- `docx` (contract Word export)
- 9Router-compatible AI brief generation (server-side API)
- Share links encode quote payload in URL (`/p?data=...`)

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On Windows PowerShell, if `npm` scripts are blocked:

```powershell
npm.cmd run dev
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com/new).
3. Framework preset: **Next.js** (auto-detected).
4. Build command: `npm run build` · Output: default.
5. Deploy.

### Important notes after deploy

- **Quotes / clients / modules** are stored in the browser `localStorage` of whoever uses the admin UI. They are not shared across devices unless you migrate to a database later.
- **Share links** (`/p?data=...`) work on Vercel without a database because the quote is embedded in the URL.
- **AI Brief (Phase 7)** requires these Vercel Environment Variables:

```text
NINE_ROUTER_BASE_URL=https://your-9router-host/v1
NINE_ROUTER_API_KEY=...
NINE_ROUTER_MODEL=...
```

The API key is only read by the server route and is never sent to the browser.

## Main flows

1. Settings — company legal + bank info  
2. Clients — customer legal fields  
3. Modules — pricing catalog (suggestions only; prices editable)  
4. New quote — AI brief review/apply + modules + **deliverables** + payment milestones  
5. Export Excel (formulas) / PDF / slideshow share link / **Contract DOCX**

## Company seed

- CÔNG TY TNHH CAP SAINT JACQUES TEK  
- MST: 0319520814  
- Logo: `public/brand/logo.jpg`

## Phase status

| Phase | Status |
|---|---|
| Excel invoice layout + SUM formulas | Done |
| Deliverables appendix | Done |
| Contract fields + DOCX | Done |
| Edit quote / polish | Done |
| Vercel-ready | Done (this README) |
| AI via 9Router | Done |
