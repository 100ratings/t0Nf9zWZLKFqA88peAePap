// Gerenciador de Licenças
class LicenseManager {
  constructor() {
    this.token = localStorage.getItem('axis_license_token');
    this.deviceId = generateDeviceId();
    this.isActivated = false;
    this.customerName = localStorage.getItem('axis_customer_name') || '';
  }

  // Verificar se já está ativado
  async checkActivation() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: this.token,
          device_id: this.deviceId
        })
      });

      const data = await response.json();

      if (data.success) {
        this.isActivated = true;
        this.customerName = data.customer_name;
        localStorage.setItem('axis_customer_name', data.customer_name);
        return true;
      } else {
        // Token inválido, limpar dados
        this.clearActivation();
        return false;
      }
    } catch (error) {
      console.error('Erro ao validar licença:', error);
      return false;
    }
  }

  // Ativar licença
  async activate(licenseKey, force = false) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.ACTIVATE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          license_key: licenseKey.trim().toUpperCase(),
          device_id: this.deviceId,
          device_info: getDeviceInfo(),
          force: force
        })
      });

      const data = await response.json();

      if (data.success) {
        this.token = data.token;
        this.customerName = data.customer_name;
        this.isActivated = true;
        
        localStorage.setItem('axis_license_token', data.token);
        localStorage.setItem('axis_customer_name', data.customer_name);
        localStorage.setItem('axis_license_key', licenseKey.trim().toUpperCase());
        
        return { success: true, message: data.message };
      } else {
        return { 
          success: false, 
          message: data.message, 
          needsConfirmation: data.needsConfirmation 
        };
      }
    } catch (error) {
      console.error('Erro ao ativar licença:', error);
      return { 
        success: false, 
        message: 'Erro de conexão. Verifique sua internet e tente novamente.' 
      };
    }
  }

  // Limpar ativação
  clearActivation() {
    this.token = null;
    this.isActivated = false;
    this.customerName = '';
    localStorage.removeItem('axis_license_token');
    localStorage.removeItem('axis_customer_name');
    localStorage.removeItem('axis_license_key');
  }

  // Obter nome do cliente
  getCustomerName() {
    return this.customerName;
  }
}

// Instância global
const licenseManager = new LicenseManager();
