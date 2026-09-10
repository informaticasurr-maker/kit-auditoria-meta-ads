const { runInspectorScan } = require('../src/inspector-bridge');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
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

    const scanResult = await runInspectorScan(payload || {});
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(scanResult));
  } catch (err) {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ success: false, error: err.message }));
  }
};
