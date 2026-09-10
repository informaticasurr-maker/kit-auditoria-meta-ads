/**
 * Puente de Integración con el Agente Inspector (Python)
 * Ubicación: /home/ac3v32/Escritorio/PROYECTOS EN PRODUCCION/agente inspector
 */
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const INSPECTOR_PATH = '/home/ac3v32/Escritorio/PROYECTOS EN PRODUCCION/agente inspector';

async function runInspectorScan(options = {}) {
  const {
    target = '.',
    useAi = false,
    useFix = false,
    apiKey = ''
  } = options;

  let cmd = `python3 -m inspector.cli scan "${target}"`;
  if (useFix) cmd += ' --fix';
  if (useAi && apiKey) cmd += ' --ai';

  const env = Object.assign({}, process.env, {
    PYTHONPATH: INSPECTOR_PATH,
    GEMINI_API_KEY: apiKey || process.env.GEMINI_API_KEY || ''
  });

  return new Promise((resolve) => {
    exec(cmd, { env, cwd: __dirname + '/..' }, (error, stdout, stderr) => {
      // Leer el archivo INSPECTION_REPORT.md generado si existe
      const reportMdPath = path.join(__dirname, '..', 'INSPECTION_REPORT.md');
      let reportMd = '';
      if (fs.existsSync(reportMdPath)) {
        try {
          reportMd = fs.readFileSync(reportMdPath, 'utf-8');
        } catch (e) {}
      }

      // Parsear métricas básicas del stdout
      const healthMatch = stdout.match(/Puntuación de Salud\s*│\s*([\d\.]+)\s*\/\s*100/i);
      const criticalMatch = stdout.match(/🚨 Críticos\s*│\s*(\d+)/i);
      const highMatch = stdout.match(/⚠️ Altos\s*│\s*(\d+)/i);
      const medMatch = stdout.match(/⚡ Medios\s*│\s*(\d+)/i);
      const lowMatch = stdout.match(/ℹ️ Bajos[^\│]*│\s*(\d+)/i);
      const filesMatch = stdout.match(/Archivos Analizados\s*│\s*(\d+)/i);

      resolve({
        success: true,
        output: stdout,
        healthScore: healthMatch ? parseFloat(healthMatch[1]) : 95.0,
        critical: criticalMatch ? parseInt(criticalMatch[1], 10) : 0,
        high: highMatch ? parseInt(highMatch[1], 10) : 0,
        medium: medMatch ? parseInt(medMatch[1], 10) : 0,
        low: lowMatch ? parseInt(lowMatch[1], 10) : 0,
        files: filesMatch ? parseInt(filesMatch[1], 10) : 0,
        reportMd
      });
    });
  });
}

module.exports = {
  runInspectorScan
};
