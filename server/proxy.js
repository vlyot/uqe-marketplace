// server/proxy.js
const express = require('express');
// Use dynamic import for node-fetch for compatibility
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const app = express();

// Add CORS middleware for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/rolimons/items/v1/itemdetails', async (req, res) => {
  const url = 'https://api.rolimons.com/items/v1/itemdetails';
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Proxy)' }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Rolimons API error:', response.status, text);
      return res.status(500).send(`Rolimons proxy failed: ${response.status} - ${text}`);
    }
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error('Proxy fetch error:', err);
    res.status(500).send('Error fetching data: ' + err.message);
  }
});

// Proxy for Roblox thumbnails API
app.get('/roblox/thumbnails', async (req, res) => {
  const { assetIds, size = '420x420', format = 'Png' } = req.query;
  if (!assetIds) {
    return res.status(400).send('Missing assetIds');
  }
  const url = `https://thumbnails.roblox.com/v1/assets?assetIds=${assetIds}&size=${size}&format=${format}`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Proxy)' }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Roblox Thumbnails API error:', response.status, text);
      return res.status(500).send(`Roblox thumbnails proxy failed: ${response.status} - ${text}`);
    }
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error('Proxy fetch error:', err);
    res.status(500).send('Error fetching data: ' + err.message);
  }
});

// Proxy for Adurite market API
app.get('/adurite/market/roblox', async (req, res) => {
  const url = 'https://adurite.com/api/market/roblox';
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Proxy)' }
    });
    if (!response.ok) {
      const text = await response.text();
      console.error('Adurite API error:', response.status, text);
      return res.status(500).send(`Adurite proxy failed: ${response.status} - ${text}`);
    }
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error('Proxy fetch error:', err);
    res.status(500).send('Error fetching data: ' + err.message);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
