# Project Lift-Off Plan: Kapruka AI Gifting & Shopping Orchestrator

This repository is structured as a decoupled full-stack application.
- `/frontend`: High-fidelity, reactive conversational dashboard (Next.js, Tailwind CSS, TypeScript) with a luxury lifestyle-magazine aesthetic.
- `/backend`: Orchestration, NLP routing, and MCP Integration layer (Node.js/Express, TypeScript).

---

## 1. Directory Structure Blueprint

```
d:/kapruka-ai/
├── PLAN.md                  # This file
├── frontend/                # Next.js App Router Frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   └── page.tsx
│       ├── components/
│       │   ├── GiftBoxBuilder.tsx
│       │   ├── ProductCard.tsx
│       │   ├── LogisticsPanel.tsx
│       │   ├── ChatInterface.tsx
│       │   └── CountdownCard.tsx
│       └── utils/
│           └── api.ts
└── backend/                 # Node.js/Express TypeScript Backend
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts
        ├── routes/
        │   └── mcp.ts       # Central MCP routing middleware with validation stubs
        ├── services/
        │   ├── mcpClient.ts # Handles communication with the Kapruka MCP Server
        │   ├── nlpService.ts
        │   └── bundlerService.ts
        └── utils/
            └── validator.ts
```

---

## 2. Design System & Visual Tokens

We enforce a premium **lifestyle-magazine design system**:
* **Canvas Colors:**
  * `--luxury-ivory`: `#FDFBF7` (Canvas background)
  * `--alabaster-card`: `#FFFFFF` (Cards and panels)
  * `--muted-stone`: `#EAE6DF` (Soft borders, frames, and dividers)
* **Brand Accents:**
  * `--kapruka-purple`: `#2A114B` (Deep regal brand color for titles/heavy headers)
  * `--kapruka-gold`: `#FAE555` (Vibrant accent for CTAs, loaders, progress status)
  * `--iris-black`: `#1B122C` (Contrast body text)
* **Typography:**
  * Displays: Serif display face (e.g. Playfair Display, Cormorant Garamond)
  * UI Elements: Sans-serif (e.g. Plus Jakarta Sans, Inter)

---

## 3. Structural Canvas (The 60/40 Split Layout)

- **Column A (Left 60% Width):** The Curation Space.
  - *Dynamic Gift Box Builder:* Animated hamper visualization header.
  - *Product Catalog Grid:* High-contrast product cards with cover-wrapped images, LKR pricing, and secure Kapruka fallback links.
  - *Logistics Checker & Validation Status:* Location status and perishable warnings (temperature icon with amber text for cakes, flowers, chocolates).
- **Column B (Right 40% Width):** The Concierge Terminal.
  - *Chat Panel:* Clean narrative message logs (specifics of products are moved to Column A).
  - *Active Input Dock:* Minimal prompt bar with voice/microphone trigger icon.

---

## 4. Central MCP Routing Middleware & Validation Stubs

The backend middleware in `/backend/src/routes/mcp.ts` enforces parameters observed for the MCP tools:

| MCP Tool | Path | Parameters | Validation Rules |
|---|---|---|---|
| `kapruka_search_products` | `/api/mcp/search` | `q` (string), `category` (string?), `min_price` (number?), `max_price` (number?), `in_stock_only` (boolean?), `sort` (string?), `limit` (number?), `cursor` (string?), `currency` (string?) | Limits search pages to 3. Matches pricing filters. |
| `kapruka_get_product` | `/api/mcp/product` | `product_id` (string/number), `currency` (string?) | Validates product presence. |
| `kapruka_list_categories` | `/api/mcp/categories` | `depth` (number?) | Returns list of browsable categories. |
| `kapruka_list_delivery_cities` | `/api/mcp/cities` | `query` (string), `limit` (number?) | Limit capped at 50, matches vernacular aliases. |
| `kapruka_check_delivery` | `/api/mcp/check-delivery` | `city` (string), `delivery_date` (string `YYYY-MM-DD`), `product_id` (string/number) | Returns rates, checks perishable categories. |
| `kapruka_create_order` | `/api/mcp/create-order` | `cart` (array), `recipient` (object), `delivery` (object), `sender` (object), `gift_message` (string?), `currency` (string?) | Generates a 60-minute guest checkout token. |
| `kapruka_track_order` | `/api/mcp/track-order` | `order_number` (string) | Looks up tracking progress and timeline steps. |
