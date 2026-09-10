# 🚀 Kit de Auditoría Meta Ads & Landing Pages (Versión Portable & Web)

Esta aplicación te permite auditar campañas de Meta Ads y Landing Pages tanto de forma **local en tu computadora (incluso sin internet)** como **desplegada en la nube** para acceder desde cualquier dispositivo móvil o PC.

---

## 💻 1. Cómo usar en tu PC (Modo Local / Sin Conexión)

No necesitas instalar programas adicionales ni abrir ningún editor de código:

### En Linux / macOS:
1. Haz doble clic en el archivo `iniciar.sh` (o ejecuta `./iniciar.sh` en tu terminal).
2. Se abrirá automáticamente tu navegador en `http://localhost:3005`.

### En Windows:
1. Haz doble clic en el archivo `iniciar.bat`.
2. Se abrirá automáticamente tu navegador en `http://localhost:3005`.

> 🛡️ **Modo 100% Offline:** Si no tienes conexión a internet, el motor heurístico local genera el diagnóstico, los 5 anuncios de alta conversión y el checklist de impacto de forma instantánea sin requerir ninguna API externa.

---

## ☁️ 2. Cómo desplegar en la Nube (Vercel / Render / Railway)

Para tener tu propia herramienta online accesible desde cualquier lugar (ej: `https://mi-auditor-ads.vercel.app`):

### Despliegue en Vercel (Recomendado - 1 Clic y Gratis):
1. Sube esta carpeta a tu cuenta de **GitHub** (en un repositorio público o privado).
2. Entra en [vercel.com](https://vercel.com) e inicia sesión con tu GitHub.
3. Haz clic en **"Add New Project"** y selecciona el repositorio de este proyecto.
4. *(Opcional)* En **Environment Variables**, puedes agregar `GEMINI_API_KEY` si deseas habilitar el análisis con IA en la nube.
5. Haz clic en **Deploy**. ¡Listo! Tendrás tu enlace web público.

---

## 📁 3. Estructura del Proyecto

```text
kit-auditoria-meta-ads/
├── iniciar.sh              # Lanzador de 1 clic para Linux / Mac
├── iniciar.bat             # Lanzador de 1 clic para Windows
├── server.js               # Servidor web nativo (cero dependencias externas requeridas)
├── package.json            # Configuración de scripts y metadatos
├── vercel.json             # Configuración para despliegue en Vercel
├── reportes/               # Carpeta donde se guardan tus informes HTML generados
├── public/                 # Interfaz gráfica visual (GUI)
│   ├── index.html          # Formulario y visualizador
│   ├── style.css           # Estilos oscuros modernos y responsivos
│   └── app.js              # Lógica de cliente y detector online/offline
└── src/
    ├── audit-engine.js     # Motor de análisis y conectores de IA
    └── offline-rules.js    # Motor de reglas heurísticas locales (sin internet)
```

---

## ✨ Características Principales

* **⚔️ Comparador de Competidores (Benchmark 1 vs 1):** Duelo de URLs en paralelo con matriz comparativa de ventajas y desventajas.
* **📱 Vista Previa de WhatsApp & Redes Sociales (Open Graph):** Mockup interactivo que simula cómo se visualiza el enlace al ser compartido en chats y redes.
* **📄 Exportador a PDF / Imprimir:** Descarga y exportación limpia para enviar propuestas comerciales y diagnósticos a clientes.
* **🔐 Ciberseguridad & Certificado SSL:** Emisor, fecha de vencimiento, días restantes y cabeceras HSTS, X-Frame-Options y MIME.
* **⚖️ Cumplimiento Legal & Cookies:** Detección de Política de Privacidad y banners de cookies requeridos para pautar en Meta Ads.
* **⚡ Compresión Servidor & Optimización Móvil:** Detección de Gzip/Brotli, etiquetas Viewport responsive y peso HTML en KB.
* **🛡️ Detección WAF & Anti-DDoS:** Inspección de Cloudflare, AWS WAF, Sucuri y Fastly.
* **📜 Verificación Legal Meta DNS:** Comprobación del registro `facebook-domain-verification` en DNS TXT.
* **🕵️‍♂️ Integración con Agente Inspector:** Ejecución directa del motor Python para auditar código fuente y detectar vulnerabilidades o secretos expuestos.
* **📊 Puntuación y Semáforo Global (0-100)** para identificar fugas de conversión y ROAS.
* **🎬 Guiones de Video & Pack de 5 Anuncios** listos para publicar en Facebook e Instagram Ads.
* **📁 Historial de Auditorías** con visor en tiempo real y descarga de reportes en HTML autocontenido.
