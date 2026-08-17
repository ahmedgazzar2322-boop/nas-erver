'use strict';

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

async function relayToPi(targetUrl, path, body = {}, method = 'POST', res = null) {
  const fullUrl = `${targetUrl.replace(/\/$/, '')}${path}`;
  const response = await fetch(fullUrl, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method !== 'GET' ? JSON.stringify(body) : undefined
  });
  return await response.json();
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'ONLINE', server: 'THOTH_NAS_CLOUD', timestamp: new Date().toISOString() });
});

// 1. Get Disks & Drives
app.post('/api/nas/drives', async (req, res) => {
  try {
    const { piServerUrl } = req.body || {};
    if (!piServerUrl) return res.status(400).json({ ok: false, error: 'piServerUrl required' });
    const data = await relayToPi(piServerUrl, '/api/nas/drives', {}, 'GET');
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 2. List Directory
app.post('/api/nas/list', async (req, res) => {
  try {
    const { piServerUrl, folderPath } = req.body || {};
    if (!piServerUrl) return res.status(400).json({ ok: false, error: 'piServerUrl required' });
    const data = await relayToPi(piServerUrl, '/api/nas/list', { folderPath }, 'POST');
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 3. Upload File
app.post('/api/nas/upload', async (req, res) => {
  try {
    const { piServerUrl, targetPath, filename, fileData, isBase64 } = req.body || {};
    if (!piServerUrl) return res.status(400).json({ ok: false, error: 'piServerUrl required' });
    const data = await relayToPi(piServerUrl, '/api/nas/upload', { targetPath, filename, fileData, isBase64 }, 'POST');
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Create Folder
app.post('/api/nas/mkdir', async (req, res) => {
  try {
    const { piServerUrl, folderName, currentPath } = req.body || {};
    if (!piServerUrl) return res.status(400).json({ ok: false, error: 'piServerUrl required' });
    const data = await relayToPi(piServerUrl, '/api/nas/mkdir', { folderName, currentPath }, 'POST');
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Delete Item
app.post('/api/nas/delete', async (req, res) => {
  try {
    const { piServerUrl, itemPath } = req.body || {};
    if (!piServerUrl) return res.status(400).json({ ok: false, error: 'piServerUrl required' });
    const data = await relayToPi(piServerUrl, '/api/nas/delete', { itemPath }, 'POST');
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. Stocks Analytics Folders
app.post('/api/nas/analytics', async (req, res) => {
  try {
    const { piServerUrl } = req.body || {};
    if (!piServerUrl) return res.status(400).json({ ok: false, error: 'piServerUrl required' });
    const data = await relayToPi(piServerUrl, '/api/portfolio/analytics/folders', {}, 'GET');
    res.json(data);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => console.log(`NAS Server Portal API running on port ${PORT}`));
}
