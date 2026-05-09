
// ============================================================
//  NeuralChat — Proxy Server
//  Forwards requests from the browser to the Anthropic API.
//  Keeps the API key off the client and avoids CORS issues.
// ============================================================

const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Allowed Claude models (whitelist) ────────────────────────
const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'claude-haiku-4-5-20251001',
]);

// ── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));

// FIX 1: Serve static files from 'public/' folder.
// Your README says files are in public/ but they're at root level.
// Either move your files into a public/ folder (recommended),
// OR change this line to: path.join(__dirname)
// We use 'public' here — move index.html, style.css, app.js there.
app.use(express.static(path.join(__dirname, 'public')));

// ── Proxy endpoint ───────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  // FIX 2: API key validation — also check it's a non-empty string
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({
      error: 'Missing or invalid API key. Add your Anthropic key in the app sidebar.',
    });
  }

  // FIX 3: Validate the request body before forwarding it.
  // Without this, a bad request crashes the upstream call unnecessarily.
  const { model, messages, max_tokens, stream } = req.body;

  if (!model || !ALLOWED_MODELS.has(model)) {
    return res.status(400).json({ error: `Invalid or unsupported model: ${model}` });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array.' });
  }
  if (!max_tokens || typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 8192) {
    return res.status(400).json({ error: 'max_tokens must be a number between 1 and 8192.' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      // FIX 4: Only forward the fields Anthropic expects — never blindly
      // forward req.body, which could contain unexpected/malicious fields.
      body: JSON.stringify({ model, messages, max_tokens, stream: stream ?? true }),
    });

    // FIX 5: If Anthropic returns an error (4xx/5xx), forward it properly
    // instead of piping a broken stream to the browser silently.
    if (!upstream.ok) {
      const errBody = await upstream.text();
      return res.status(upstream.status).json({
        error: `Anthropic API error (${upstream.status}): ${errBody}`,
      });
    }

    // Stream the response back to the browser
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');

    // FIX 6: Handle client disconnects gracefully to avoid unhandled pipe errors.
    upstream.body.on('error', err => {
      console.error('Upstream stream error:', err.message);
      if (!res.headersSent) res.status(502).end();
    });

    res.on('close', () => {
      upstream.body.destroy(); // client disconnected — stop reading upstream
    });

    upstream.body.pipe(res);

  } catch (err) {
    // FIX 7: Never expose raw error internals to the client in production.
    console.error('Proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to reach Anthropic API. Please try again.' });
    }
  }
});

// ── Health check (useful for Railway / Render deploy checks) ─
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ── Fallback — serve index.html for any unmatched route ──────
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () => {
  console.log(`\n✅  NeuralChat running at http://localhost:${PORT}\n`);
});
