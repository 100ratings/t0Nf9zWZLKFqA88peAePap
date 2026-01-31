// Inicialização do Sistema de Ativação
(async function() {
  const activationScreen = document.getElementById('activationScreen');
  const licenseInput = document.getElementById('licenseInput');
  const activateButton = document.getElementById('activateButton');
  const activationMessage = document.getElementById('activationMessage');
  const deviceIdDisplay = document.getElementById('deviceIdDisplay');

  // Exibir Device ID
  deviceIdDisplay.textContent = licenseManager.deviceId;

  // Função para mostrar mensagem
  function showMessage(message, type) {
    activationMessage.textContent = message;
    activationMessage.className = `activation-message ${type} show`;
    
    setTimeout(() => {
      activationMessage.classList.remove('show');
    }, 5000);
  }

  // Função para ativar licença
  async function activateLicense() {
    const licenseKey = licenseInput.value.trim();

    if (!licenseKey) {
      showMessage('Por favor, digite uma chave de licença', 'error');
      return;
    }

    // Desabilitar botão e mostrar loading
    activateButton.disabled = true;
    activateButton.innerHTML = '<span class="spinner"></span> Ativando...';

    // Tentar ativar
    const result = await licenseManager.activate(licenseKey);

    if (result.success) {
      showMessage(result.message, 'success');
      
      // Aguardar 1 segundo e esconder tela de ativação
      setTimeout(() => {
        activationScreen.classList.add('hidden');
        
        // Remover da DOM após animação
        setTimeout(() => {
          activationScreen.style.display = 'none';
        }, 500);
      }, 1000);
    } else {
      showMessage(result.message, 'error');
      activateButton.disabled = false;
      activateButton.innerHTML = 'Ativar Licença';
    }
  }

  // Event listeners
  activateButton.addEventListener('click', activateLicense);
  
  licenseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      activateLicense();
    }
  });

  // Forçar foco no clique para iOS
  licenseInput.addEventListener('click', () => {
    licenseInput.focus();
  });

  // Verificar se já está ativado
  const isActivated = await licenseManager.checkActivation();
  
  if (isActivated) {
    console.log('✅ Licença já ativada para:', licenseManager.getCustomerName());
    
    // Esconder tela de ativação imediatamente
    activationScreen.style.display = 'none';
  } else {
    console.log('⚠️ Aplicativo não ativado. Aguardando licença...');
  }

  // Validação periódica (a cada 5 minutos)
  setInterval(async () => {
    if (licenseManager.isActivated) {
      const isValid = await licenseManager.checkActivation();
      
      if (!isValid) {
        console.log('❌ Licença inválida. Mostrando tela de ativação...');
        activationScreen.style.display = 'flex';
        activationScreen.classList.remove('hidden');
        showMessage('Sua licença foi desativada. Por favor, ative novamente.', 'error');
      }
    }
  }, 5 * 60 * 1000); // 5 minutos

})();
