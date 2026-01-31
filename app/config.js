// Configuração da API de Licenciamento
const API_CONFIG = {
  // IMPORTANTE: Altere esta URL para o endereço do seu servidor em produção
  BASE_URL: 'http://localhost:3000/api',
  
  // Endpoints
  ENDPOINTS: {
    ACTIVATE: '/license/activate',
    VALIDATE: '/license/validate',
    STATUS: '/license/status'
  }
};

// Função para gerar Device ID único
function generateDeviceId() {
  const stored = localStorage.getItem('axis_device_id');
  if (stored) return stored;
  
  // Gerar ID baseado em características do dispositivo
  const nav = navigator;
  const screen = window.screen;
  
  const deviceData = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage
  ].join('|');
  
  // Gerar hash simples
  let hash = 0;
  for (let i = 0; i < deviceData.length; i++) {
    const char = deviceData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  const deviceId = 'DEVICE-' + Math.abs(hash).toString(36).toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
  localStorage.setItem('axis_device_id', deviceId);
  
  return deviceId;
}

// Função para obter informações do dispositivo
function getDeviceInfo() {
  const nav = navigator;
  const screen = window.screen;
  
  return JSON.stringify({
    userAgent: nav.userAgent,
    platform: nav.platform,
    language: nav.language,
    screenResolution: `${screen.width}x${screen.height}`,
    colorDepth: screen.colorDepth,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  });
}
