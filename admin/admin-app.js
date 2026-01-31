// Aplicação do Painel Administrativo

// Elementos
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const adminPassword = document.getElementById('adminPassword');
const loginButton = document.getElementById('loginButton');
const loginMessage = document.getElementById('loginMessage');
const logoutButton = document.getElementById('logoutButton');
const createLicenseButton = document.getElementById('createLicenseButton');
const refreshButton = document.getElementById('refreshButton');
const createLicenseModal = document.getElementById('createLicenseModal');
const historyModal = document.getElementById('historyModal');
const licensesTableBody = document.getElementById('licensesTableBody');

// Estatísticas
const statTotal = document.getElementById('statTotal');
const statActive = document.getElementById('statActive');
const statInactive = document.getElementById('statInactive');
const statRevoked = document.getElementById('statRevoked');

// Funções auxiliares
function showScreen(screenId) {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.add('hidden');
  document.getElementById(screenId).classList.remove('hidden');
}

function showMessage(element, message, type) {
  element.textContent = message;
  element.className = `message ${type} show`;
  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Login
async function handleLogin() {
  const password = adminPassword.value;
  
  if (!password) {
    showMessage(loginMessage, 'Digite a senha', 'error');
    return;
  }
  
  loginButton.disabled = true;
  loginButton.textContent = 'Entrando...';
  
  try {
    // Timeout de 30 segundos para lidar com o "wake up" do Render
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const data = await apiRequest(ADMIN_API_CONFIG.ENDPOINTS.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ password }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (data && data.success) {
      adminToken = data.token;
      localStorage.setItem('axis_admin_token', data.token);
      showScreen('dashboardScreen');
      loadDashboard();
    } else {
      showMessage(loginMessage, data?.message || 'Senha incorreta', 'error');
      loginButton.disabled = false;
      loginButton.textContent = 'Entrar';
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      showMessage(loginMessage, 'O servidor está demorando a responder (acordando). Tente novamente em instantes.', 'error');
    } else {
      showMessage(loginMessage, 'Erro de conexão. Verifique se o servidor está rodando.', 'error');
    }
    loginButton.disabled = false;
    loginButton.textContent = 'Entrar';
  }
}

// Carregar dashboard
async function loadDashboard() {
  await Promise.all([
    loadStats(),
    loadLicenses()
  ]);
}

// Carregar estatísticas
async function loadStats() {
  try {
    const data = await apiRequest(ADMIN_API_CONFIG.ENDPOINTS.STATS);
    
    if (data && data.success) {
      statTotal.textContent = data.stats.total;
      statActive.textContent = data.stats.active;
      statInactive.textContent = data.stats.inactive;
      statRevoked.textContent = data.stats.revoked;
    }
  } catch (error) {
    console.error('Erro ao carregar estatísticas:', error);
  }
}

// Carregar licenças
async function loadLicenses() {
  licensesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Carregando licenças...</td></tr>';
  
  try {
    const data = await apiRequest(ADMIN_API_CONFIG.ENDPOINTS.LICENSES);
    
    if (data && data.success) {
      if (data.licenses.length === 0) {
        licensesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Nenhuma licença cadastrada</td></tr>';
        return;
      }
      
      licensesTableBody.innerHTML = data.licenses.map(license => `
        <tr>
          <td>
            <div class="license-cell">
              <span class="license-key">${license.license_key}</span>
              <button class="btn-copy" onclick="copyToClipboard('${license.license_key}', this)" title="Copiar chave">📋</button>
            </div>
          </td>
          <td>${license.customer_name}</td>
          <td><span class="status-badge ${license.status}">${getStatusText(license.status)}</span></td>
          <td><span class="device-id" title="${license.device_id || '-'}">${license.device_id || '-'}</span></td>
          <td>${formatDate(license.activated_at)}</td>
          <td>${formatDate(license.last_validation)}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-info" onclick="viewHistory('${license.license_key}')">📊 Histórico</button>
              ${license.status !== 'revoked' ? `
                <button class="btn btn-danger" onclick="revokeLicense('${license.license_key}')">🚫 Revogar</button>
              ` : ''}
              <button class="btn btn-danger" onclick="deleteLicense('${license.license_key}')">🗑️ Deletar</button>
            </div>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Erro ao carregar licenças:', error);
    licensesTableBody.innerHTML = '<tr><td colspan="7" class="loading">Erro ao carregar licenças</td></tr>';
  }
}

function getStatusText(status) {
  const statusMap = {
    'active': 'Ativa',
    'inactive': 'Inativa',
    'revoked': 'Revogada'
  };
  return statusMap[status] || status;
}

// Criar licença
function openCreateModal() {
  createLicenseModal.classList.remove('hidden');
}

function closeCreateModal() {
  createLicenseModal.classList.add('hidden');
  document.getElementById('customerName').value = '';
  document.getElementById('customerNotes').value = '';
}

async function createLicense() {
  const customerName = document.getElementById('customerName').value.trim();
  const notes = document.getElementById('customerNotes').value.trim();
  
  if (!customerName) {
    alert('Digite o nome do cliente');
    return;
  }
  
  const confirmCreateButton = document.getElementById('confirmCreateButton');
  confirmCreateButton.disabled = true;
  confirmCreateButton.textContent = 'Criando...';
  
  try {
    const data = await apiRequest(ADMIN_API_CONFIG.ENDPOINTS.LICENSES, {
      method: 'POST',
      body: JSON.stringify({ customer_name: customerName, notes })
    });
    
    if (data && data.success) {
      alert(`✅ Licença criada com sucesso!\n\nChave: ${data.license.license_key}\n\nEnvie esta chave para o cliente.`);
      closeCreateModal();
      loadDashboard();
    } else {
      alert('❌ Erro ao criar licença: ' + (data?.message || 'Erro desconhecido'));
    }
  } catch (error) {
    alert('❌ Erro de conexão ao criar licença');
  } finally {
    confirmCreateButton.disabled = false;
    confirmCreateButton.textContent = 'Criar Licença';
  }
}

// Revogar licença
async function revokeLicense(licenseKey) {
  if (!confirm(`Tem certeza que deseja REVOGAR a licença ${licenseKey}?\n\nO cliente não poderá mais usar o aplicativo.`)) {
    return;
  }
  
  try {
    const endpoint = ADMIN_API_CONFIG.ENDPOINTS.REVOKE.replace(':key', licenseKey);
    const data = await apiRequest(endpoint, { method: 'POST' });
    
    if (data && data.success) {
      alert('✅ Licença revogada com sucesso!');
      loadDashboard();
    } else {
      alert('❌ Erro ao revogar licença: ' + (data?.message || 'Erro desconhecido'));
    }
  } catch (error) {
    alert('❌ Erro de conexão ao revogar licença');
  }
}

// Deletar licença
async function deleteLicense(licenseKey) {
  if (!confirm(`⚠️ ATENÇÃO!\n\nTem certeza que deseja DELETAR permanentemente a licença ${licenseKey}?\n\nEsta ação não pode ser desfeita!`)) {
    return;
  }
  
  try {
    const endpoint = ADMIN_API_CONFIG.ENDPOINTS.DELETE.replace(':key', licenseKey);
    const data = await apiRequest(endpoint, { method: 'DELETE' });
    
    if (data && data.success) {
      alert('✅ Licença deletada com sucesso!');
      loadDashboard();
    } else {
      alert('❌ Erro ao deletar licença: ' + (data?.message || 'Erro desconhecido'));
    }
  } catch (error) {
    alert('❌ Erro de conexão ao deletar licença');
  }
}

// Ver histórico
async function viewHistory(licenseKey) {
  historyModal.classList.remove('hidden');
  const historyContent = document.getElementById('historyContent');
  historyContent.innerHTML = '<p class="loading">Carregando histórico...</p>';
  
  try {
    const endpoint = ADMIN_API_CONFIG.ENDPOINTS.HISTORY.replace(':key', licenseKey);
    const data = await apiRequest(endpoint);
    
    if (data && data.success) {
      if (data.history.length === 0) {
        historyContent.innerHTML = '<p class="loading">Nenhum histórico encontrado</p>';
        return;
      }
      
      historyContent.innerHTML = data.history.map(item => `
        <div class="history-item ${item.action.toLowerCase()}">
          <div class="action">${getActionIcon(item.action)} ${getActionText(item.action)}</div>
          <div class="device">Device: ${item.device_id}</div>
          <div class="timestamp">${formatDate(item.timestamp)}</div>
        </div>
      `).join('');
    } else {
      historyContent.innerHTML = '<p class="loading">Erro ao carregar histórico</p>';
    }
  } catch (error) {
    historyContent.innerHTML = '<p class="loading">Erro de conexão</p>';
  }
}

function getActionIcon(action) {
  const icons = {
    'ACTIVATED': '✅',
    'DEACTIVATED': '⏸️',
    'REVOKED': '🚫'
  };
  return icons[action] || '📝';
}

function getActionText(action) {
  const texts = {
    'ACTIVATED': 'Ativada',
    'DEACTIVATED': 'Desativada',
    'REVOKED': 'Revogada'
  };
  return texts[action] || action;
}

function closeHistoryModal() {
  historyModal.classList.add('hidden');
}

// Função para copiar para a área de transferência
async function copyToClipboard(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = btn.textContent;
    btn.textContent = '✅';
    btn.classList.add('success');
    
    setTimeout(() => {
      btn.textContent = originalText;
      btn.classList.remove('success');
    }, 2000);
  } catch (err) {
    console.error('Erro ao copiar:', err);
    // Fallback para navegadores antigos ou sem permissão
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    alert('Copiado para a área de transferência!');
  }
}

// Event Listeners
loginButton.addEventListener('click', handleLogin);
adminPassword.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleLogin();
});

logoutButton.addEventListener('click', logout);
createLicenseButton.addEventListener('click', openCreateModal);
refreshButton.addEventListener('click', loadDashboard);
document.getElementById('confirmCreateButton').addEventListener('click', createLicense);

// Verificar se já está logado
if (adminToken) {
  showScreen('dashboardScreen');
  loadDashboard();
}
