/**
 * Lógica del Frontend (Client-side)
 * Incluye módulo de Auditoría Meta Ads y Agente Inspector de Código
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Elementos del DOM
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const auditForm = document.getElementById('audit-form');
  const btnSubmit = document.getElementById('btn-submit');
  const engineProvider = document.getElementById('engineProvider');
  const apiKeyGroup = document.getElementById('apiKeyGroup');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  
  const resultContainer = document.getElementById('result-container');
  const reportIframe = document.getElementById('report-iframe');
  const btnOpenTab = document.getElementById('btn-open-tab');
  const btnDownload = document.getElementById('btn-download');
  const resultMeta = document.getElementById('result-meta');

  const historyList = document.getElementById('history-list');
  const historyCount = document.getElementById('history-count');
  const btnRefreshHistory = document.getElementById('btn-refresh-history');

  // Inspector Form & Results
  const inspectorForm = document.getElementById('inspector-form');
  const btnRunInspector = document.getElementById('btn-run-inspector');
  const inspectorResults = document.getElementById('inspector-results');
  const inspectorConsole = document.getElementById('inspector-console');
  const inspScore = document.getElementById('insp-score');
  const inspCritical = document.getElementById('insp-critical');
  const inspHigh = document.getElementById('insp-high');
  const inspMed = document.getElementById('insp-med');
  const inspLow = document.getElementById('insp-low');

  let currentReportUrl = '';
  let currentReportHtml = '';

  // 2. Cargar API key guardada
  const savedKey = localStorage.getItem('meta_ads_gemini_key') || '';
  if (savedKey) geminiApiKeyInput.value = savedKey;

  // 3. Control de Estado Online / Offline
  function updateOnlineStatus() {
    if (navigator.onLine) {
      statusDot.classList.remove('offline');
      statusText.textContent = 'En Línea';
    } else {
      statusDot.classList.add('offline');
      statusText.textContent = 'Modo Offline';
      engineProvider.value = 'offline';
      apiKeyGroup.style.display = 'none';
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // 4. Selector de Motor
  engineProvider.addEventListener('change', () => {
    if (engineProvider.value === 'gemini') {
      apiKeyGroup.style.display = 'block';
    } else {
      apiKeyGroup.style.display = 'none';
    }
  });

  // 5. Navegación por Pestañas
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add('active');

      if (tabId === 'tab-history') {
        loadHistory();
      }
    });
  });

  // 6. Envío del Formulario de Auditoría Meta Ads
  auditForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const businessName = document.getElementById('businessName').value.trim();
    const landingUrl = document.getElementById('landingUrl').value.trim();
    const offerDetails = document.getElementById('offerDetails').value.trim();
    const targetAudience = document.getElementById('targetAudience').value.trim();
    const competitors = document.getElementById('competitors').value.trim();
    const provider = engineProvider.value;
    const apiKey = geminiApiKeyInput.value.trim();

    if (apiKey) {
      localStorage.setItem('meta_ads_gemini_key', apiKey);
    }

    btnSubmit.disabled = true;
    btnSubmit.querySelector('.btn-text').textContent = 'Analizando y Generando Informe 360°...';

    try {
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          landingUrl,
          offerDetails,
          targetAudience,
          competitors,
          provider,
          apiKey
        })
      });

      const data = await response.json();

      if (data.success) {
        currentReportUrl = data.reportUrl;
        currentReportHtml = data.html;

        resultContainer.style.display = 'block';
        reportIframe.srcdoc = data.html;
        resultMeta.textContent = `Negocio: ${businessName} • Motor: ${data.engine} • Guardado en /reportes/`;
        
        btnDownload.href = data.reportUrl || '#';
        btnDownload.download = data.filename || `auditoria-${businessName}.html`;

        resultContainer.scrollIntoView({ behavior: 'smooth' });
        loadHistory();
      } else {
        alert('Error al generar la auditoría: ' + (data.error || 'Error desconocido'));
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión: ' + (err.message || 'No se pudo comunicar con el servidor.'));
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.querySelector('.btn-text').textContent = 'Generar Auditoría Completa 360°';
    }
  });

  // 7. Ejecutar Escaneo del Agente Inspector
  if (inspectorForm) {
    inspectorForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const target = document.getElementById('inspectorTarget').value.trim() || '.';
      const useFix = document.getElementById('inspectorFix').checked;
      const useAi = document.getElementById('inspectorAi').checked;
      const apiKey = geminiApiKeyInput.value.trim();

      btnRunInspector.disabled = true;
      btnRunInspector.querySelector('.btn-text').textContent = 'Escaneando con el Agente Inspector...';

      try {
        const response = await fetch('/api/inspector-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target,
            useFix,
            useAi,
            apiKey
          })
        });

        const data = await response.json();

        if (data.success) {
          inspectorResults.style.display = 'block';
          inspScore.textContent = `${data.healthScore} / 100`;
          inspCritical.textContent = data.critical;
          inspHigh.textContent = data.high;
          inspMed.textContent = data.medium;
          inspLow.textContent = data.low;

          // Limpiar caracteres de escape de Rich para la consola web
          const cleanOutput = data.output.replace(/\[\d+m/g, '');
          inspectorConsole.textContent = cleanOutput || 'Escaneo completado sin observaciones.';

          inspectorResults.scrollIntoView({ behavior: 'smooth' });
        } else {
          alert('Error en el Agente Inspector: ' + (data.error || 'Error desconocido'));
        }
      } catch (err) {
        console.error(err);
        alert('Error al conectar con el Agente Inspector.');
      } finally {
        btnRunInspector.disabled = false;
        btnRunInspector.querySelector('.btn-text').textContent = 'Ejecutar Escaneo del Agente Inspector';
      }
    });
  }

  // 8. Botones de acción del resultado
  const btnPrintPdf = document.getElementById('btn-print-pdf');
  if (btnPrintPdf) {
    btnPrintPdf.addEventListener('click', () => {
      if (reportIframe && reportIframe.contentWindow) {
        reportIframe.contentWindow.focus();
        reportIframe.contentWindow.print();
      } else if (currentReportUrl) {
        const w = window.open(currentReportUrl, '_blank');
        w.onload = () => w.print();
      }
    });
  }

  btnOpenTab.addEventListener('click', () => {
    if (currentReportUrl) {
      window.open(currentReportUrl, '_blank');
    } else if (currentReportHtml) {
      const blob = new Blob([currentReportHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  });

  // 9. Ejecutar Benchmark de Competidores
  const compareForm = document.getElementById('compare-form');
  const btnRunCompare = document.getElementById('btn-run-compare');
  const compareResults = document.getElementById('compare-results');
  const compareSummaryBanner = document.getElementById('compare-summary-banner');
  const compareTableBody = document.getElementById('compare-table-body');
  const compThTarget = document.getElementById('comp-th-target');
  const compThRival = document.getElementById('comp-th-rival');
  const compareAdvantagesList = document.getElementById('compare-advantages-list');
  const compareWeaknessesList = document.getElementById('compare-weaknesses-list');

  if (compareForm) {
    compareForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const targetName = document.getElementById('compTargetName').value.trim();
      const targetUrl = document.getElementById('compTargetUrl').value.trim();
      const competitorName = document.getElementById('compRivalName').value.trim();
      const competitorUrl = document.getElementById('compRivalUrl').value.trim();

      btnRunCompare.disabled = true;
      btnRunCompare.querySelector('.btn-text').textContent = 'Analizando ambas páginas en paralelo...';

      try {
        const response = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetName,
            targetUrl,
            competitorName,
            competitorUrl
          })
        });

        const data = await response.json();

        if (data.success) {
          compareResults.style.display = 'block';
          compThTarget.textContent = data.target.name;
          compThRival.textContent = data.competitor.name;
          compareSummaryBanner.textContent = data.summary;

          const tInfo = data.target.info;
          const cInfo = data.competitor.info;

          const rows = [
            {
              metric: '🎯 Meta Pixel (fbq)',
              targetVal: tInfo.hasPixel ? '✅ Instalado' : '❌ Falta',
              targetOk: tInfo.hasPixel,
              rivalVal: cInfo.hasPixel ? '✅ Instalado' : '❌ Falta',
              rivalOk: cInfo.hasPixel,
              verdict: tInfo.hasPixel && !cInfo.hasPixel ? '🏆 Ventaja Tu Marca' : (!tInfo.hasPixel && cInfo.hasPixel ? '⚠️ Ventaja Rival' : 'Iguales')
            },
            {
              metric: '📊 Google Analytics',
              targetVal: tInfo.hasGtag ? '✅ Activo' : '❌ Inactivo',
              targetOk: tInfo.hasGtag,
              rivalVal: cInfo.hasGtag ? '✅ Activo' : '❌ Inactivo',
              rivalOk: cInfo.hasGtag,
              verdict: tInfo.hasGtag && !cInfo.hasGtag ? '🏆 Ventaja Tu Marca' : (!tInfo.hasGtag && cInfo.hasGtag ? '⚠️ Ventaja Rival' : 'Iguales')
            },
            {
              metric: '⚡ Velocidad Servidor (TTFB)',
              targetVal: `${tInfo.loadTimeSec} seg`,
              targetOk: parseFloat(tInfo.loadTimeSec) <= 1.5,
              rivalVal: `${cInfo.loadTimeSec} seg`,
              rivalOk: parseFloat(cInfo.loadTimeSec) <= 1.5,
              verdict: parseFloat(tInfo.loadTimeSec) < parseFloat(cInfo.loadTimeSec) ? '🏆 Más Rápido' : (parseFloat(tInfo.loadTimeSec) > parseFloat(cInfo.loadTimeSec) ? '⚠️ Más Lento' : 'Empate')
            },
            {
              metric: '🛡️ Ciberseguridad & Cabeceras',
              targetVal: `${tInfo.security.score}/100`,
              targetOk: tInfo.security.score >= 70,
              rivalVal: `${cInfo.security.score}/100`,
              rivalOk: cInfo.security.score >= 70,
              verdict: tInfo.security.score > cInfo.security.score ? '🏆 Mejor blindaje' : (tInfo.security.score < cInfo.security.score ? '⚠️ Menor blindaje' : 'Empate')
            },
            {
              metric: '🔐 Certificado SSL',
              targetVal: tInfo.sslInfo?.issuer || 'Activo',
              targetOk: tInfo.sslInfo?.isValid,
              rivalVal: cInfo.sslInfo?.issuer || 'Activo',
              rivalOk: cInfo.sslInfo?.isValid,
              verdict: 'Cifrado HTTPS'
            },
            {
              metric: '🛡️ Protección WAF / Anti-DDoS',
              targetVal: tInfo.waf?.isProtected ? '✅ Protegido (WAF)' : '⚠️ Servidor Directo',
              targetOk: tInfo.waf?.isProtected,
              rivalVal: cInfo.waf?.isProtected ? '✅ Protegido (WAF)' : '⚠️ Servidor Directo',
              rivalOk: cInfo.waf?.isProtected,
              verdict: tInfo.waf?.isProtected && !cInfo.waf?.isProtected ? '🏆 Servidor Blindado' : 'Empate'
            },
            {
              metric: '📱 WhatsApp & Redes',
              targetVal: `${Object.values(tInfo.socialLinks || {}).filter(Boolean).length} canales`,
              targetOk: Boolean(tInfo.socialLinks?.whatsapp),
              rivalVal: `${Object.values(cInfo.socialLinks || {}).filter(Boolean).length} canales`,
              rivalOk: Boolean(cInfo.socialLinks?.whatsapp),
              verdict: tInfo.socialLinks?.whatsapp && !cInfo.socialLinks?.whatsapp ? '🏆 WhatsApp Activo' : 'Omnicanal'
            },
            {
              metric: '⚖️ Política de Privacidad (Legal Meta)',
              targetVal: tInfo.legalCompliance?.hasPrivacyPolicy ? '✅ Verificada' : '❌ Falta',
              targetOk: tInfo.legalCompliance?.hasPrivacyPolicy,
              rivalVal: cInfo.legalCompliance?.hasPrivacyPolicy ? '✅ Verificada' : '❌ Falta',
              rivalOk: cInfo.legalCompliance?.hasPrivacyPolicy,
              verdict: tInfo.legalCompliance?.hasPrivacyPolicy && !cInfo.legalCompliance?.hasPrivacyPolicy ? '🏆 Cumple Meta' : 'Auditoría Legal'
            }
          ];

          compareTableBody.innerHTML = rows.map(r => `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
              <td style="padding: 0.8rem; font-weight: 600;">${r.metric}</td>
              <td style="padding: 0.8rem; color: ${r.targetOk ? 'var(--emerald)' : 'var(--rose)'};">${r.targetVal}</td>
              <td style="padding: 0.8rem; color: ${r.rivalOk ? 'var(--emerald)' : 'var(--rose)'};">${r.rivalVal}</td>
              <td style="padding: 0.8rem; color: var(--text-muted); font-size: 0.82rem;">${r.verdict}</td>
            </tr>
          `).join('');

          // Ventajas y Desventajas
          compareAdvantagesList.innerHTML = data.advantages.length > 0
            ? data.advantages.map(a => `<li style="margin-bottom:0.4rem;">${escapeHtml(a)}</li>`).join('')
            : '<li style="color:var(--text-muted);">Sin ventajas detectadas frente al rival.</li>';

          compareWeaknessesList.innerHTML = data.weaknesses.length > 0
            ? data.weaknesses.map(w => `<li style="margin-bottom:0.4rem;">${escapeHtml(w)}</li>`).join('')
            : '<li style="color:var(--emerald);">¡Excelente! No se detectaron desventajas críticas frente a este rival.</li>';

          compareResults.scrollIntoView({ behavior: 'smooth' });
        } else {
          alert('Error al realizar el benchmark: ' + (data.error || 'Error desconocido'));
        }
      } catch (err) {
        console.error(err);
        alert('Error conectando con el servidor para la comparativa.');
      } finally {
        btnRunCompare.disabled = false;
        btnRunCompare.querySelector('.btn-text').textContent = 'Ejecutar Benchmark Comparativo';
      }
    });
  }

  // 10. Cargar Historial de Reportes
  async function loadHistory() {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();

      if (data.reports) {
        historyCount.textContent = data.reports.length;

        if (data.reports.length === 0) {
          historyList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">
              <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">📂 Aún no has generado ninguna auditoría.</p>
              <p style="font-size: 0.85rem;">Completa el formulario en la pestaña "Auditoría Meta Ads" para comenzar.</p>
            </div>
          `;
          return;
        }

        historyList.innerHTML = data.reports.map(rep => `
          <div class="history-card">
            <div>
              <div class="history-title">${escapeHtml(rep.title)}</div>
              <div class="history-meta">
                📅 ${rep.date} • 📁 ${rep.filename}
              </div>
            </div>
            <div class="history-actions">
              <a href="${rep.url}" target="_blank" class="action-btn"><span>👁️</span> Ver Reporte</a>
              <a href="${rep.url}" download="${rep.filename}" class="action-btn btn-primary"><span>⬇️</span> Descargar</a>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  }

  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', loadHistory);
  }

  loadHistory();
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
