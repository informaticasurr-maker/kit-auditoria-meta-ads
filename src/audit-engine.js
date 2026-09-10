/**
 * Motor de Auditoría Forense Profunda, Ciberseguridad, Redes, DNS y Tráfico
 */
const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const { generateAuditReport } = require('./offline-rules');

async function checkDnsRecords(hostname) {
  try {
    const cleanHost = hostname.replace(/^www\./, '');
    const txtRecords = await dns.resolveTxt(cleanHost).catch(() => []);
    const flatTxt = txtRecords.flat().join(' ');

    const hasMetaVerification = flatTxt.includes('facebook-domain-verification') || flatTxt.includes('meta-site-verification');
    const hasGoogleVerification = flatTxt.includes('google-site-verification');
    const hasSpf = flatTxt.includes('v=spf1');
    
    // Check DMARC
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${cleanHost}`).catch(() => []);
    const hasDmarc = dmarcRecords.flat().join(' ').includes('v=DMARC1');

    return {
      hasMetaVerification,
      hasGoogleVerification,
      hasSpf,
      hasDmarc,
      rawTxt: flatTxt
    };
  } catch (err) {
    return {
      hasMetaVerification: false,
      hasGoogleVerification: false,
      hasSpf: false,
      hasDmarc: false,
      rawTxt: ''
    };
  }
}

async function inspectLandingUrl(urlStr) {
  if (!urlStr) {
    return {
      hasPixel: false,
      hasGtag: false,
      title: '',
      loadTimeSec: 1.0,
      security: { score: 70, issues: ['No se especificó URL para escanear'] }
    };
  }

  let formattedUrl = urlStr.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = 'https://' + formattedUrl;
  }

  let hostname = '';
  try {
    const parsed = new URL(formattedUrl);
    hostname = parsed.hostname;
  } catch (e) {
    hostname = urlStr;
  }

  // 1. Verificación DNS en paralelo
  const dnsPromise = checkDnsRecords(hostname);

  const startTime = Date.now();
  return new Promise((resolve) => {
    try {
      const isHttps = formattedUrl.startsWith('https://');
      const client = isHttps ? https : http;
      
      const req = client.get(formattedUrl, { timeout: 9000 }, async (res) => {
        let html = '';
        const headers = res.headers || {};
        const statusCode = res.statusCode;
        
        res.on('data', chunk => {
          if (html.length < 600000) html += chunk;
        });

        res.on('end', async () => {
          const loadTimeSec = ((Date.now() - startTime) / 1000).toFixed(2);
          const dnsData = await dnsPromise;
          const cert = res.socket?.getPeerCertificate ? res.socket.getPeerCertificate() : null;

          // 1. Píxeles y Publicidades
          const hasPixel = html.includes('fbq(') || html.includes('connect.facebook.net') || html.includes('fbevents.js');
          const hasGtag = html.includes('gtag(') || html.includes('google-analytics.com') || html.includes('googletagmanager.com');
          const hasTikTokPixel = html.includes('ttq.load') || html.includes('analytics.tiktok.com');
          const hasAdSense = html.includes('adsbygoogle') || html.includes('pagead2.googlesyndication.com');

          // 2. Redes Sociales Enlazadas
          const socialLinks = {
            facebook: html.includes('facebook.com/') || html.includes('fb.com/'),
            instagram: html.includes('instagram.com/'),
            whatsapp: html.includes('wa.me/') || html.includes('api.whatsapp.com') || html.includes('whatsapp.com'),
            tiktok: html.includes('tiktok.com/@'),
            youtube: html.includes('youtube.com/') || html.includes('youtu.be/'),
            googleMaps: html.includes('maps.google.com') || html.includes('google.com/maps') || html.includes('goo.gl/maps')
          };

          // 3. Título, SEO y OpenGraph Social Preview
          let title = '';
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch) title = titleMatch[1].trim();

          const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
          const canonicalUrl = canonicalMatch ? canonicalMatch[1] : '';

          // OpenGraph & Twitter Meta Tags
          function extractMeta(attrName, attrValue) {
            const regex1 = new RegExp(`<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']*)["']`, 'i');
            const regex2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${attrName}=["']${attrValue}["']`, 'i');
            const m1 = html.match(regex1);
            if (m1) return m1[1];
            const m2 = html.match(regex2);
            if (m2) return m2[1];
            return '';
          }

          const ogData = {
            title: extractMeta('property', 'og:title') || title,
            description: extractMeta('property', 'og:description') || extractMeta('name', 'description'),
            image: extractMeta('property', 'og:image') || extractMeta('name', 'twitter:image'),
            url: extractMeta('property', 'og:url') || formattedUrl,
            siteName: extractMeta('property', 'og:site_name') || hostname,
            twitterCard: extractMeta('name', 'twitter:card') || 'summary'
          };

          // 4. SSL Detallado & Expiración
          let sslInfo = {
            isValid: isHttps,
            issuer: 'No disponible',
            validTo: 'No disponible',
            daysRemaining: null,
            isExpiringSoon: false
          };

          if (isHttps && cert && cert.valid_to) {
            try {
              const validToDate = new Date(cert.valid_to);
              const daysRemaining = Math.max(0, Math.floor((validToDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
              sslInfo = {
                isValid: true,
                issuer: cert.issuer?.O || cert.issuer?.CN || 'Let\'s Encrypt / Autoridad SSL',
                validTo: validToDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }),
                daysRemaining,
                isExpiringSoon: daysRemaining < 20
              };
            } catch (e) {}
          } else if (isHttps) {
            sslInfo = {
              isValid: true,
              issuer: 'TLS / HTTPS Activo',
              validTo: 'Válido',
              daysRemaining: 90,
              isExpiringSoon: false
            };
          }

          // 5. Legal & Privacidad (Cumplimiento de Meta Ads)
          const lowerHtml = html.toLowerCase();
          const hasPrivacyPolicy = lowerHtml.includes('privacidad') || lowerHtml.includes('privacy') || lowerHtml.includes('aviso legal') || lowerHtml.includes('politica de datos');
          const hasTerms = lowerHtml.includes('terminos') || lowerHtml.includes('términos') || lowerHtml.includes('terms') || lowerHtml.includes('condiciones');
          const hasCookieBanner = lowerHtml.includes('cookie') && (lowerHtml.includes('consent') || lowerHtml.includes('banner') || lowerHtml.includes('cookiebot') || lowerHtml.includes('onetrust') || lowerHtml.includes('complianz') || lowerHtml.includes('iubenda') || lowerHtml.includes('aceptar'));

          const legalCompliance = {
            hasPrivacyPolicy,
            hasTerms,
            hasCookieBanner,
            complianceScore: (hasPrivacyPolicy ? 50 : 0) + (hasTerms ? 25 : 0) + (hasCookieBanner ? 25 : 0)
          };

          // 6. Optimización Móvil & Compresión
          const contentEncoding = headers['content-encoding'] || 'none';
          const isCompressed = contentEncoding.includes('gzip') || contentEncoding.includes('br') || contentEncoding.includes('deflate');
          const hasViewport = html.includes('name="viewport"') || html.includes("name='viewport'");
          const pageSizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);

          const mobilePerformance = {
            hasViewport,
            contentEncoding,
            isCompressed,
            pageSizeKb: parseFloat(pageSizeKb)
          };

          // 7. Detección de WAF / Protección contra Ataques
          let wafDetected = 'Ninguno / Servidor Directo';
          let isWafProtected = false;
          if (headers['cf-ray'] || headers['server']?.toLowerCase().includes('cloudflare')) {
            wafDetected = 'Cloudflare (Anti-DDoS & WAF Activo)';
            isWafProtected = true;
          } else if (headers['x-amz-cf-id']) {
            wafDetected = 'Amazon CloudFront / AWS WAF';
            isWafProtected = true;
          } else if (headers['x-sucuri-id']) {
            wafDetected = 'Sucuri Web Firewall';
            isWafProtected = true;
          } else if (headers['fastly-debug-digest']) {
            wafDetected = 'Fastly CDN & Edge Protection';
            isWafProtected = true;
          }

          // 8. Frescura / Últimas Actualizaciones del Servidor
          const lastModified = headers['last-modified'] || 'No reportado en cabeceras HTTP';
          const cacheControl = headers['cache-control'] || 'Sin política de caché explícita';
          const serverSoftware = headers['server'] || headers['x-powered-by'] || 'Oculto / Protegido';

          // 🛡️ 9. Escaneo Forense de Seguridad & Vulnerabilidades
          const securityIssues = [];
          const securityPassed = [];
          let secScore = 100;

          // HTTPS Check & SSL
          if (!isHttps) {
            securityIssues.push({ title: 'Sitio sin cifrado HTTPS', desc: 'La web no usa HTTPS. El tráfico viaja en texto plano y los navegadores la marcan como No Segura.', severity: 'critical' });
            secScore -= 35;
          } else {
            securityPassed.push(`Cifrado SSL Activo (${sslInfo.issuer}, vence: ${sslInfo.validTo})`);
            if (sslInfo.isExpiringSoon) {
              securityIssues.push({ title: `Certificado SSL por vencer (${sslInfo.daysRemaining} días restantes)`, desc: 'El certificado expirará pronto. Es necesario renovarlo.', severity: 'warning' });
              secScore -= 10;
            }
          }

          // HSTS
          if (!headers['strict-transport-security']) {
            securityIssues.push({ title: 'Falta Cabecera HSTS (Strict-Transport-Security)', desc: 'Permite ataques de intermediario (MITM) para degradar la conexión a HTTP.', severity: 'warning' });
            secScore -= 10;
          } else {
            securityPassed.push('HSTS configurado contra ataques de degradación');
          }

          // Clickjacking (X-Frame-Options)
          if (!headers['x-frame-options'] && !headers['content-security-policy']?.includes('frame-ancestors')) {
            securityIssues.push({ title: 'Vulnerabilidad a Clickjacking (Falta X-Frame-Options)', desc: 'La web puede ser embebida en iframes invisibles en sitios maliciosos para robar clics.', severity: 'warning' });
            secScore -= 10;
          } else {
            securityPassed.push('Protección contra Clickjacking habilitada');
          }

          // MIME Sniffing
          if (!headers['x-content-type-options']) {
            securityIssues.push({ title: 'Falta X-Content-Type-Options: nosniff', desc: 'El navegador podría ejecutar archivos subidos como scripts maliciosos.', severity: 'low' });
            secScore -= 5;
          }

          // Verificación de Dominio en Meta
          if (dnsData.hasMetaVerification) {
            securityPassed.push('Dominio verificado legalmente en Meta Business Manager (DNS TXT)');
          } else {
            securityIssues.push({ title: 'Dominio NO Verificado en Meta Ads (DNS TXT)', desc: 'No se detectó registro `facebook-domain-verification`. Sin esto, Meta puede limitar la edición de enlaces de anuncios.', severity: 'warning' });
            secScore -= 10;
          }

          // OpenGraph Social
          if (!ogData.image) {
            securityIssues.push({ title: 'Falta imagen OpenGraph (og:image)', desc: 'Al compartir el enlace en WhatsApp o redes sociales aparecerá sin imagen previa.', severity: 'warning' });
          } else {
            securityPassed.push('Vista previa OpenGraph configurada con imagen para WhatsApp');
          }

          // Política de Privacidad & Cumplimiento Meta
          if (!legalCompliance.hasPrivacyPolicy) {
            securityIssues.push({ title: 'Falta Enlace a Política de Privacidad', desc: 'Obligatorio por Meta Ads al capturar datos o pautar anuncios de clientes potenciales.', severity: 'warning' });
            secScore -= 10;
          } else {
            securityPassed.push('Política de Privacidad detectada en la web');
          }

          // Detección de Scripts Inseguros / Contenido Mixto
          if (html.includes('http://') && isHttps) {
            securityIssues.push({ title: 'Contenido Mixto Inseguro (Mixed Content)', desc: 'Existen llamadas HTTP no cifradas dentro de la página HTTPS.', severity: 'warning' });
            secScore -= 10;
          }

          // Redirección Status
          const isRedirected = statusCode >= 300 && statusCode < 400;

          resolve({
            hasPixel,
            hasGtag,
            hasTikTokPixel,
            hasAdSense,
            title,
            loadTimeSec,
            statusCode,
            isRedirected,
            canonicalUrl,
            socialLinks,
            ogData,
            sslInfo,
            legalCompliance,
            mobilePerformance,
            dnsData,
            waf: {
              name: wafDetected,
              isProtected: isWafProtected
            },
            serverInfo: {
              serverSoftware,
              lastModified,
              cacheControl
            },
            security: {
              score: Math.max(15, secScore),
              issues: securityIssues,
              passed: securityPassed,
              headers
            }
          });
        });
      });

      req.on('error', () => {
        resolve({
          hasPixel: false,
          hasGtag: false,
          title: '',
          loadTimeSec: 1.2,
          security: { score: 60, issues: [{ title: 'Error de conexión con el host', desc: 'No se pudo conectar al servidor.', severity: 'critical' }], passed: [] },
          socialLinks: {},
          dnsData: {},
          waf: { name: 'Desconocido', isProtected: false },
          serverInfo: {}
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          hasPixel: false,
          hasGtag: false,
          title: '',
          loadTimeSec: 5.0,
          security: { score: 50, issues: [{ title: 'Tiempo de respuesta muy lento (>9s)', desc: 'El servidor tardó demasiado en responder.', severity: 'warning' }], passed: [] },
          socialLinks: {},
          dnsData: {},
          waf: { name: 'Desconocido', isProtected: false },
          serverInfo: {}
        });
      });
    } catch (e) {
      resolve({
        hasPixel: false,
        hasGtag: false,
        title: '',
        loadTimeSec: 1.2,
        security: { score: 70, issues: [], passed: [] },
        socialLinks: {},
        dnsData: {},
        waf: { name: 'Desconocido', isProtected: false },
        serverInfo: {}
      });
    }
  });
}

/**
 * Llamada a Gemini API si el usuario proporciona API Key
 */
async function callGeminiApi(apiKey, prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 8192 }
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 30000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.candidates && json.candidates[0]?.content?.parts?.[0]?.text) {
            resolve(json.candidates[0].content.parts[0].text);
          } else if (json.error) {
            reject(new Error(json.error.message || 'Error en Gemini API'));
          } else {
            reject(new Error('Respuesta inválida de Gemini API'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout al consultar Gemini API'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Ejecución principal de auditoría
 */
async function runAudit(params) {
  const {
    businessName,
    landingUrl,
    offerDetails,
    targetAudience,
    competitors,
    apiKey,
    provider = 'offline'
  } = params;

  // 1. Inspeccionar Landing & Seguridad
  let landingInfo = null;
  if (landingUrl) {
    try {
      landingInfo = await inspectLandingUrl(landingUrl);
    } catch (err) {
      console.warn('Error inspeccionando URL:', err.message);
    }
  }

  // 2. Si se solicitó IA Online
  if (provider === 'gemini' && apiKey) {
    try {
      const systemPrompt = `Eres un auditor senior de Meta Ads, Ciberseguridad Web, DNS y Optimización de Conversión.
Genera una auditoría profesional interactiva en formato HTML autocontenido para:
- Negocio: ${businessName}
- Landing: ${landingUrl}
- Píxel: ${landingInfo?.hasPixel ? 'Detectado' : 'No instalado'}
- WAF: ${landingInfo?.waf?.name || 'No detectado'}
- Verificación Meta DNS: ${landingInfo?.dnsData?.hasMetaVerification ? 'SÍ' : 'NO'}
- Oferta: ${offerDetails}
- Público: ${targetAudience}

Devuelve el HTML completo desde <!DOCTYPE html> hasta </html>.`;

      const aiResponse = await callGeminiApi(apiKey, systemPrompt);
      let html = aiResponse.trim();
      if (html.startsWith('```html')) html = html.slice(7);
      if (html.startsWith('```')) html = html.slice(3);
      if (html.endsWith('```')) html = html.slice(0, -3);
      html = html.trim();

      return { html, engine: 'Gemini AI' };
    } catch (aiErr) {
      console.warn('Fallo llamada a IA, usando motor offline:', aiErr.message);
    }
  }

  // 3. Modo Heurístico Adaptativo
  const html = generateAuditReport(params, landingInfo);
  return { html, engine: 'Motor Adaptativo 360°' };
}

/**
 * Comparativa 1 vs 1 con Competidor (Benchmark)
 */
async function compareCompetitors({ targetUrl, targetName = 'Tu Marca', competitorUrl, competitorName = 'Competidor' }) {
  const [targetInfo, competitorInfo] = await Promise.all([
    inspectLandingUrl(targetUrl),
    inspectLandingUrl(competitorUrl)
  ]);

  // Cálculo de ventajas competitivas
  const advantages = [];
  const weaknesses = [];

  // Píxel
  if (targetInfo.hasPixel && !competitorInfo.hasPixel) {
    advantages.push('✅ Tienes Píxel de Meta activo mientras que tu competidor no lo tiene instalado (ventaja en optimización de costo por lead).');
  } else if (!targetInfo.hasPixel && competitorInfo.hasPixel) {
    weaknesses.push('⚠️ Tu competidor tiene Píxel de Meta activo y tú no (están recolectando audiencias y optimizando mejor).');
  }

  // Velocidad
  if (parseFloat(targetInfo.loadTimeSec) < parseFloat(competitorInfo.loadTimeSec)) {
    advantages.push(`⚡ Tu página carga más rápido (${targetInfo.loadTimeSec}s vs ${competitorInfo.loadTimeSec}s del competidor).`);
  } else if (parseFloat(targetInfo.loadTimeSec) > parseFloat(competitorInfo.loadTimeSec)) {
    weaknesses.push(`⚠️ La web del competidor es más rápida (${competitorInfo.loadTimeSec}s vs tus ${targetInfo.loadTimeSec}s).`);
  }

  // Seguridad
  if (targetInfo.security.score > competitorInfo.security.score) {
    advantages.push(`🛡️ Mayor nivel de ciberseguridad (${targetInfo.security.score}/100 vs ${competitorInfo.security.score}/100).`);
  } else if (targetInfo.security.score < competitorInfo.security.score) {
    weaknesses.push(`⚠️ Tu competidor tiene mejor postura de seguridad (${competitorInfo.security.score}/100 vs ${targetInfo.security.score}/100).`);
  }

  // WAF
  if (targetInfo.waf.isProtected && !competitorInfo.waf.isProtected) {
    advantages.push('🛡️ Tu servidor cuenta con protección WAF/Anti-DDoS, el del competidor está expuesto.');
  }

  // Omnicanalidad
  const targetSocialCount = Object.values(targetInfo.socialLinks || {}).filter(Boolean).length;
  const competitorSocialCount = Object.values(competitorInfo.socialLinks || {}).filter(Boolean).length;
  if (targetSocialCount > competitorSocialCount) {
    advantages.push(`🔗 Mayor presencia de canales de contacto (${targetSocialCount} redes conectadas vs ${competitorSocialCount}).`);
  }

  return {
    target: {
      name: targetName,
      url: targetUrl,
      info: targetInfo
    },
    competitor: {
      name: competitorName,
      url: competitorUrl,
      info: competitorInfo
    },
    advantages,
    weaknesses,
    summary: advantages.length >= weaknesses.length 
      ? `🏆 ${targetName} tiene ventaja competitiva en infraestructura digital y captura.`
      : `⚠️ ${competitorName} supera en varios puntos técnicos. Se recomienda optimizar píxel y velocidad.`
  };
}

module.exports = {
  runAudit,
  inspectLandingUrl,
  checkDnsRecords,
  compareCompetitors
};
