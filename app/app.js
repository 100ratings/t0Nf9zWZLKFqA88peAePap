(() => {
  const board = document.getElementById("board");
  const ctx = board?.getContext("2d", { alpha: true });
  const visor = document.getElementById("visor");
  const visorL1 = document.getElementById("visorLine1");
  const footer = document.getElementById("footer");
  const setupPanel = document.getElementById("setupPanel");
  const trainPanel = document.getElementById("trainPanel");
  const cardsPanel = document.getElementById("panelCards");
  const trainNumEl = document.getElementById("trainNumDisplay");
  const cardInputDisplay = document.getElementById("cardInputDisplay");
  const cardsAdjustControls = document.getElementById("cardsAdjustControls");

  let W = window.innerWidth, H = window.innerHeight, DPR = window.devicePixelRatio || 1;

  let mode = "draw"; 
  let color = "#111111";
  let strokes = [];
  let historyStrokes = [];
  let currentStroke = null;
  let drawPointerId = null;
  let eyePointerId = null;
  let swipeData = { start: null, arrows: [] };
  let cardInputData = { rank: "", suit: "", digits: "" };
  let tempTopCard = null; // Armazena a carta do topo temporária (botão amarelo)
  let isYellowSwipe = false; // Indica se o swipe atual é do botão amarelo
  
  let tapCounts = { red: 0, yellow: 0 };
  let lastTapTimes = { red: 0, yellow: 0 };
  
  let trainNum = 1;
  let adjTarget = "visor";
  let lastResult = ""; 
  let lastFooterResult = ""; 
  let adjustMode = "number";
  let isCardsAdjustMode = false;
  let peekTimer = null;
  let floatingEyeBtn = null;
  let minimizedPanelId = null;
  let wakeLock = null;
  let isWakeLockEnabled = false;

  let cfg = JSON.parse(localStorage.getItem("mnem_v6_cfg") || JSON.stringify({
    visor: { x: 50, y: 70, s: 15, lh: 1.1, y2: 0, text: "…", label: "Peek Principal", inverted: false, useEmoji: false, o: 0.3 },
    number: { x: 12.5, y: 34, s: 75, h: 41, label: "Número" },
    footer: { x: 50, y: 80, s: 10, o: 0.3, text: "Sethi Draw v.1.0.2 (1.4.2815)", label: "Peek de Apoio" },
    peek: { x: 50, y: 82, s: 15, text: "", label: "Peek" },
    toolbar: { x: 50, y: 92, s: 1, label: "Barra de Ferramentas" },
    panelSetup: { x: 50, y: 10, s: 1, o: 0.6, label: "Painel de Configurações" },
    panelTrain: { x: 50, y: 10, s: 1, o: 0.6, label: "Desenhos de Números" },
    panelCards: { x: 50, y: 10, s: 1, o: 0.6, label: "Painel de Cartas" },
    inputType: "swipe",
    yellowTarget: "top",
    peekDuration: 1.0
  }));

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        isWakeLockEnabled = true;
        console.log('Wake Lock ativo');
        wakeLock.addEventListener('release', () => {
          console.log('Wake Lock liberado');
          wakeLock = null;
          if (isWakeLockEnabled && document.visibilityState === 'visible') {
            requestWakeLock();
          }
        });
      }
    } catch (err) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const ensureCfg = () => {
    Object.keys(cfg).forEach(k => { if (cfg[k] && typeof cfg[k] === 'object' && cfg[k].visible === undefined) cfg[k].visible = true; });
    if (cfg.visor.useEmoji === undefined) cfg.visor.useEmoji = false;
    if (cfg.visor.peekStyle === undefined) cfg.visor.peekStyle = "both";
    if (cfg.visor.o === undefined) cfg.visor.o = 0.3;
    if (cfg.footer.o === undefined) cfg.footer.o = 0.3;
    if (cfg.inputType === undefined) cfg.inputType = "swipe";
    if (cfg.yellowTarget === undefined) cfg.yellowTarget = "top";
    cfg.peekDuration = 1.0;
    if (!cfg.panelSetup) cfg.panelSetup = { x: 50, y: 10, s: 1, o: 0.6, label: "Painel de Configurações" };
    if (!cfg.panelTrain) cfg.panelTrain = { x: 50, y: 10, s: 1, o: 0.6, label: "Desenhos de Números" };
    if (!cfg.panelCards) cfg.panelCards = { x: 50, y: 10, s: 1, o: 0.6, label: "Painel de Cartas" };
    
    cfg.visor.label = "Peek Principal";
    cfg.footer.label = "Peek de Apoio";
    cfg.toolbar.label = "Barra de Ferramentas";
    cfg.panelSetup.label = "Painel de Configurações";
    cfg.panelTrain.label = "Desenhos de Números";
    cfg.panelCards.label = "Painel de Cartas";
    
    // Sincronizar opacidade e tamanho entre visor e footer
    if (cfg.visor.o !== cfg.footer.o) cfg.footer.o = cfg.visor.o;
    if (cfg.visor.s !== cfg.footer.s) cfg.footer.s = cfg.visor.s;

    // Migração automática para novos defaults (Topo/Fundo) se estiverem nos valores antigos
    if (cfg.panelSetup && cfg.panelSetup.y === 30) cfg.panelSetup.y = 10;
    if (cfg.panelTrain && cfg.panelTrain.y === 30) cfg.panelTrain.y = 10;
    if (cfg.panelCards && cfg.panelCards.y === 30) cfg.panelCards.y = 10;
    if (cfg.toolbar && cfg.toolbar.y === 50) cfg.toolbar.y = 92;
  };
  ensureCfg();

  const STACK = ["4C","2H","7D","3C","4H","6D","AS","5H","9S","2S","QH","3D","QC","8H","6S","5S","9H","KC","2D","JH","3S","8S","6H","10C","5D","KD","2C","3H","8D","5C","KS","JD","8C","10S","KH","JC","7S","10H","AD","4S","7H","4D","AC","9C","JS","QD","7C","QS","10D","6C","AH","9D"];
  const posMap = {}; STACK.forEach((c, i) => posMap[c] = i + 1);

  const init = () => {
    window.addEventListener('resize', () => updateLayout(), { passive: true });
    window.addEventListener('orientationchange', () => setTimeout(updateLayout, 50), { passive: true });
    updateLayout();
    bindEvents();
    createFloatingEyeBtn();
    
    // Remover Preview do Peek (Legacy)
    const peekPreview = document.getElementById("peekPreview");
    if (peekPreview) {
      peekPreview.style.display = "none";
      const label = peekPreview.previousElementSibling;
      if (label && label.tagName === "LABEL") label.style.display = "none";
    }
    
    // Injetar botão de olho no Painel de Cartas se não existir
    const cardsHeader = cardsPanel?.querySelector(".panel-header");
    if (cardsHeader && !document.getElementById("eyeBtnCards")) {
      cardsHeader.style.position = "relative";
      const btn = document.createElement("button");
      btn.id = "eyeBtnCards";
      btn.className = "eye-button";
      btn.style.position = "absolute";
      btn.style.right = "16px"; btn.style.top = "50%"; btn.style.transform = "translateY(-50%)";
      btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
      cardsHeader.appendChild(btn);
    }

    initEyeButton("eyeBtn", "setupPanel");
    initEyeButton("eyeBtnTrain", "trainPanel");
    initEyeButton("eyeBtnCards", "panelCards");
    initBlueButtonPeek();
    checkOrientation();
    window.addEventListener('orientationchange', checkOrientation);

    // Trocar ordem visual dos botões de modo no painel de treino (Painel <-> Número)
    const btnNum = document.getElementById("modeNumBtn");
    const btnPanel = document.getElementById("modePanelBtn");
    if (btnNum && btnPanel && btnNum.parentNode) {
      btnNum.parentNode.insertBefore(btnPanel, btnNum);
    }

    updateAdjustUI();

    document.addEventListener('visibilitychange', async () => {
      if (isWakeLockEnabled && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    });
  };

  const checkOrientation = () => {
    const warning = document.getElementById("orientationWarning");
    if (window.innerWidth > window.innerHeight) { warning.classList.remove("hidden"); }
    else { warning.classList.add("hidden"); }
  };

  const updateLayout = () => {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = window.devicePixelRatio || 1;
    
    board.style.width = W + "px";
    board.style.height = H + "px";
    board.width = Math.round(W * DPR);
    board.height = Math.round(H * DPR);
    
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    applyCfg();
    render();
    checkOrientation();
  };

  const getExamplePeek = () => {
    const cardStr = cfg.visor.useEmoji ? "3♥️" : "3H";
    const numStr = "14";
    if (cfg.visor.peekStyle === "cardOnly") return cardStr;
    return cfg.visor.inverted ? `${numStr} ${cardStr}` : `${cardStr} ${numStr}`;
  };

  const applyCfg = () => {
    visor.style.display = cfg.visor.visible ? "block" : "none";
    visor.style.left = (cfg.visor.x * W / 100) + "px";
    visor.style.top = (cfg.visor.y * H / 100) + "px";
    visor.style.fontSize = cfg.visor.s + "px";
    visor.style.lineHeight = cfg.visor.lh;
    
    if (mode === "setup" || mode === "train" || mode === "cards") {
      visor.style.opacity = cfg.visor.o;
      visorL1.textContent = lastResult || getExamplePeek();
      visorL1.classList.remove("loading-dots-animation");
    } else if (mode === "draw") {
      visor.style.opacity = 0;
      visorL1.textContent = cfg.visor.text;
      visorL1.classList.remove("loading-dots-animation");
    } else if (mode === "swipe") {
      visor.style.opacity = cfg.visor.o;
      // Animação Inteligente: pontos aparecem apenas enquanto aguarda o comando (arrows.length === 0)
      // E apenas se o swipe ainda não começou (swipeData.start === null)
      if (swipeData.arrows.length === 0 && !swipeData.start) {
        visorL1.textContent = "";
        visorL1.classList.add("loading-dots-animation");
      } else {
        // Sumiço Automático: ao iniciar o swipe ou ter setas, a animação para
        visorL1.classList.remove("loading-dots-animation");
      }
    } else {
      visor.style.opacity = cfg.visor.o;
      visorL1.classList.remove("loading-dots-animation");
    }
    
    footer.style.display = cfg.footer.visible ? "block" : "none";
    footer.style.left = (cfg.footer.x * W / 100) + "px";
    footer.style.top = (cfg.footer.y * H / 100) + "px";
    footer.style.fontSize = cfg.footer.s + "px";
    footer.style.bottom = "auto"; // Garante que nada force ele para cima
    footer.style.pointerEvents = "none"; // Bala de Prata: Garante que o toque passe direto (Ghost Element)
    footer.style.opacity = cfg.footer.o;
    
    // Preservação Total: O footer (Peek de Apoio) SEMPRE mantém o último resultado se existir.
    // Ele não deve sumir ou resetar para o texto padrão ao tocar no vermelho ou lixeira.
    footer.textContent = lastFooterResult || cfg.footer.text;

    const panels = { "toolbar": "toolbar", "setupPanel": "panelSetup", "trainPanel": "panelTrain", "panelCards": "panelCards" };
    Object.keys(panels).forEach(id => {
      const el = document.getElementById(id);
      const c = cfg[panels[id]];
      if (el && c) {
        if (id === "toolbar") {
          el.style.display = c.visible ? "flex" : "none";
          el.style.left = (c.x * W / 100) + "px";
          el.style.top = (c.y * H / 100) + "px";
          el.style.bottom = "auto";
          el.style.transform = `translateX(-50%) scale(${c.s})`;
        } else {
          el.style.left = (c.x * W / 100) + "px";
          el.style.top = (c.y * H / 100) + "px";
          el.style.bottom = "auto";
          el.style.transform = `translateX(-50%) scale(${c.s})`;
          el.style.background = `rgba(255, 255, 255, ${c.o})`;
        }
      }
    });

    document.getElementById("toggleEmojiBtn").textContent = `Símbolos de Naipes: ${cfg.visor.useEmoji ? 'ON' : 'OFF'}`;
    document.getElementById("inputSwipeBtn").classList.toggle("active", cfg.inputType === "swipe");
    document.getElementById("swatchGroup").querySelectorAll(".swatch").forEach(s => {
      if (s.dataset.color === "#FF3B30") s.classList.toggle("swipe-active", mode === "swipe" && !isYellowSwipe);
      if (s.dataset.color === "#F7C600") s.classList.toggle("swipe-active", mode === "swipe" && isYellowSwipe);
    });

    document.getElementById("invertOrderBtn").textContent = cfg.visor.inverted ? "Ordem: 05 4H → 4H 05" : "Ordem: 4H 05 → 05 4H";
    document.getElementById("togglePeekStyleBtn").textContent = `Estilo: ${cfg.visor.peekStyle === 'cardOnly' ? 'Apenas Carta' : 'Carta + Posição'}`;

    document.querySelectorAll(".setup-btn-target").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.target === adjTarget);
    });

    localStorage.setItem("mnem_v6_cfg", JSON.stringify(cfg));
  };

  const bindEvents = () => {
    const handleSwatchClick = (s) => {
      const c = s.dataset.color;
      document.querySelectorAll(".swatch").forEach(b => b.classList.remove("active"));
      s.classList.add("active");
      color = c;

      const toggleSwipe = (yellow = false) => {
        if (mode === "swipe" && isYellowSwipe === yellow) { mode = "draw"; visor.style.opacity = 0; isYellowSwipe = false; }
        else { mode = "swipe"; visor.style.opacity = cfg.visor.o; visorL1.textContent = ""; isYellowSwipe = yellow; }
        swipeData.arrows = [];
        applyCfg();
      };

      const toggleYellowSwipe = () => toggleSwipe(true);
      const toggleRedSwipe = () => toggleSwipe(false);

      const updateTap = (key, limit, action) => {
        const now = Date.now();
        if (now - lastTapTimes[key] < 400) tapCounts[key]++;
        else tapCounts[key] = 1;
        lastTapTimes[key] = now;
        if (tapCounts[key] >= limit) { action(); tapCounts[key] = 0; }
      };

      if (c === "#FF3B30") {
        requestWakeLock();
        if (cfg.inputType === "cards") window.toggleCards(false);
        else toggleRedSwipe();
      }
      if (c === "#F7C600") {
        if (cfg.inputType === "cards") {
          isYellowSwipe = true;
          window.toggleCards(false);
        } else {
          updateTap('yellow', 1, toggleYellowSwipe);
        }
      }
    };

    document.querySelectorAll(".swatch").forEach(s => {
      let pressTimer = null;

      s.addEventListener("pointerdown", (e) => {
        if (!e.isPrimary) return;
        if (s.dataset.color === "#111111") {
          pressTimer = setTimeout(() => {
            window.toggleSetup();
            pressTimer = null;
          }, 1500);
        }
      });

      s.addEventListener("pointerup", (e) => {
        if (!e.isPrimary) return;
        if (s.dataset.color === "#111111" && !pressTimer) return; // Long press triggered
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        handleSwatchClick(s);
      });

      s.addEventListener("pointerleave", () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      });
    });

    document.getElementById("clearBtn").onclick = (e) => { 
      e.stopPropagation(); 
      strokes = []; 
      historyStrokes = []; 
      swipeData.arrows = []; 
      if (mode === "swipe") { mode = "draw"; visor.style.opacity = 0; isYellowSwipe = false; }
      if (mode === "cards") window.toggleCards();
      applyCfg();
      render(); 
    };

    document.getElementById("undoBtn").onclick = (e) => {
      e.stopPropagation();
      if (strokes.length > 0) {
        historyStrokes.push(strokes.pop());
        render();
      }
    };

    board.addEventListener("pointerdown", onPointerDown);
    board.addEventListener("pointermove", onPointerMove);
    board.addEventListener("pointerup", onPointerUp);
    board.addEventListener("pointercancel", onPointerUp);
  };

  const onPointerDown = (e) => {
    if (!e.isPrimary) return;
    drawPointerId = e.pointerId;
    
    if (mode === "swipe") {
      swipeData.start = { x: e.clientX, y: e.clientY };
    } else {
      currentStroke = { color, points: [{ x: e.clientX, y: e.clientY }] };
      strokes.push(currentStroke);
      historyStrokes = [];
    }
  };

  const onPointerMove = (e) => {
    if (e.pointerId !== drawPointerId) return;
    
    if (mode === "swipe") {
      if (!swipeData.start) return;
      // Lógica de Swipe Visual (Opcional: desenhar rastro do swipe)
    } else if (currentStroke) {
      currentStroke.points.push({ x: e.clientX, y: e.clientY });
      render();
    }
  };

  const onPointerUp = (e) => {
    if (e.pointerId !== drawPointerId) return;
    drawPointerId = null;

    if (mode === "swipe" && swipeData.start) {
      const dx = e.clientX - swipeData.start.x;
      const dy = e.clientY - swipeData.start.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 30) {
        let arrow = "";
        if (Math.abs(dx) > Math.abs(dy)) arrow = dx > 0 ? "→" : "←";
        else arrow = dy > 0 ? "↓" : "↑";
        
        swipeData.arrows.push(arrow);
        applyCfg(); // Atualiza visor com as setas
        
        const limit = isYellowSwipe ? 3 : 7;
        if (swipeData.arrows.length >= limit) resolveSwipe();
      }
      swipeData.start = null;
    }
    currentStroke = null;
  };

  const resolveSwipe = () => {
    const arr = swipeData.arrows;
    
    if (isYellowSwipe) {
      // Lógica do Amarelo: ↑→S, →↑H, →↓C, ↓→D
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      if (rank && suit) {
        tempTopCard = rank + suit;
        lastResult = `TOPO: ${formatCard(tempTopCard)}`;
        lastFooterResult = lastResult;
        visorL1.textContent = lastResult;
      } else {
        visorL1.textContent = "ERRO";
      }
    } else {
      // Lógica do Vermelho (7 swipes): Card(3) + Num(4)
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      
      const dec = {"↑↑":0,"↑→":10,"→↑":20,"→→":30,"→↓":40,"↓→":50}[arr[3]+arr[4]];
      const unt = {"↑↑":0,"↑→":1,"→↑":2,"→→":3,"→↓":4,"↓→":5,"↓↓":6,"↓←":7,"←↓":8,"←←":"9"}[arr[5]+arr[6]];
      
      if (rank && suit && dec !== undefined && unt !== undefined) {
        const card = rank + suit;
        const num = parseInt(dec) + parseInt(unt);
        processResult(card, num);
      } else {
        visorL1.textContent = "ERRO";
      }
    }

    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => {
      if (mode !== "setup" && mode !== "train" && mode !== "cards") {
        visor.style.opacity = 0;
        setTimeout(() => { if (mode === "draw") visorL1.textContent = cfg.visor.text; }, 300);
      }
      swipeData.arrows = [];
      if (mode === "swipe") { mode = "draw"; isYellowSwipe = false; }
      applyCfg();
    }, cfg.peekDuration * 1000);
  };

  const processResult = (card, num) => {
    if (!card || num < 1 || num > 52) {
      visorL1.textContent = "ERRO";
      lastResult = "ERRO";
    } else {
      lastResult = `${formatCard(card)} ${num.toString().padStart(2, '0')}`;
      lastFooterResult = lastResult;
      visorL1.textContent = lastResult;
    }
  };

  const formatCard = (c) => {
    if (!c) return "";
    const r = c.slice(0, -1);
    const s = c.slice(-1);
    const suitEmoji = {"S":"♠️","H":"♥️","C":"♣️","D":"♦️"}[s] || s;
    return cfg.visor.useEmoji ? r + suitEmoji : r + s;
  };

  const render = () => {
    ctx.clearRect(0, 0, W, H);
    strokes.forEach(s => {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      s.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  };

  const closeOtherPanels = () => {
    [setupPanel, trainPanel, cardsPanel].forEach(p => p?.classList.add("hidden"));
  };

  window.toggleSetup = () => {
    if (mode === "setup") { mode = "draw"; setupPanel.classList.add("hidden"); visor.style.opacity = 0; }
    else { closeOtherPanels(); mode = "setup"; setupPanel.classList.remove("hidden"); adjTarget = "panelSetup"; applyCfg(); updateAdjustUI(); }
  };

  window.toggleTrain = () => {
    if (mode === "train") { mode = "draw"; trainPanel.classList.add("hidden"); visor.style.opacity = 0; }
    else { closeOtherPanels(); mode = "train"; trainPanel.classList.remove("hidden"); adjTarget = "panelTrain"; applyCfg(); updateAdjustUI(); }
  };

  window.toggleCards = (isAdjust = false) => {
    isCardsAdjustMode = isAdjust;
    if (mode === "cards" && !isAdjust) { mode = "draw"; cardsPanel.classList.add("hidden"); visor.style.opacity = 0; }
    else {
      closeOtherPanels(); mode = "cards"; cardsPanel.classList.remove("hidden");
      cardsAdjustControls.classList.toggle("hidden", !isAdjust);
      cardInputData = { rank: "", suit: "", digits: "" };
      updateCardDisplay(); applyCfg();
    }
  };

  window.selectCardPart = (type, val) => {
    if (type === "rank") cardInputData.rank = val;
    if (type === "suit") cardInputData.suit = val;
    if (type === "digit") {
      cardInputData.digits += val;
      if (cardInputData.digits.length > 2) cardInputData.digits = val;
    }
    updateCardDisplay();
    if (cardInputData.rank && cardInputData.suit && cardInputData.digits.length === 2) {
      const num = parseInt(cardInputData.digits);
      if (num >= 1 && num <= 52) {
        processResult(cardInputData.rank + cardInputData.suit, num);
        setTimeout(() => window.toggleCards(), 1500);
      } else {
        cardInputData.digits = ""; updateCardDisplay();
      }
    }
  };

  const updateCardDisplay = () => {
    const r = cardInputData.rank || "--";
    const s = cardInputData.suit ? ({"S":"♠️","H":"♥️","C":"♣️","D":"♦️"}[cardInputData.suit]) : "--";
    const d = cardInputData.digits.padStart(2, '-');
    cardInputDisplay.textContent = `${r}${s} ${d}`;
  };

  const initEyeButton = (btnId, panelId) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.onclick = () => {
      document.getElementById(panelId).classList.add("hidden");
      minimizedPanelId = panelId;
      floatingEyeBtn.classList.remove("hidden");
    };
  };

  const createFloatingEyeBtn = () => {
    floatingEyeBtn = document.createElement("button");
    floatingEyeBtn.className = "floating-eye hidden";
    floatingEyeBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    document.body.appendChild(floatingEyeBtn);
    floatingEyeBtn.onclick = () => {
      if (minimizedPanelId) document.getElementById(minimizedPanelId).classList.remove("hidden");
      floatingEyeBtn.classList.add("hidden");
    };
  };

  const initBlueButtonPeek = () => {
    const blueBtn = document.querySelector('.swatch[data-color="#007AFF"]');
    if (!blueBtn) return;
    blueBtn.addEventListener("pointerdown", () => {
      visor.style.opacity = cfg.visor.o;
      visorL1.textContent = lastResult || getExamplePeek();
    });
    blueBtn.addEventListener("pointerup", () => {
      if (mode === "draw") visor.style.opacity = 0;
    });
  };

  window.adjust = (axis, delta, key) => {
    cfg[key][axis] += delta;
    if (axis === 'o') cfg[key][axis] = Math.max(0, Math.min(1, cfg[key][axis]));
    applyCfg(); updateAdjustUI();
  };

  window.adjustDirect = (axis, val, key) => {
    cfg[key][axis] = parseFloat(val);
    applyCfg(); updateAdjustUI();
  };

  const updateAdjustUI = () => {
    const container = document.getElementById("setupAdjusts");
    if (!container) return;
    container.innerHTML = "";
    const target = cfg[adjTarget];
    if (!target) return;

    const createStepper = (label, key, axis, step) => {
      const div = document.createElement("div");
      div.className = "stepper-control";
      div.innerHTML = `
        <span class="stepper-label">${label}</span>
        <button class="stepper-btn" onclick="window.adjust('${axis}', ${-step}, '${key}')">-</button>
        <span class="stepper-value">${target[axis].toFixed(axis === 's' && (key.startsWith('panel') || key === 'toolbar') ? 2 : 1)}</span>
        <button class="stepper-btn" onclick="window.adjust('${axis}', ${step}, '${key}')">+</button>
      `;
      return div;
    };

    if (target.x !== undefined) container.appendChild(createStepper("Posição X", adjTarget, "x", 0.5));
    if (target.y !== undefined) container.appendChild(createStepper("Posição Y", adjTarget, "y", 0.5));
    if (target.s !== undefined) container.appendChild(createStepper("Tamanho", adjTarget, "s", (adjTarget.startsWith('panel') || adjTarget === 'toolbar' ? 0.05 : 1)));
    
    if (target.o !== undefined) {
      const div = document.createElement("div");
      div.className = "slider-control";
      div.innerHTML = `
        <div class="slider-label-group"><span class="slider-label">Opacidade</span><span class="slider-value-display">${Math.round(target.o * 100)}%</span></div>
        <input type="range" class="range-slider" min="0" max="1" step="0.01" value="${target.o}" oninput="window.adjustDirect('o', this.value, '${adjTarget}')">
      `;
      container.appendChild(div);
    }
  };

  window.setInputType = (t) => { cfg.inputType = t; applyCfg(); };
  window.toggleEmoji = () => { cfg.visor.useEmoji = !cfg.visor.useEmoji; applyCfg(); };
  window.toggleInvertOrder = () => { cfg.visor.inverted = !cfg.visor.inverted; applyCfg(); };
  window.togglePeekStyle = () => { cfg.visor.peekStyle = (cfg.visor.peekStyle === "both" ? "cardOnly" : "both"); applyCfg(); };
  window.setTarget = (t) => { adjTarget = t; updateAdjustUI(); applyCfg(); };

  init();
})();
