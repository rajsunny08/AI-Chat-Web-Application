# NeuralChat — AI Chat Web App

A beautiful AI chat app powered by Claude. Uses a local Node.js proxy to avoid CORS issues.

---

## ✅ Quick Start (3 steps)

### Step 1 — Install Node.js
Download from https://nodejs.org (LTS version recommended)

### Step 2 — Install dependencies & start server
Open a terminal in this folder and run:

```bash
npm install
npm start
```

You'll see:
```
✅  NeuralChat running at http://localhost:3000
```

### Step 3 — Open the app
Go to **http://localhost:3000** in your browser.

Enter your Anthropic API key in the sidebar and start chatting!

---

## Getting an Anthropic API Key

1. Go to https://console.anthropic.com
2. Sign in or create a free account
3. Click **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-api03-...`)
5. Paste it into the **API KEY** field in the app sidebar and click **Save**

---

## Project Structure

```
ai-chat-app/
├── server.js          ← Node.js proxy server (prevents CORS errors)
├── package.json       ← Dependencies
├── public/
│   ├── index.html     ← Main UI
│   ├── css/style.css  ← Styles
│   └── js/app.js      ← Frontend logic
└── README.md
```

## Why a proxy server?

Browsers block direct calls to the Anthropic API (CORS policy). The Node.js server
forwards requests from your browser to Anthropic on your behalf — no CORS, no issues.

## Development (auto-restart on file changes)

```bash
npm run dev
```

## Deploy to the web

**Railway** (easiest):
1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub
3. Set env variable: `PORT=3000`

**Render**:
1. Push to GitHub
2. New Web Service → connect repo
3. Build command: `npm install`  Start command: `npm start`
