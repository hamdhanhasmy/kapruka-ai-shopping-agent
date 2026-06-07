# Kapruka AI Gifting & Shopping Orchestrator

An intelligent, conversational gifting concierge and personal shopping agent built on top of the Kapruka MCP (Model Context Protocol) gateway. The application is styled with a premium, luxury lifestyle-magazine aesthetic, offering a decoupled full-stack architecture that guides customers from undecided discovery to a secure 60-minute guest payment link.

---

## 🚀 Key Features

* **Multi-Lingual NLP Orchestrator**: Understands formal and casual phrasing in English, Sinhala, Tamil, and vernacular dialects like **Singlish** (e.g., *"mata cake ekak one Kandy heta"*) and **Tanglish** (e.g., *"enaku roses venum Colombo 3"*).
* **API Key Rotation & Redundancy**: Configured to cycle through a comma-separated list of multiple Gemini API keys automatically. If one key hits a `429 Too Many Requests` quota limit, the backend rotates to the next key seamlessly to prevent service interruption.
* **Smart Hamper Bundler & Optimizer**: Searches and bundles multiple items in parallel under a single budget limit. If the cheapest combination exceeds the budget, the local fallback engine warns the user and suggests cheaper categories.
* **Logistics & Perishability Guardrails**: Proactively runs delivery verification against target cities, calculates real-time shipping fees, and alerts users with temperature warnings for perishable goods like fresh flowers, chocolates, or cakes.
* **Curated Aesthetic Catalog**: An expanded 12-item premium product catalog with real-time text searching and category navigation pills (*All, Flowers, Cakes, Cards, Chocolates, Toys, Hampers*).
* **60-Minute Click-to-Pay Lock**: Generates secure checkout tokens that lock item prices and delivery rates for 60 minutes, displaying a visual circular countdown widget.

---

## 📁 Repository Structure

```
d:/kapruka-ai/
├── README.md                # Project documentation (this file)
├── .gitignore               # Excludes build assets, node_modules, and env keys
├── frontend/                # Next.js App Router Frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx     # Split-pane layout coordinator & state machine
│   │   │   └── globals.css  # Magazine canvas styling & design tokens
│   │   ├── components/      # Countdown, Logistics, Hamper, Chat, and Product views
│   │   └── utils/
│   │       └── api.ts       # Connected API client helper
└── backend/                 # Express API Backend Node Service
    ├── package.json
    ├── tsconfig.json
    ├── .env                 # Environment secrets (rotated keys)
    └── src/
        ├── index.ts         # Express server gateway & CORS
        ├── routes/
        │   └── mcp.ts       # API route endpoints & diagnostic tests
        ├── services/
        │   ├── mcpClient.ts # Streamable HTTP/SSE transport wrapper for MCP tools
        │   ├── nlpService.ts# Rotating Gemini client & rule-based fallbacks
        │   └── bundlerService.ts # Parallel constraint optimizer
```

---

## 🛠️ Local Installation & Setup

### 1. Prerequisites
Ensure you have [Node.js](https://nodejs.org/) (version 18+ recommended) and Git installed on your local system.

### 2. Clone and Install Dependencies

```bash
# Clone the repository
git clone <your-repository-url>
cd kapruka-ai

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Configure Backend Environment
Create a `.env` file in the `/backend` directory:
```env
PORT=3001
KAPRUKA_MCP_ENDPOINT=https://mcp.kapruka.com/mcp

# Add a single key or a comma-separated list of multiple keys for rotation
GEMINI_API_KEY=key_1,key_2,key_3,key_4,key_5
```

### 4. Run Locally
Open two terminal windows to start the services in parallel:

* **Start Backend**:
  ```bash
  cd backend
  npm run dev
  ```
  The API server will launch at `http://localhost:3001`. You can test connection health by visiting `http://localhost:3001/api/mcp/test-connection`.

* **Start Frontend**:
  ```bash
  cd frontend
  npm run dev
  ```
  The Next.js dev server will start at `http://localhost:3000`.

---

## ☁️ Deployment Guide

### A. Backend (Express App)
Can be deployed to platforms like **Render**, **Railway**, or **Heroku**:
1. Connect your GitHub repository.
2. Set the root directory of the service to `/backend`.
3. Build command: `npm install && npm run build`
4. Start command: `npm run start` (executes compiled Javascript in `dist/index.js`).
5. Configure environment variables (`GEMINI_API_KEY`, `KAPRUKA_MCP_ENDPOINT`, `PORT`) in your host's dashboard settings.

### B. Frontend (Next.js App)
Can be deployed easily to **Vercel**:
1. Link your GitHub repository in Vercel.
2. Set the root directory to `/frontend`.
3. Add the following environment variable to route API requests to your deployed backend:
   * `NEXT_PUBLIC_API_BASE_URL`: `<URL-of-your-deployed-backend-service>` (e.g., `https://your-backend-app.onrender.com`)
4. Click **Deploy**. Vercel will build and host your app with an SSL certificate automatically.
