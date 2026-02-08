// Configuração da API para o Painel Administrativo
const ADMIN_API_CONFIG = {
  // IMPORTANTE: Altere esta URL para o endereço do seu servidor em produção
  BASE_URL: 'https://t0nf9zwzlkfqa88peaepap.onrender.com/api',
  
  // Endpoints
  ENDPOINTS: {
    LOGIN: '/admin/login',
    LICENSES: '/admin/licenses',
    STATS: '/admin/stats',
    REVOKE: '/admin/licenses/:key/revoke',
    DELETE: '/admin/licenses/:key',
    HISTORY: '/admin/licenses/:key/history'
  }
};

// Armazenamento do token
let adminToken = localStorage.getItem('axis_admin_token') || null;

// Função para fazer requisições autenticadas
async function apiRequest(endpoint, options = {}) {
  const url = `${ADMIN_API_CONFIG.BASE_URL}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (adminToken && !endpoint.includes('/login')) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }
  
  try {
    const fetchOptions = {
      ...options,
      headers
    };
    
    // Repassar o signal se existir para suportar timeout
    if (options.signal) fetchOptions.signal = options.signal;

    const response = await fetch(url, fetchOptions);
    
    const data = await response.json();
    
    if (!response.ok && response.status === 401) {
      // Token inválido, fazer logout
      logout();
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

// Função de logout
function logout() {
  adminToken = null;
  localStorage.removeItem('axis_admin_token');
  showScreen('loginScreen');
}
