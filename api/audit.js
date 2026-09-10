const { runAudit } = require('../src/audit-engine');
const path = require('path');
const fs = require('fs');

const REPORTS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'reportes')
  : path.join(__dirname, '..', 'reportes');

try {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
} catch (e) {}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) { payload = {}; }
    } else if (!payload) {
      payload = await new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
          if (body.length > 1e6) req.destroy();
        });
        req.on('end', () => {
          try { resolve(JSON.parse(body || '{}')); } catch (e) { resolve({}); }
        });
        req.on('error', () => resolve({}));
      });
    }

    const auditResult = await runAudit(payload || {});

    const sanitizedBusiness = ((payload && payload.businessName) || 'auditoria')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    
    const timestamp = Date.now();
    const filename = `auditoria-meta-ads-${sanitizedBusiness}-${timestamp}.html`;
    const filePath = path.join(REPORTS_DIR, filename);

    try {
      fs.writeFileSync(filePath, auditResult.html, 'utf-8');
    } catch (e) {}

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({
      success: true,
      filename,
      reportUrl: `/reports/${filename}`,
      engine: auditResult.engine,
      html: auditResult.html
    }));
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
};
