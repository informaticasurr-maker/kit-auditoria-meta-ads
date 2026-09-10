const path = require('path');
const fs = require('fs');

const REPORTS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'reportes')
  : path.join(__dirname, '..', 'reportes');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 200;
      return res.end(JSON.stringify({ success: true, reports: [] }));
    }

    const files = fs.readdirSync(REPORTS_DIR)
      .filter(f => f.endsWith('.html'))
      .map(f => {
        const stats = fs.statSync(path.join(REPORTS_DIR, f));
        const nameClean = f.replace(/^auditoria-meta-ads-/, '').replace(/\.html$/, '').replace(/-\d+$/, '').replace(/-/g, ' ');
        return {
          filename: f,
          title: nameClean.charAt(0).toUpperCase() + nameClean.slice(1),
          date: new Date(stats.mtime).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
          timestamp: stats.mtimeMs,
          url: `/reports/${f}`
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ success: true, reports: files }));
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
};
