const express = require('express');
const fetch   = require('node-fetch');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Proxy endpoint ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(401).json({ error: 'Missing or invalid API key. Add your Anthropic key in the app sidebar.' });
  }

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':       'application/json',
        'x-api-key':          apiKey,
        'anthropic-version':  '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });

    // Stream the response straight back to the browser
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    upstream.body.pipe(res);

  } catch (err) {
    console.error('Proxy error:', err.message);
    res.status(502).json({ error: 'Failed to reach Anthropic API: ' + err.message });
  }
});

// ── Fallback ───────────────────────────────────────────────
app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`\n✅  NeuralChat running at http://localhost:${PORT}\n`);
});
