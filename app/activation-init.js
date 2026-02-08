// Inicialização do Sistema de Ativação
(async function() {
  const activationScreen = document.getElementById('activationScreen');
  const installScreen = document.getElementById('installScreen');
  const activationForm = document.getElementById('activationForm');
  const confirmSwap = document.getElementById('confirmSwap');
  
  const licenseInput = document.getElementById('licenseInput');
  const activateButton = document.getElementById('activateButton');
  const confirmSwapBtn = document.getElementById('confirmSwapBtn');
  const cancelSwapBtn = document.getElementById('cancelSwapBtn');
  
  const activationMessage = document.getElementById('activationMessage');
  const deviceIdDisplay = document.getElementById('deviceIdDisplay');

  // Verificar se está rodando como Standalone (Tela de Início)
  const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

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
  async function activateLicense(force = false) {
    const licenseKey = licenseInput.value.trim();

    if (!licenseKey) {
      showMessage('Por favor, digite uma chave de licença', 'error');
      return;
    }

    // Desabilitar botões e mostrar loading
    activateButton.disabled = true;
    confirmSwapBtn.disabled = true;
    const originalBtnText = activateButton.innerHTML;
    activateButton.innerHTML = '<span class="spinner"></span> Processando...';

    // Tentar ativar
    const result = await licenseManager.activate(licenseKey, force);

    if (result.success) {
      showMessage('Ativado com sucesso!', 'success');
      
      // Aguardar 1 segundo e esconder tela de ativação
      setTimeout(() => {
        activationScreen.classList.add('hidden');
        setTimeout(() => {
          activationScreen.style.display = 'none';
        }, 500);
      }, 1000);
    } else {
      if (result.needsConfirmation) {
        // Mostrar tela de confirmação de troca
        activationForm.classList.add('hidden');
        confirmSwap.classList.remove('hidden');
      } else {
        showMessage(result.message || 'Erro ao ativar', 'error');
      }
      
      activateButton.disabled = false;
      confirmSwapBtn.disabled = false;
      activateButton.innerHTML = 'Ativar Licença';
    }
  }

  // Event listeners
  activateButton.addEventListener('click', () => activateLicense(false));
  confirmSwapBtn.addEventListener('click', () => activateLicense(true));
  
  cancelSwapBtn.addEventListener('click', () => {
    confirmSwap.classList.add('hidden');
    activationForm.classList.remove('hidden');
    activateButton.disabled = false;
    activateButton.innerHTML = 'Ativar Licença';
  });
  
  licenseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (confirmSwap.classList.contains('hidden')) {
        activateLicense(false);
      }
    }
  });

  // Forçar foco no clique para iOS
  licenseInput.addEventListener('click', () => {
    licenseInput.focus();
  });

  // Verificar se já está ativado
  const isActivated = await licenseManager.checkActivation();
  
  if (isActivated) {
    console.log('✅ Licença já ativada');
    // Se já estiver ativado, não precisamos mostrar nada, nem a tela de instalação
  } else {
    // Se não estiver ativado, verificar se está no modo Standalone
    if (!isStandalone) {
      installScreen.classList.remove('hidden');
      activationScreen.style.display = 'none';
    } else {
      activationScreen.style.display = 'flex';
    }
  }

  // Validação periódica (a cada 5 minutos)
  setInterval(async () => {
    if (licenseManager.isActivated) {
      const isValid = await licenseManager.checkActivation();
      
      if (!isValid) {
        activationScreen.style.display = 'flex';
        activationScreen.classList.remove('hidden');
        activationForm.classList.remove('hidden');
        confirmSwap.classList.add('hidden');
        showMessage('Sua licença foi desativada ou está em uso em outro aparelho.', 'error');
      }
    }
  }, 5 * 60 * 1000);

})();
