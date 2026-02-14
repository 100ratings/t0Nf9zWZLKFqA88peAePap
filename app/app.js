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
    peekDuration: 1.0
  }));

  const ensureCfg = () => {
    Object.keys(cfg).forEach(k => { if (cfg[k] && typeof cfg[k] === 'object' && cfg[k].visible === undefined) cfg[k].visible = true; });
    if (cfg.visor.useEmoji === undefined) cfg.visor.useEmoji = false;
    if (cfg.visor.peekStyle === undefined) cfg.visor.peekStyle = "both";
    if (cfg.visor.o === undefined) cfg.visor.o = 0.3;
    if (cfg.footer.o === undefined) cfg.footer.o = 0.3;
    if (cfg.inputType === undefined) cfg.inputType = "swipe";
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
    window.addEventListener('resize', onResize);
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
  };

  const checkOrientation = () => {
    const warning = document.getElementById("orientationWarning");
    if (window.innerWidth > window.innerHeight) { warning.classList.remove("hidden"); }
    else { warning.classList.add("hidden"); }
  };

  const updateLayout = () => {
    W = window.innerWidth; H = window.innerHeight; DPR = window.devicePixelRatio || 1;
    board.width = W * DPR; board.height = H * DPR;
    board.style.width = W + "px"; board.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    applyCfg(); render(); checkOrientation();
  };

  const onResize = () => {
    setTimeout(updateLayout, 100);
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
        if (id === "toolbar") el.style.display = c.visible ? "flex" : "none";
        el.style.left = (c.x * W / 100) + "px";
        el.style.top = (c.y * H / 100) + "px";
        el.style.transform = `translateX(-50%) scale(${c.s})`;
        if (id !== "toolbar") el.style.background = `rgba(255, 255, 255, ${c.o})`;
      }
    });

    document.getElementById("toggleEmojiBtn").textContent = `Símbolos de Naipes: ${cfg.visor.useEmoji ? 'ON' : 'OFF'}`;
    document.getElementById("inputSwipeBtn").classList.toggle("active", cfg.inputType === "swipe");
    document.getElementById("swatchGroup").querySelectorAll(".swatch").forEach(s => {
      // O pontinho de cima (swipe-active) agora mostra a animação de carregamento (. .. ...)
      if (s.dataset.color === "#FF3B30") s.classList.toggle("swipe-active", mode === "swipe" && !isYellowSwipe);
      if (s.dataset.color === "#F7C600") s.classList.toggle("swipe-active", mode === "swipe" && isYellowSwipe);
    });
    document.getElementById("inputCardsBtn").classList.toggle("active", cfg.inputType === "cards");
    document.getElementById("invertOrderBtn").textContent = cfg.visor.inverted ? "Ordem: 05 4H → 4H 05" : "Ordem: 4H 05 → 05 4H";
    document.getElementById("togglePeekStyleBtn").textContent = `Estilo: ${cfg.visor.peekStyle === 'cardOnly' ? 'Apenas Carta' : 'Carta + Posição'}`;

    document.querySelectorAll(".setup-btn-target").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.target === adjTarget);
    });

    localStorage.setItem("mnem_v6_cfg", JSON.stringify(cfg));
  };

  const bindEvents = () => {
    document.querySelectorAll(".swatch").forEach(s => {
      // Lógica de segurar para o botão preto (Setup) - 3 segundos
      if (s.dataset.color === "#111111") {
        let blackTimer = null;
        s.addEventListener("pointerdown", (e) => {
          blackTimer = setTimeout(() => window.toggleSetup(), 1500);
        });
        const clearBlack = () => clearTimeout(blackTimer);
        s.addEventListener("pointerup", clearBlack);
        s.addEventListener("pointercancel", clearBlack);
        s.addEventListener("pointerleave", clearBlack);
      }

      s.onclick = (e) => {
        if (s.dataset.color === "#007AFF" && s.dataset.isHolding === "true") return;
        e.stopPropagation();
        const now = Date.now();
        const c = s.dataset.color;
        document.querySelectorAll(".swatch").forEach(b => b.classList.remove("active"));
        s.classList.add("active");
        color = c;

        const updateTap = (key, limit, action) => {
          if (now - lastTapTimes[key] < 500) tapCounts[key]++;
          else tapCounts[key] = 1;
          lastTapTimes[key] = now;
          if (tapCounts[key] >= limit) { action(); tapCounts[key] = 0; }
        };

        if (c === "#FF3B30") {
          if (cfg.inputType === "cards") window.toggleCards(false);
          else updateTap('red', 1, toggleSwipe);
        }
        if (c === "#F7C600") {
          updateTap('yellow', 1, toggleYellowSwipe);
        }
      };
    });

    // Failsafe global: Limpar estados ao clicar em botões de controle críticos
    const resetInteractionState = () => {
      drawPointerId = null;
      eyePointerId = null;
      currentStroke = null;
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("transparent-peek"));
      try { board.releasePointerCapture(); } catch(e){}
      // Só esconde o botão flutuante se NÃO estivermos em modo minimizado
      if (floatingEyeBtn && !minimizedPanelId) floatingEyeBtn.style.display = "none";
    };
    
    // Failsafes de emergência para evitar travamento total (iOS/Multitouch)
    window.addEventListener("blur", resetInteractionState);
    window.addEventListener("visibilitychange", resetInteractionState);

    document.getElementById("undoBtn").onclick = (e) => { e.stopPropagation(); strokes.pop(); render(); };
    document.getElementById("clearBtn").onclick = (e) => { 
      e.stopPropagation(); 
      strokes = []; 
      swipeData.arrows = []; 
      if (mode === "swipe") { mode = "draw"; visor.style.opacity = 0; isYellowSwipe = false; }
      if (mode === "cards") window.toggleCards();
      tempTopCard = null;
      resetInteractionState();
      applyCfg();
      render(); 
    };

    let dragData = { active: false, startX: 0, startY: 0, initialX: 0, initialY: 0, axis: null, target: null };

  window.onpointerdown = (e) => {
    // 1. Interações de UI (Botões, Toolbar, Telas de bloqueio)
    // Se for um elemento interativo, deixamos o evento passar e não desenhamos
    if (e.target.closest(".stepper-btn") || 
        e.target.closest(".swatch") || 
        e.target.closest("button") || 
        e.target.closest("input") ||
        e.target.closest("#toolbar") || 
        e.target.closest("#activationScreen") || 
        e.target.closest("#installScreen") || 
        e.target.closest("#orientationWarning") ||
        e.target.closest("#floatingEyeBtn")) {
      
      // Lógica específica para os botões de ajuste (stepper) que usam drag
      const stepperBtn = e.target.closest(".stepper-btn");
      if (stepperBtn) {
        const onclick = stepperBtn.getAttribute("onclick");
        const match = onclick && onclick.match(/window\.adjust\('([^']*)', ([-.0-9]*), '([^']*)'\)/);
        if (match) {
          e.preventDefault();
          if (drawPointerId !== null) return;
          if (eyePointerId !== null && e.pointerId === eyePointerId) return;
          drawPointerId = e.pointerId;
          const [_, axis, val, targetKey] = match;
          dragData = { active: true, startX: e.clientX, startY: e.clientY, initialVal: cfg[targetKey][axis], axis, targetKey };
          window.adjust(axis, parseFloat(val), targetKey);
        }
      }
      return;
    }

    // 2. Lógica do Painel (Setup/Treino/Cartas)
    const panel = e.target.closest(".panel");
    // Se tocou no painel e ele NÃO está transparente, bloqueia o desenho (é interação de UI)
    if (panel && !panel.classList.contains("transparent-peek")) return;
    
    // 3. Validação de Ponteiros (Multitouch e Olho)
    if (drawPointerId !== null) return; // Já tem um dedo desenhando
    if (eyePointerId !== null && e.pointerId === eyePointerId) return; // Este é o dedo do olho

    // 4. Iniciar Desenho
    drawPointerId = e.pointerId;
    try { board.setPointerCapture(e.pointerId); } catch(e){}

    // Só prevenimos o padrão (scroll/zoom) agora que confirmamos que é um desenho
    if (e.cancelable) e.preventDefault();

    const p = getPt(e);
    if (mode === "swipe") { 
      swipeData.start = p; 
      // Sumiço Automático: no exato momento em que inicia o movimento, a animação para
      applyCfg();
      return; 
    }
    currentStroke = { c: mode === "train" ? "#111111" : color, p: [p] };
  };

  window.onpointermove = (e) => {
    if (drawPointerId !== null && e.pointerId !== drawPointerId) return;

    if (dragData.active) {
      const dx = e.clientX - dragData.startX;
      const dy = e.clientY - dragData.startY;
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
      const sensitivity = (dragData.axis === 's' && (dragData.targetKey.startsWith('panel') || dragData.targetKey === 'toolbar')) || dragData.axis === 'o' ? 0.005 : 0.2;
      const newVal = dragData.initialVal + delta * sensitivity;
      window.adjustDirect(dragData.axis, newVal, dragData.targetKey);
      return;
    }
    if (!currentStroke) return;
    const p = getPt(e); e.preventDefault();
    currentStroke.p.push(p);
    drawSeg(currentStroke.p[currentStroke.p.length-2], p, currentStroke.c);
  };

  const endPointer = (e) => {
    if (drawPointerId !== null && e.pointerId !== drawPointerId) return;

    if (dragData.active) { dragData.active = false; drawPointerId = null; return; }
    if (mode === "swipe" && swipeData.start) {
      const arrow = getArrow(swipeData.start, getPt(e));
      swipeData.start = null;
      if (arrow) { 
        swipeData.arrows.push(arrow); 
        updateVisorProgress(); 
        visor.style.opacity = cfg.visor.o; 
        const targetLen = isYellowSwipe ? 3 : 7;
        if (swipeData.arrows.length === targetLen) resolveSwipe(); 
      }
    }
    if (currentStroke) { strokes.push(currentStroke); currentStroke = null; render(); }
    
    if (drawPointerId !== null) {
      drawPointerId = null;
      try { board.releasePointerCapture(e.pointerId); } catch(e){}
    }
  };

  window.onpointerup = endPointer;
  window.onpointercancel = endPointer;
};

  const getPt = (e) => { const r = board.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const drawSeg = (p1, p2, c) => {
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 6; ctx.strokeStyle = c;
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); ctx.restore();
  };

  const render = () => {
    ctx.clearRect(0, 0, board.width, board.height);
    strokes.forEach(s => {
      ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 6; ctx.strokeStyle = s.c;
      ctx.beginPath(); ctx.moveTo(s.p[0].x, s.p[0].y);
      for (let i = 1; i < s.p.length; i++) ctx.lineTo(s.p[i].x, s.p[i].y);
      ctx.stroke(); ctx.restore();
    });
  };

  const getArrow = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (Math.hypot(dx, dy) < 30) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "→" : "←") : (dy > 0 ? "↓" : "↑");
  };

  const formatCard = (card) => {
    const rank = card.slice(0, -1); const suit = card.slice(-1);
    const suitDisplay = cfg.visor.useEmoji ? ({"S":"♠️","H":"♥️","C":"♣️","D":"♦️"}[suit] || suit) : suit;
    return rank + suitDisplay;
  };

  const updateVisorProgress = () => {
    const arr = swipeData.arrows; const len = arr.length; let content = arr.join("");
    if (len >= 3) {
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      const card = (rank && suit) ? formatCard(rank+suit) : "??";
      if (len === 3) content = isYellowSwipe ? `TOPO: ${card}` : card;
      else if (len >= 5) {
        const dec = {"↑↑":0,"↑→":10,"→↑":20,"→→":"30","→↓":40,"↓→":50}[arr[3]+arr[4]];
        const decStr = dec !== undefined ? (dec/10).toString() : "?";
        if (len === 5) content = `${card} ${decStr}`;
        else if (len === 7) {
          const unt = {"↑↑":0,"↑→":1,"→↑":2,"→→":3,"→↓":4,"↓→":5,"↓↓":6,"↓←":7,"←↓":8,"←←":"9"}[arr[5]+arr[6]];
          const num = (dec !== undefined && unt !== undefined) ? parseInt(dec) + parseInt(unt) : "??";
          content = `${card} ${num}`;
        }
      }
    }
    visorL1.textContent = content;
  };

  const resolveSwipe = () => {
    const arr = swipeData.arrows;
    const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
    const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
    const card = (rank && suit) ? rank+suit : "";
    
    if (isYellowSwipe) {
      if (card) {
        tempTopCard = card;
        visorL1.textContent = `TOPO: ${formatCard(card)}`;

        color = "#111111";
        document.querySelectorAll(".swatch").forEach(s => {
          s.classList.toggle("active", s.dataset.color === "#111111");
        });
      } else {
        visorL1.textContent = "ERRO";
      }
    } else {
      const dec = {"↑↑":0,"↑→":10,"→↑":20,"→→":30,"→↓":40,"↓→":50}[arr[3]+arr[4]];
      const unt = {"↑↑":0,"↑→":1,"→↑":2,"→→":3,"→↓":4,"↓→":5,"↓↓":6,"↓←":7,"←↓":8,"←←":"9"}[arr[5]+arr[6]];
      const num = (dec !== undefined && unt !== undefined) ? parseInt(dec) + parseInt(unt) : 0;
      processResult(card, num);
    }
    
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { 
      if (mode !== "setup" && mode !== "cards" && mode !== "train") { visor.style.opacity = 0; setTimeout(() => { if (mode === "draw") visorL1.textContent = cfg.visor.text; }, 300); }
      swipeData.arrows = []; if (mode === "swipe") { mode = "draw"; isYellowSwipe = false; }
    }, cfg.peekDuration * 1000);
  };

  const processResult = (card, num) => {
    if (!card || num < 1 || num > 52) { visorL1.textContent = "ERRO"; lastResult = "ERRO"; }
    else {
      const pos = posMap[card]; const cut = ((pos - num % 52) + 52) % 52; const cutNum = (cut === 0 ? 52 : cut);
      const cardResult = STACK[cutNum-1];
      const cardStr = formatCard(cardResult); 
      
      // Cálculo da posição no topo temporário
      let numStr = cutNum.toString().padStart(2, '0');
      if (tempTopCard) {
        const topPos = posMap[tempTopCard];
        const newPos = ((posMap[cardResult] - topPos + 1) + 52) % 52;
        const finalNewPos = (newPos === 0 ? 52 : newPos);
        numStr = finalNewPos.toString().padStart(2, '0');
        tempTopCard = null; // Reset automático após o cálculo
      }
      
      const peekResult = cfg.visor.peekStyle === "cardOnly" ? cardStr : (cfg.visor.inverted ? `${numStr} ${cardStr}` : `${cardStr} ${numStr}`);
      visorL1.textContent = peekResult; lastResult = peekResult;
      const ZZ_raw = cutNum.toString().padStart(2, '0'); const ZZ = ZZ_raw[0] + "." + ZZ_raw[1]; 
      const XX = pos.toString().padStart(2, '0'); const YY = num.toString().padStart(2, '0'); 
      const footerResult = `Sethi Draw v.1.0.2 (${ZZ}.${XX}${YY})`;
      footer.textContent = footerResult;
      lastFooterResult = footerResult; // Armazena o resultado completo para preservação no footer
      stamp(num);
    }
  };

  const stamp = (n) => {
    const numKey = parseInt(n); const g = JSON.parse(localStorage.getItem(`v6_g_${numKey}`) || "null");
    
    // Prioridade: Ajuste individual do número (g.cfg) ou ajuste global (cfg.number)
    const nCfg = g?.cfg || cfg.number;
    const rx = nCfg.x * W / 100, ry = nCfg.y * H / 100;
    const rw = nCfg.s * W / 100, rh = nCfg.h * H / 100;
    
    if (g?.s) g.s.forEach(s => strokes.push({ c: "#111111", p: s.p.map(p => ({ x: rx + p.x * rw, y: ry + p.y * rh })) }));
    else { ctx.save(); ctx.font = "bold 50px sans-serif"; ctx.fillText(n, rx + 20, ry + 60); ctx.restore(); }
    render();
  };

  window.toggleSetup = () => {
    if (eyePointerId !== null) return; // Evita abrir menu se estiver segurando o olho (opcional, mas seguro)
    if (mode === "setup") { mode = "draw"; setupPanel.classList.add("hidden"); visor.style.opacity = 0; applyCfg(); }
    else { closeOtherPanels(); mode = "setup"; setupPanel.classList.remove("hidden"); window.setTarget('panelSetup'); }
  };

  const toggleSwipe = () => {
    if (mode === "swipe" && !isYellowSwipe) { 
      mode = "draw"; visor.style.opacity = 0; 
    } else { 
      closeOtherPanels(); 
      mode = "swipe"; 
      isYellowSwipe = false;
      visor.style.opacity = cfg.visor.o; 
      visorL1.textContent = ""; 
      strokes = []; // Limpa o canvas ao iniciar um novo comando
    }
    swipeData.arrows = [];
    applyCfg();
    render(); // Força a limpeza visual do canvas
  };

  const toggleYellowSwipe = () => {
    if (mode === "swipe" && isYellowSwipe) { 
      mode = "draw"; visor.style.opacity = 0; isYellowSwipe = false; 
    } else { 
      closeOtherPanels(); 
      mode = "swipe"; 
      isYellowSwipe = true;
      visor.style.opacity = cfg.visor.o; 
      visorL1.textContent = ""; 
      strokes = []; // Limpa o canvas ao iniciar um novo comando amarelo
    }
    swipeData.arrows = [];
    applyCfg();
    render(); // Força a limpeza visual do canvas
  };

  window.toggleCards = (isAdjust = false) => {
    if (mode === "cards") { mode = "draw"; cardsPanel.classList.add("hidden"); if (lastResult) { visor.style.opacity = cfg.visor.o; clearTimeout(peekTimer); peekTimer = setTimeout(() => { if (mode === "draw") visor.style.opacity = 0; }, cfg.peekDuration * 1000); } else { visor.style.opacity = 0; } isCardsAdjustMode = false; }
    else { 
      closeOtherPanels(); mode = "cards"; cardsPanel.classList.remove("hidden"); 
      isCardsAdjustMode = isAdjust;
      cardsAdjustControls.classList.toggle("hidden", !isAdjust);
      visor.style.opacity = cfg.visor.o; visorL1.textContent = lastResult || getExamplePeek(); resetCardInput(); 
      if (isAdjust) updateAdjustUI();
      strokes = []; // Limpa o canvas ao abrir o seletor de cartas
      render();
    }
  };

  window.openCardsAdjust = () => { window.setTarget('panelCards'); window.toggleCards(true); };

  const closeOtherPanels = () => {
    // Failsafe: Garante que o modo transparente seja removido ao trocar de painéis
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("transparent-peek"));
    eyePointerId = null;
    if (floatingEyeBtn) floatingEyeBtn.style.display = "none";
    minimizedPanelId = null;
    
    setupPanel.classList.add("hidden"); trainPanel.classList.add("hidden"); cardsPanel.classList.add("hidden");
    if (mode === "swipe") { mode = "draw"; isYellowSwipe = false; }
    applyCfg();
  };

  window.selectCardPart = (type, val) => {
    if (type === 'rank') cardInputData.rank = val;
    if (type === 'suit') cardInputData.suit = val;
    if (type === 'digit') {
      if (cardInputData.digits.length >= 2) cardInputData.digits = val;
      else cardInputData.digits += val;
    }
    
    document.querySelectorAll(`#panelCards .card-btn[data-${type}]`).forEach(b => b.classList.remove("active"));
    const selectedBtn = document.querySelector(`#panelCards .card-btn[data-${type}="${val}"]`);
    if (selectedBtn) selectedBtn.classList.add("active");

    const suitEmoji = {"S":"♠️","H":"♥️","C":"♣️","D":"♦️"}[cardInputData.suit] || "";
    cardInputDisplay.textContent = `${cardInputData.rank}${suitEmoji} ${cardInputData.digits.padEnd(2, '-')}`;
    
    if (cardInputData.rank && cardInputData.suit && cardInputData.digits.length === 2) {
      processResult(cardInputData.rank + cardInputData.suit, parseInt(cardInputData.digits));
      if (!isCardsAdjustMode) window.toggleCards();
    }
  };

  const resetCardInput = () => { 
    cardInputData = { rank: "", suit: "", digits: "" }; 
    cardInputDisplay.textContent = "--- --"; 
    document.querySelectorAll("#panelCards .card-btn").forEach(b => b.classList.remove("active"));
  };

  window.setTarget = (t) => { 
    adjTarget = t;
    document.getElementById("oControl").style.display = (t === "visor" || t === "footer" || t.startsWith("panel")) ? "block" : "none";
    document.getElementById("editTextBtn").style.display = (t === "footer") ? "block" : "none";
    updateAdjustUI();
    applyCfg();
  };

  window.setInputType = (type) => { cfg.inputType = type; applyCfg(); };

  // Funções de Ajuste Aprimoradas
  const renderStepper = (parent, label, axis, targetKey, step) => {
    const val = cfg[targetKey][axis];
    const displayVal = axis === 's' || axis === 'o' ? val.toFixed(2) : Math.round(val);
    const html = `
      <div class="stepper-control">
        <span class="stepper-label">${label}</span>
        <button class="stepper-btn" onclick="window.adjust('${axis}', -${step}, '${targetKey}')">-</button>
        <div class="stepper-input" style="display:flex; align-items:center; justify-content:center;">${displayVal}</div>
        <button class="stepper-btn" onclick="window.adjust('${axis}', ${step}, '${targetKey}')">+</button>
      </div>
    `;
    parent.insertAdjacentHTML('beforeend', html);
  };

  const renderSlider = (parent, label, axis, targetKey, min, max, step) => {
    const val = cfg[targetKey][axis];
    const html = `
      <div class="slider-control">
        <div class="slider-label-group">
          <span class="slider-label">${label}</span>
          <span class="slider-value-display">${val.toFixed(2)}</span>
        </div>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${val}" class="range-slider" 
               oninput="window.adjust('${axis}', parseFloat(this.value), '${targetKey}', true)">
      </div>
    `;
    parent.insertAdjacentHTML('beforeend', html);
  };

  window.updateAdjustUI = () => {
    const setupContainer = document.getElementById("setupAdjusts");
    const trainContainer = document.getElementById("trainAdjusts");
    const cardsContainer = document.getElementById("cardsAdjusts");
    const opacityContainer = document.getElementById("opacitySlider");

    if (setupContainer) setupContainer.innerHTML = "";
    if (trainContainer) trainContainer.innerHTML = "";
    if (cardsContainer) cardsContainer.innerHTML = "";
    if (opacityContainer) opacityContainer.innerHTML = "";

    const currentContainer = mode === 'setup' ? setupContainer : (mode === 'train' ? trainContainer : cardsContainer);
    if (!currentContainer) return;

    const targetKey = (mode === 'train' && adjustMode === 'number') ? 'number' : adjTarget;
    let target = cfg[targetKey];
    if (!target) return;

    // Se estiver no modo treino ajustando o número, tenta pegar o ajuste individual
    if (targetKey === 'number' && mode === 'train') {
      const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
      if (g?.cfg) target = g.cfg;
    }

    if (targetKey === 'number') {
      renderStepper(currentContainer, 'Posição X', 'x', targetKey, 1);
      renderStepper(currentContainer, 'Posição Y', 'y', targetKey, 1);
      renderStepper(currentContainer, 'Escala', 's', targetKey, 1);
    } else {
      renderStepper(currentContainer, 'Posição X', 'x', targetKey, 1);
      renderStepper(currentContainer, 'Posição Y', 'y', targetKey, 1);
      const sStep = targetKey.startsWith('panel') || targetKey === 'toolbar' ? 0.05 : 1;
      renderStepper(currentContainer, targetKey.startsWith('panel') ? 'Escala' : 'Tamanho', 's', targetKey, sStep);
    }

    if (opacityContainer && (adjTarget === 'visor' || adjTarget === 'footer' || adjTarget.startsWith('panel'))) {
      const val = cfg[adjTarget].o || 0.5;
      const displayVal = Math.round(val * 100);
      const html = `
        <div class="stepper-control">
          <span class="stepper-label">Opacidade (%)</span>
          <button class="stepper-btn" onclick="window.adjust('o', -0.05, '${adjTarget}')">-</button>
          <div class="stepper-input" style="display:flex; align-items:center; justify-content:center;">${displayVal}</div>
          <button class="stepper-btn" onclick="window.adjust('o', 0.05, '${adjTarget}')">+</button>
        </div>
      `;
      opacityContainer.innerHTML = html;
    }
  };

  window.adjust = (axis, val, targetKey = adjTarget, isSlider = false) => {
    if (mode === 'train' && adjustMode === 'number') targetKey = 'number';
    let target = cfg[targetKey]; if (!target) return;

    // Se estiver no modo treino ajustando o número, usa/cria o ajuste individual
    let isIndividual = false;
    if (targetKey === 'number' && mode === 'train') {
      const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
      target = g?.cfg || JSON.parse(JSON.stringify(cfg.number)); // Herda do global se não existir
      isIndividual = true;
    }

    if (isSlider) {
      target[axis] = val;
    } else {
      if (axis === "x") target.x += val;
      else if (axis === "y") target.y += val;
      else if (axis === "s") {
        if (targetKey === "toolbar" || targetKey.startsWith("panel")) target.s = Math.max(0.5, Math.min(2.0, target.s + val));
        else if (targetKey === "number") { 
          const oldS = target.s;
          target.s += val;
          // Ajuste proporcional da altura (h) baseado na nova escala (s)
          if (oldS > 0) target.h = target.h * (target.s / oldS);
        }
        else if (targetKey === "visor" || targetKey === "footer") { cfg.visor.s = Math.max(5, cfg.visor.s + val); cfg.footer.s = cfg.visor.s; }
        else target.s += val;
      }
      else if (axis === "h" && targetKey === "number") { target.h += val; }
      else if (axis === "o") {
        const newVal = Math.max(0.05, Math.min(1.0, (target.o || 0.5) + val));
        if (targetKey === "visor" || targetKey === "footer") { cfg.visor.o = newVal; cfg.footer.o = newVal; }
        else target.o = newVal;
      }
    }

    if (isIndividual) {
      const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || JSON.stringify({ s: [] }));
      g.cfg = target;
      localStorage.setItem(`v6_g_${trainNum}`, JSON.stringify(g));
    } else if (targetKey === 'number') {
      cfg.number = target;
    }

    applyCfg();
    updateAdjustUI();
    if (mode === "train") loadTrain(trainNum);
  };

  window.adjustDirect = (axis, inputVal, targetKey = adjTarget) => {
    if (mode === 'train' && adjustMode === 'number') targetKey = 'number';
    let target = cfg[targetKey]; if (!target) return;
    const val = parseFloat(inputVal);
    if (isNaN(val)) return;

    // Se estiver no modo treino ajustando o número, usa/cria o ajuste individual
    let isIndividual = false;
    if (targetKey === 'number' && mode === 'train') {
      const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
      target = g?.cfg || JSON.parse(JSON.stringify(cfg.number)); // Herda do global se não existir
      isIndividual = true;
    }

    if (axis === "x" || axis === "y") {
      target[axis] = val;
    } else if (axis === "s") {
      if (targetKey === "toolbar" || targetKey.startsWith("panel")) {
        target.s = Math.max(0.5, Math.min(2.0, val));
      } else if (targetKey === "number") {
        const oldS = target.s;
        target.s = val;
        if (oldS > 0) target.h = target.h * (target.s / oldS);
      } else if (targetKey === "visor" || targetKey === "footer") {
        cfg.visor.s = Math.max(5, val);
        cfg.footer.s = cfg.visor.s;
      } else {
        target.s = val;
      }
    } else if (axis === "h" && targetKey === "number") {
      target.h = val;
    } else if (axis === "o") {
      const newVal = Math.max(0.05, Math.min(1.0, val));
      if (targetKey === "visor" || targetKey === "footer") {
        cfg.visor.o = newVal;
        cfg.footer.o = newVal;
      } else {
        target.o = newVal;
      }
    }

    if (isIndividual) {
      const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || JSON.stringify({ s: [] }));
      g.cfg = target;
      localStorage.setItem(`v6_g_${trainNum}`, JSON.stringify(g));
    } else if (targetKey === 'number') {
      cfg.number = target;
    }

    applyCfg();
    updateAdjustUI();
    if (mode === "train") loadTrain(trainNum);
  };

  window.toggleEmoji = () => { cfg.visor.useEmoji = !cfg.visor.useEmoji; applyCfg(); };
  window.togglePeekStyle = () => { cfg.visor.peekStyle = cfg.visor.peekStyle === "both" ? "cardOnly" : "both"; applyCfg(); };
  window.toggleInvertOrder = () => { cfg.visor.inverted = !cfg.visor.inverted; applyCfg(); };
  cfg.peekDuration = 1.0;

  window.editTargetText = () => {
    const target = cfg[adjTarget]; if (!target || adjTarget !== "footer") return;
    const n = prompt(`Novo conteúdo para ${target.label}:`, target.text);
    if (n !== null) { target.text = n; applyCfg(); }
  };

  window.openTrainPanel = () => { window.setTarget('panelTrain'); closeOtherPanels(); mode = "train"; trainPanel.classList.remove("hidden"); loadTrain(trainNum || 1); window.setAdjustMode('panel'); applyCfg(); };
  window.toggleTrain = () => { mode = "draw"; trainPanel.classList.add("hidden"); applyCfg(); render(); };
  window.setAdjustMode = (m) => {
    adjustMode = m;
    document.getElementById("modeNumBtn").classList.toggle("active", m === 'number');
    document.getElementById("modePanelBtn").classList.toggle("active", m === 'panel');
    updateAdjustUI();
  };

  const loadTrain = (n) => { 
    trainNum = Math.max(1, Math.min(52, n)); trainNumEl.textContent = trainNum; strokes = []; 
    const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
    
    // Prioridade: Ajuste individual do número (g.cfg) ou ajuste global (cfg.number)
    const nCfg = g?.cfg || cfg.number;
    const rx = nCfg.x * W / 100, ry = nCfg.y * H / 100;
    const rw = nCfg.s * W / 100, rh = nCfg.h * H / 100;
    
    if (g?.s) g.s.forEach(s => strokes.push({ c: "#111111", p: s.p.map(p => ({ x: rx + p.x * rw, y: ry + p.y * rh })) }));
    render(); 
  };
  window.trainStep = (d) => loadTrain(trainNum + d);
  window.trainSave = () => {
    const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
    const nCfg = g?.cfg || cfg.number;
    const rx = nCfg.x * W / 100, ry = nCfg.y * H / 100;
    const rw = nCfg.s * W / 100, rh = nCfg.h * H / 100;
    const s = strokes.map(st => ({ p: st.p.map(p => ({ x: (p.x - rx)/rw, y: (p.y - ry)/rh })) }));
    if (s.length > 0) { 
      const newData = { s };
      if (g?.cfg) newData.cfg = g.cfg; // Preserva o ajuste individual ao salvar o desenho
      localStorage.setItem(`v6_g_${trainNum}`, JSON.stringify(newData)); 
      if (trainNum < 52) window.trainStep(1); else alert("Salvo!"); 
    }
  };

  window.exportGlyphs = () => {
    const backup = { cfg: cfg, glyphs: {} };
    for (let i = 1; i <= 52; i++) { const g = localStorage.getItem(`v6_g_${i}`); if (g) backup.glyphs[i] = JSON.parse(g); }
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `sethi_draw_backup_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  };

  window.importGlyphs = (event) => {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.cfg && data.glyphs) {
          cfg = data.cfg; ensureCfg(); localStorage.setItem("mnem_v6_cfg", JSON.stringify(cfg));
          Object.keys(data.glyphs).forEach(k => localStorage.setItem(`v6_g_${k}`, JSON.stringify(data.glyphs[k])));
          applyCfg();
        } else Object.keys(data).forEach(k => localStorage.setItem(`v6_g_${k}`, JSON.stringify(data[k])));
        alert("Importado!"); if (mode === "train") loadTrain(trainNum); render();
      } catch (err) { alert("Erro!"); }
    };
    reader.readAsText(file);
  };

  const initBlueButtonPeek = () => {
    const blueBtn = document.querySelector('.swatch[data-color="#007AFF"]');
    if (!blueBtn) return;
    let holdTimer = null;
    const startBluePeek = (e) => {
      if (e.cancelable) e.preventDefault();
      holdTimer = setTimeout(() => { blueBtn.dataset.isHolding = "true"; if (mode === "draw") { visor.style.opacity = cfg.visor.o; visorL1.textContent = lastResult || getExamplePeek(); } }, 150);
    };
    const stopBluePeek = (e) => {
      clearTimeout(holdTimer);
      if (blueBtn.dataset.isHolding === "true") { setTimeout(() => { blueBtn.dataset.isHolding = "false"; }, 50); if (mode === "draw") { visor.style.opacity = 0; setTimeout(() => { if (mode === "draw") visorL1.textContent = cfg.visor.text; }, 300); } }
    };
    blueBtn.addEventListener("mousedown", startBluePeek); window.addEventListener("mouseup", stopBluePeek);
    blueBtn.addEventListener("touchstart", startBluePeek, { passive: true }); window.addEventListener("touchend", stopBluePeek, { passive: true });
  };

  // Cria o botão flutuante dinamicamente
  const createFloatingEyeBtn = () => {
    floatingEyeBtn = document.createElement("div");
    floatingEyeBtn.id = "floatingEyeBtn";
    // Ícone de olho
    floatingEyeBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    document.body.appendChild(floatingEyeBtn);

    // Posição inicial padrão
    let floatX = W - 70;
    let floatY = 100;
    floatingEyeBtn.style.left = floatX + "px";
    floatingEyeBtn.style.top = floatY + "px";

    // Lógica de Arrastar do Botão Flutuante
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    floatingEyeBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      isDragging = false;
      floatingEyeBtn.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(floatingEyeBtn.style.left);
      initialTop = parseFloat(floatingEyeBtn.style.top);
    });

    floatingEyeBtn.addEventListener("pointermove", (e) => {
      if (e.buttons === 0) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) isDragging = true;
      
      floatingEyeBtn.style.left = (initialLeft + dx) + "px";
      floatingEyeBtn.style.top = (initialTop + dy) + "px";
    });

    floatingEyeBtn.addEventListener("pointerup", (e) => {
      floatingEyeBtn.releasePointerCapture(e.pointerId);
      if (!isDragging) {
        restorePanel();
      }
    });
  };

  const restorePanel = () => {
    if (minimizedPanelId) {
      const panel = document.getElementById(minimizedPanelId);
      if (panel) panel.classList.remove("hidden");
      floatingEyeBtn.style.display = "none";
      minimizedPanelId = null;
    }
  };

  const initEyeButton = (btnId, panelId) => {
    const btn = document.getElementById(btnId); const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    
    // Remove listeners antigos
    btn.onpointerdown = null; btn.onpointerup = null; btn.onpointercancel = null;
    
    // Novo comportamento: Clique para minimizar
    btn.onclick = (e) => {
      e.stopPropagation();
      panel.classList.add("hidden");
      minimizedPanelId = panelId;
      if (floatingEyeBtn) floatingEyeBtn.style.display = "flex";
    };
  };

  init();
})();
