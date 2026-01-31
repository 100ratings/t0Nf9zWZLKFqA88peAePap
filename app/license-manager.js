// Gerenciador de Licenças
class LicenseManager {
  constructor() {
    this.token = localStorage.getItem('axis_license_token');
    this.deviceId = generateDeviceId();
    this.isActivated = false;
    this.customerName = localStorage.getItem('axis_customer_name') || '';
  }

  // Verificar se já está ativado (com suporte a modo offline)
  async checkActivation() {
    if (!this.token) {
      return false;
    }

    try {
      // Timeout curto para não travar o app se a internet estiver ruim
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.VALIDATE}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: this.token,
          device_id: this.deviceId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const data = await response.json();

      if (data.success) {
        this.isActivated = true;
        this.customerName = data.customer_name;
        localStorage.setItem('axis_customer_name', data.customer_name);
        localStorage.setItem('axis_last_valid', Date.now()); // Salva timestamp da última validação online
        return true;
      } else {
        // Se o servidor respondeu explicitamente que é inválido (ex: licença deletada ou outro aparelho ativou)
        this.clearActivation();
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Erro de conexão ou modo offline detectado. Confiando no cache local.');
      
      // Se deu erro de conexão (modo avião), verificamos se temos um token salvo
      if (this.token) {
        this.isActivated = true;
        return true; // Permite o uso offline
      }
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
