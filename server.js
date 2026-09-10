/**
 * Servidor Web Liviano y Portable — Kit de Auditoría Meta Ads
 * Integrado con el Agente Inspector de Código y Seguridad
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { runAudit, compareCompetitors } = require('./src/audit-engine');
const { runInspectorScan } = require('./src/inspector-bridge');

let PORT = parseInt(process.env.PORT, 10) || 3005;
const PUBLIC_DIR = path.join(__dirname, 'public');
const REPORTS_DIR = process.env.VERCEL
  ? path.join('/tmp', 'reportes')
  : path.join(__dirname, 'reportes');

// Asegurar que la carpeta de reportes exista
try {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
} catch (e) {}

// Tipos MIME comunes
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

async function handleRequest(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. API: Listar Historial de Reportes
  if (req.method === 'GET' && pathname === '/api/reports') {
    try {
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

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, reports: files }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 2. API: Ejecutar Auditoría de Meta Ads & Landing
  if (req.method === 'POST' && pathname === '/api/audit') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // Limitar 1MB
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const auditResult = await runAudit(payload);

        // Guardar archivo HTML en /reportes/
        const sanitizedBusiness = (payload.businessName || 'auditoria')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-');
        
        const timestamp = Date.now();
        const filename = `auditoria-meta-ads-${sanitizedBusiness}-${timestamp}.html`;
        const filePath = path.join(REPORTS_DIR, filename);

        fs.writeFileSync(filePath, auditResult.html, 'utf-8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          filename,
          reportUrl: `/reports/${filename}`,
          engine: auditResult.engine,
          html: auditResult.html
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 3. API: Comparativa 1 vs 1 con Competidor (Benchmark)
  if (req.method === 'POST' && pathname === '/api/compare') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const compareResult = await compareCompetitors(payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ...compareResult }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 4. API: Ejecutar Escaneo del Agente Inspector de Código y Seguridad
  if (req.method === 'POST' && pathname === '/api/inspector-scan') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const scanResult = await runInspectorScan(payload);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(scanResult));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 4. Servir archivos de Reportes (/reports/...)
  if (pathname.startsWith('/reports/')) {
    const filename = path.basename(pathname);
    const filePath = path.join(REPORTS_DIR, filename);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Reporte no encontrado');
      return;
    }
  }

  // 5. Servir archivos estáticos del frontend (/public/...)
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '') safePath = '/index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

const server = http.createServer(handleRequest);

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n=================================================`);
    console.log(`🚀 Kit de Auditoría Meta Ads + Agente Inspector Activo!`);
    console.log(`🌐 Servidor local: http://localhost:${port}`);
    console.log(`📁 Reportes guardados en: ${REPORTS_DIR}`);
    console.log(`=================================================\n`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Puerto ${port} ocupado, intentando con ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Error al iniciar el servidor:', err);
    }
  });
}

// Iniciar servidor solo en entorno local (no en Vercel serverless)
if (require.main === module && !process.env.VERCEL) {
  startServer(PORT);
}

module.exports = handleRequest;
module.exports.handleRequest = handleRequest;
module.exports.server = server;
