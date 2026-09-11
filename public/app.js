import { 
  loginWithGoogle, 
  logoutUser, 
  onUserChanged, 
  getCurrentUser, 
  saveAuditToCloud, 
  getCloudAudits, 
  deleteCloudAudit, 
  trackCustomEvent 
} from './firebase-service.js';

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

  // Firebase Auth Gate & Cloud Controls
  const authGateOverlay = document.getElementById('auth-gate-overlay');
  const appWrapper = document.getElementById('app-wrapper');
  const btnGoogleGateLogin = document.getElementById('btn-google-gate-login');
  const btnFirebaseLogin = document.getElementById('btn-firebase-login');
  const firebaseUserProfile = document.getElementById('firebase-user-profile');
  const firebaseUserAvatar = document.getElementById('firebase-user-avatar');
  const firebaseUserName = document.getElementById('firebase-user-name');
  const btnFirebaseLogout = document.getElementById('btn-firebase-logout');
  const btnSaveCloud = document.getElementById('btn-save-cloud');
  const btnFilterLocal = document.getElementById('btn-filter-local');
  const btnFilterCloud = document.getElementById('btn-filter-cloud');
  const cloudHistoryCount = document.getElementById('cloud-history-count');

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
  let lastAuditData = {};
  let currentHistoryTab = 'local';

  // 1.1 Verificación Estricta de Acceso por Cuenta Google (Auth Gate)
  onUserChanged((user) => {
    // Validar que el usuario exista, tenga email y pertenezca a Google
    const isGoogleUser = user && (
      (user.providerData && user.providerData.some(p => p.providerId === 'google.com')) ||
      (user.email && user.email.includes('@'))
    );

    if (isGoogleUser) {
      // Desbloquear aplicación
      if (authGateOverlay) authGateOverlay.classList.add('hidden');
      if (appWrapper) appWrapper.classList.remove('app-locked');

      if (btnFirebaseLogin) btnFirebaseLogin.style.display = 'none';
      if (firebaseUserProfile) {
        firebaseUserProfile.style.display = 'flex';
        firebaseUserName.textContent = user.displayName || user.email.split('@')[0] || 'Usuario';
        if (user.photoURL) {
          firebaseUserAvatar.src = user.photoURL;
          firebaseUserAvatar.style.display = 'inline-block';
        } else {
          firebaseUserAvatar.style.display = 'none';
        }
      }
      loadCloudHistoryCount();
    } else {
      // Bloquear aplicación por completo detrás del Auth Gate
      if (authGateOverlay) authGateOverlay.classList.remove('hidden');
      if (appWrapper) appWrapper.classList.add('app-locked');

      if (btnFirebaseLogin) btnFirebaseLogin.style.display = 'inline-flex';
      if (firebaseUserProfile) firebaseUserProfile.style.display = 'none';
    }
  });

  const authGateError = document.getElementById('auth-gate-error');
  const authGateErrorText = document.getElementById('auth-gate-error-text');

  // Handler de Login desde el Auth Gate Modal
  async function handleGoogleLogin(buttonElement) {
    if (buttonElement) {
      if (authGateError) authGateError.style.display = 'none';
      buttonElement.disabled = true;
      const originalHtml = buttonElement.innerHTML;
      buttonElement.innerHTML = `<span>⏳ Verificando con Google...</span>`;

      try {
        const res = await loginWithGoogle();
        if (res.success) {
          if (authGateError) authGateError.style.display = 'none';
          showToast(`👋 ¡Acceso autorizado! Bienvenido ${res.user.displayName || 'Usuario'}`);
        } else {
          if (authGateError && authGateErrorText) {
            authGateErrorText.textContent = res.error || 'No se pudo verificar la cuenta de Google.';
            authGateError.style.display = 'block';
          } else {
            alert('Acceso Denegado: ' + res.error);
          }
        }
      } catch (err) {
        if (authGateError && authGateErrorText) {
          authGateErrorText.textContent = err.message || 'Error de conexión con Google.';
          authGateError.style.display = 'block';
        } else {
          alert('Error: ' + err.message);
        }
      } finally {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalHtml;
      }
    }
  }

  if (btnGoogleGateLogin) {
    btnGoogleGateLogin.addEventListener('click', () => handleGoogleLogin(btnGoogleGateLogin));
  }

  if (btnFirebaseLogin) {
    btnFirebaseLogin.addEventListener('click', () => handleGoogleLogin(btnFirebaseLogin));
  }

  if (btnFirebaseLogout) {
    btnFirebaseLogout.addEventListener('click', async () => {
      await logoutUser();
      showToast('🔒 Sesión cerrada. Aplicación bloqueada.');
    });
  }

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
        lastAuditData = {
          businessName,
          landingUrl,
          provider: data.engine || provider,
          score: data.audit?.overallScore || 0
        };

        resultContainer.style.display = 'block';
        reportIframe.srcdoc = data.html;
        resultMeta.textContent = `Negocio: ${businessName} • Motor: ${data.engine} • Modo: Local & Nube`;
        
        btnDownload.href = data.reportUrl || '#';
        btnDownload.download = data.filename || `auditoria-${businessName}.html`;

        if (btnSaveCloud) {
          btnSaveCloud.disabled = false;
          btnSaveCloud.innerHTML = '<span>☁️</span> Guardar en Firebase';
        }

        resultContainer.scrollIntoView({ behavior: 'smooth' });
        loadHistory();
        loadCloudHistoryCount();
        trackCustomEvent('generate_audit', { businessName, provider });
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

  // 6.1 Guardar Auditoría en Firebase Firestore & Storage
  if (btnSaveCloud) {
    btnSaveCloud.addEventListener('click', async () => {
      if (!currentReportHtml && !currentReportUrl) {
        alert('Primero genera una auditoría para guardarla en Firebase.');
        return;
      }

      btnSaveCloud.disabled = true;
      btnSaveCloud.innerHTML = '<span>⏳</span> Subiendo a la Nube...';

      const res = await saveAuditToCloud({
        businessName: lastAuditData.businessName || 'Auditoría Meta Ads',
        landingUrl: lastAuditData.landingUrl || '',
        provider: lastAuditData.provider || 'offline',
        html: currentReportHtml,
        reportUrl: currentReportUrl,
        score: lastAuditData.score || 0
      });

      if (res.success) {
        btnSaveCloud.innerHTML = '<span>✅</span> ¡Guardado en Firestore!';
        showToast('☁️ Auditoría sincronizada en la nube de Firebase.');
        loadCloudHistoryCount();
        if (currentHistoryTab === 'cloud') {
          loadCloudHistory();
        }
      } else {
        btnSaveCloud.disabled = false;
        btnSaveCloud.innerHTML = '<span>☁️</span> Guardar en Firebase';
        alert('Error al guardar en Firebase: ' + (res.error || 'Desconocido'));
      }
    });
  }

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

  // 10. Control de Historial Local y Cloud Firestore
  if (btnFilterLocal) {
    btnFilterLocal.addEventListener('click', () => {
      currentHistoryTab = 'local';
      btnFilterLocal.classList.add('active');
      btnFilterCloud.classList.remove('active');
      loadHistory();
    });
  }

  if (btnFilterCloud) {
    btnFilterCloud.addEventListener('click', () => {
      currentHistoryTab = 'cloud';
      btnFilterCloud.classList.add('active');
      btnFilterLocal.classList.remove('active');
      loadCloudHistory();
    });
  }

  async function loadHistory() {
    try {
      const res = await fetch('/api/reports');
      const data = await res.json();

      if (data.reports) {
        historyCount.textContent = data.reports.length;

        if (currentHistoryTab !== 'local') return;

        if (data.reports.length === 0) {
          historyList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">
              <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">📂 Aún no has generado ninguna auditoría local.</p>
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

  async function loadCloudHistoryCount() {
    try {
      const res = await getCloudAudits();
      if (res.success && cloudHistoryCount) {
        cloudHistoryCount.textContent = res.audits.length;
      }
    } catch (e) {}
  }

  async function loadCloudHistory() {
    historyList.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">
        <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">☁️ Conectando con Firestore...</p>
      </div>
    `;

    const res = await getCloudAudits();
    if (res.success) {
      if (cloudHistoryCount) cloudHistoryCount.textContent = res.audits.length;

      if (res.audits.length === 0) {
        historyList.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 3rem;">
            <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">☁️ Aún no hay auditorías sincronizadas en Firestore.</p>
            <p style="font-size: 0.85rem;">Haz clic en "Guardar en Firebase" tras generar un informe.</p>
          </div>
        `;
        return;
      }

      historyList.innerHTML = res.audits.map(rep => `
        <div class="history-card">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
              <div class="history-title">${escapeHtml(rep.businessName)}</div>
              <span class="cloud-badge">☁️ Firestore</span>
            </div>
            <div class="history-meta">
              📅 ${rep.createdAtFormatted} • 👤 ${escapeHtml(rep.userName || 'Anónimo')}
            </div>
            ${rep.landingUrl ? `<div style="font-size: 0.78rem; color: var(--cyan); margin-top: 0.3rem;">🔗 ${escapeHtml(rep.landingUrl)}</div>` : ''}
          </div>
          <div class="history-actions" style="margin-top: 1rem;">
            ${rep.reportUrl ? `<a href="${rep.reportUrl}" target="_blank" class="action-btn"><span>👁️</span> Abrir Nube</a>` : ''}
            <button class="action-btn btn-delete-cloud" data-id="${rep.id}" style="background: rgba(244,63,94,0.1); border-color: rgba(244,63,94,0.3); color: #fb7185;"><span>🗑️</span> Borrar</button>
          </div>
        </div>
      `).join('');

      document.querySelectorAll('.btn-delete-cloud').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.currentTarget.getAttribute('data-id');
          if (confirm('¿Deseas eliminar este registro de Firestore?')) {
            await deleteCloudAudit(id);
            showToast('Reporte eliminado de Firestore');
            loadCloudHistory();
            loadCloudHistoryCount();
          }
        });
      });
    } else {
      historyList.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--rose); padding: 3rem;">
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">⚠️ No se pudo cargar Firestore</p>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(res.error || 'Verifica las reglas de seguridad de Firebase.')}</p>
        </div>
      `;
    }
  }

  if (btnRefreshHistory) {
    btnRefreshHistory.addEventListener('click', () => {
      if (currentHistoryTab === 'local') {
        loadHistory();
      } else {
        loadCloudHistory();
      }
      loadCloudHistoryCount();
    });
  }

  loadHistory();
  loadCloudHistoryCount();
});

function showToast(message) {
  const existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.innerHTML = `<span>⚡</span> <span>${escapeHtml(message)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

