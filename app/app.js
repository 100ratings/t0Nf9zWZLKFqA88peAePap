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
  const peekDurationDisplay = document.getElementById("peekDurationDisplay");

  let W = window.innerWidth, H = window.innerHeight, DPR = window.devicePixelRatio || 1;

  let mode = "draw"; 
  let color = "#111111";
  let strokes = [];
  let currentStroke = null;
  let swipeData = { start: null, arrows: [] };
  let cardInputData = { rank: "", suit: "", digits: "" };
  
  let tapCounts = { red: 0, yellow: 0 };
  let lastTapTimes = { red: 0, yellow: 0 };
  
  let trainNum = 1;
  let adjTarget = "visor";
  let lastResult = ""; 
  let adjustMode = "number";
  let isCardsAdjustMode = false;
  let peekTimer = null;

  let cfg = JSON.parse(localStorage.getItem("mnem_v6_cfg") || JSON.stringify({
    visor: { x: 50, y: 80, s: 15, lh: 1.1, y2: 0, text: "…", label: "Peek Principal", inverted: false, useEmoji: false, o: 0.3 },
    number: { x: 12.5, y: 34, s: 75, h: 41, label: "Número" },
    footer: { x: 50, y: 90, s: 10, o: 0.3, text: "Sethi Draw v.1.0.2 (1.4.2814)", label: "Peek de Apoio" },
    peek: { x: 50, y: 82, s: 15, text: "", label: "Peek" },
    toolbar: { x: 50, y: 50, s: 1, label: "Barra de Ferramentas" },
    panelSetup: { x: 50, y: 30, s: 1, o: 0.6, label: "Painel de Configurações" },
    panelTrain: { x: 50, y: 30, s: 1, o: 0.6, label: "Desenhos de Números" },
    panelCards: { x: 50, y: 30, s: 1, o: 0.6, label: "Painel de Cartas" },
    inputType: "swipe",
    peekDuration: 1.0
  }));

  const ensureCfg = () => {
    Object.keys(cfg).forEach(k => { if (cfg[k] && typeof cfg[k] === 'object' && cfg[k].visible === undefined) cfg[k].visible = true; });
    if (cfg.visor.useEmoji === undefined) cfg.visor.useEmoji = false;
    if (cfg.visor.o === undefined) cfg.visor.o = 0.3;
    if (cfg.footer.o === undefined) cfg.footer.o = 0.3;
    if (cfg.inputType === undefined) cfg.inputType = "swipe";
    cfg.peekDuration = 1.0;
    if (!cfg.panelSetup) cfg.panelSetup = { x: 50, y: 30, s: 1, o: 0.6, label: "Painel de Configurações" };
    if (!cfg.panelTrain) cfg.panelTrain = { x: 50, y: 30, s: 1, o: 0.6, label: "Desenhos de Números" };
    if (!cfg.panelCards) cfg.panelCards = { x: 50, y: 30, s: 1, o: 0.6, label: "Painel de Cartas" };
    
    cfg.visor.label = "Peek Principal";
    cfg.footer.label = "Peek de Apoio";
    cfg.toolbar.label = "Barra de Ferramentas";
    cfg.panelSetup.label = "Painel de Configurações";
    cfg.panelTrain.label = "Desenhos de Números";
    cfg.panelCards.label = "Painel de Cartas";
  };
  ensureCfg();

  const STACK = ["4C","2H","7D","3C","4H","6D","AS","5H","9S","2S","QH","3D","QC","8H","6S","5S","9H","KC","2D","JH","3S","8S","6H","10C","5D","KD","2C","3H","8D","5C","KS","JD","8C","10S","KH","JC","7S","10H","AD","4S","7H","4D","AC","9C","JS","QD","7C","QS","10D","6C","AH","9D"];
  const posMap = {}; STACK.forEach((c, i) => posMap[c] = i + 1);

  const init = () => {
    window.addEventListener('resize', onResize);
    onResize();
    bindEvents();
    initEyeButton("eyeBtn", "setupPanel");
    initEyeButton("eyeBtnTrain", "trainPanel");
    initBlueButtonPeek();
    checkOrientation();
    window.addEventListener('orientationchange', checkOrientation);
  };

  const checkOrientation = () => {
    const warning = document.getElementById("orientationWarning");
    if (window.innerWidth > window.innerHeight) { warning.classList.remove("hidden"); }
    else { warning.classList.add("hidden"); }
  };

  const onResize = () => {
    // Pequeno delay para garantir que o navegador atualizou as dimensões reais (especialmente no iOS)
    setTimeout(() => {
      W = window.innerWidth; 
      H = window.innerHeight; 
      DPR = window.devicePixelRatio || 1;
      
      board.width = W * DPR; 
      board.height = H * DPR;
      board.style.width = W + "px"; 
      board.style.height = H + "px";
      
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      applyCfg(); 
      render(); 
      checkOrientation();
    }, 100);
  };

  const getExamplePeek = () => {
    const cardStr = cfg.visor.useEmoji ? "3♥️" : "3H";
    const numStr = "14";
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
    } else if (mode === "draw") {
      visor.style.opacity = 0;
      visorL1.textContent = cfg.visor.text;
    } else {
      visor.style.opacity = cfg.visor.o;
    }
    
    footer.style.display = cfg.footer.visible ? "block" : "none";
    footer.style.left = (cfg.footer.x * W / 100) + "px";
    footer.style.top = (cfg.footer.y * H / 100) + "px";
    footer.style.fontSize = cfg.footer.s + "px";
    footer.style.opacity = cfg.footer.o;
    if (mode !== "swipe") footer.textContent = cfg.footer.text;

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
    document.getElementById("inputCardsBtn").classList.toggle("active", cfg.inputType === "cards");
    document.getElementById("invertOrderBtn").textContent = cfg.visor.inverted ? "Ordem: 05 4H → 4H 05" : "Ordem: 4H 05 → 05 4H";
    const peekPreview = document.getElementById("peekPreview");
    if (peekPreview) peekPreview.textContent = getExamplePeek();

    document.querySelectorAll(".setup-btn-target").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.target === adjTarget);
    });

    localStorage.setItem("mnem_v6_cfg", JSON.stringify(cfg));
  };

  const bindEvents = () => {
    document.querySelectorAll(".swatch").forEach(s => {
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
        if (c === "#F7C600") updateTap('yellow', 5, toggleSetup);
      };
    });

    document.getElementById("undoBtn").onclick = (e) => { e.stopPropagation(); strokes.pop(); render(); };
    document.getElementById("clearBtn").onclick = (e) => { e.stopPropagation(); strokes = []; render(); };

    window.onpointerdown = (e) => {
      if (e.target.closest("#toolbar") || e.target.closest(".panel") || e.target.closest("#activationScreen") || e.target.closest("#installScreen") || e.target.closest("#orientationWarning")) return;
      const p = getPt(e); e.preventDefault();
      if (mode === "swipe") { swipeData.start = p; return; }
      if (mode === "train") {
        const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
        const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
        // Aumentar a margem de detecção em 20px para facilitar o desenho em telas pequenas
        const margin = 20;
        if (p.x < rx - margin || p.x > rx + rw + margin || p.y < ry - margin || p.y > ry + rh + margin) return;
      }
      currentStroke = { c: mode === "train" ? "#111111" : color, p: [p] };
    };

    window.onpointermove = (e) => {
      if (!currentStroke) return;
      const p = getPt(e); e.preventDefault();
      currentStroke.p.push(p);
      drawSeg(currentStroke.p[currentStroke.p.length-2], p, currentStroke.c);
    };

    window.onpointerup = (e) => {
      if (mode === "swipe" && swipeData.start) {
        const arrow = getArrow(swipeData.start, getPt(e));
        swipeData.start = null;
        if (arrow) { swipeData.arrows.push(arrow); updateVisorProgress(); visor.style.opacity = cfg.visor.o; if (swipeData.arrows.length === 7) resolveSwipe(); }
      }
      if (currentStroke) { strokes.push(currentStroke); currentStroke = null; render(); }
    };
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
    if (!card) return "";
    if (!cfg.visor.useEmoji) return card;
    const rank = card.slice(0, -1); const suit = card.slice(-1);
    const emoji = {"S":"♠️","H":"♥️","C":"♣️","D":"♦️"}[suit] || suit;
    return rank + emoji;
  };

  const updateVisorProgress = () => {
    const arr = swipeData.arrows; const len = arr.length; let content = arr.join("");
    if (len >= 3) {
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      const card = (rank && suit) ? formatCard(rank+suit) : "??";
      if (len === 3) content = card;
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
    const dec = {"↑↑":0,"↑→":10,"→↑":20,"→→":30,"→↓":40,"↓→":50}[arr[3]+arr[4]];
    const unt = {"↑↑":0,"↑→":1,"→↑":2,"→→":3,"→↓":4,"↓→":5,"↓↓":6,"↓←":7,"←↓":8,"←←":"9"}[arr[5]+arr[6]];
    const num = (dec !== undefined && unt !== undefined) ? parseInt(dec) + parseInt(unt) : 0;
    processResult(card, num);
    
    clearTimeout(peekTimer);
    peekTimer = setTimeout(() => { 
      if (mode !== "setup" && mode !== "cards" && mode !== "train") { visor.style.opacity = 0; setTimeout(() => { if (mode === "draw") visorL1.textContent = cfg.visor.text; }, 300); }
      swipeData.arrows = []; if (mode === "swipe") mode = "draw"; 
    }, cfg.peekDuration * 1000);
  };

  const processResult = (card, num) => {
    if (!card || num < 1 || num > 52) { visorL1.textContent = "ERRO"; lastResult = "ERRO"; }
    else {
      const pos = posMap[card]; const cut = ((pos - num % 52) + 52) % 52; const cutNum = (cut === 0 ? 52 : cut);
      const cardStr = formatCard(STACK[cutNum-1]); const numStr = cutNum.toString().padStart(2, '0');
      const peekResult = cfg.visor.inverted ? `${numStr} ${cardStr}` : `${cardStr} ${numStr}`;
      visorL1.textContent = peekResult; lastResult = peekResult;
      const ZZ_raw = cutNum.toString().padStart(2, '0'); const ZZ = ZZ_raw[0] + "." + ZZ_raw[1]; 
      const XX = pos.toString().padStart(2, '0'); const YY = num.toString().padStart(2, '0'); 
      footer.textContent = `Sethi Draw v.1.0.2 (${ZZ}.${XX}${YY})`; stamp(num);
    }
  };

  const stamp = (n) => {
    const numKey = parseInt(n); const g = JSON.parse(localStorage.getItem(`v6_g_${numKey}`) || "null");
    const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
    const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
    if (g?.s) g.s.forEach(s => strokes.push({ c: "#111111", p: s.p.map(p => ({ x: rx + p.x * rw, y: ry + p.y * rh })) }));
    else { ctx.save(); ctx.font = "bold 50px sans-serif"; ctx.fillText(n, rx + 20, ry + 60); ctx.restore(); }
    render();
  };

  window.toggleSetup = () => {
    if (mode === "setup") { mode = "draw"; setupPanel.classList.add("hidden"); visor.style.opacity = 0; applyCfg(); }
    else { closeOtherPanels(); mode = "setup"; setupPanel.classList.remove("hidden"); applyCfg(); }
  };

  const toggleSwipe = () => {
    if (mode === "swipe") { mode = "draw"; visor.style.opacity = 0; }
    else { closeOtherPanels(); mode = "swipe"; visor.style.opacity = cfg.visor.o; visorL1.textContent = "."; }
    swipeData.arrows = [];
  };

  window.toggleCards = (isAdjust = false) => {
    if (mode === "cards") { mode = "draw"; cardsPanel.classList.add("hidden"); if (lastResult) { visor.style.opacity = cfg.visor.o; clearTimeout(peekTimer); peekTimer = setTimeout(() => { if (mode === "draw") visor.style.opacity = 0; }, cfg.peekDuration * 1000); } else { visor.style.opacity = 0; } isCardsAdjustMode = false; }
    else { 
      closeOtherPanels(); mode = "cards"; cardsPanel.classList.remove("hidden"); 
      isCardsAdjustMode = isAdjust;
      cardsAdjustControls.classList.toggle("hidden", !isAdjust);
      visor.style.opacity = cfg.visor.o; visorL1.textContent = lastResult || getExamplePeek(); resetCardInput(); 
    }
  };

  window.openCardsAdjust = () => { window.setTarget('panelCards'); window.toggleCards(true); };

  const closeOtherPanels = () => {
    setupPanel.classList.add("hidden"); trainPanel.classList.add("hidden"); cardsPanel.classList.add("hidden");
    if (mode === "swipe") mode = "draw";
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
    applyCfg();
  };

  window.setInputType = (type) => { cfg.inputType = type; applyCfg(); };

  window.adjust = (axis, val) => {
    const target = cfg[adjTarget]; if (!target) return;
    const pctX = (val / W) * 100, pctY = (val / H) * 100;
    if (axis === "x") target.x += pctX * 2;
    if (axis === "y") target.y += pctY * 2;
    if (axis === "s") {
      if (adjTarget === "toolbar" || adjTarget.startsWith("panel")) target.s = Math.max(0.5, Math.min(2.0, target.s + val * 0.01));
      else if (adjTarget === "number") { target.s += pctX * 2; target.h += pctY * 2; }
      else if (adjTarget === "visor" || adjTarget === "footer") { cfg.visor.s += val * 0.5; cfg.footer.s = cfg.visor.s; }
      else target.s += val * 0.5;
    }
    if (axis === "o") {
      const newVal = Math.max(0.05, Math.min(1.0, (target.o || 0.5) + val));
      if (adjTarget === "visor" || adjTarget === "footer") { cfg.visor.o = newVal; cfg.footer.o = newVal; }
      else target.o = newVal;
    }
    applyCfg();
  };

  window.toggleEmoji = () => { cfg.visor.useEmoji = !cfg.visor.useEmoji; applyCfg(); };
  window.toggleInvertOrder = () => { cfg.visor.inverted = !cfg.visor.inverted; applyCfg(); };
  // Duração fixada em 1.0s conforme solicitado
  cfg.peekDuration = 1.0;

  window.editTargetText = () => {
    const target = cfg[adjTarget]; if (!target || adjTarget !== "footer") return;
    const n = prompt(`Novo conteúdo para ${target.label}:`, target.text);
    if (n !== null) { target.text = n; applyCfg(); }
  };

  window.openTrainPanel = () => { window.setTarget('panelTrain'); closeOtherPanels(); mode = "train"; trainPanel.classList.remove("hidden"); loadTrain(trainNum || 1); applyCfg(); };
  window.toggleTrain = () => { 
    mode = "draw"; 
    strokes = []; // Limpa os desenhos temporários ao sair
    trainPanel.classList.add("hidden"); 
    applyCfg(); 
    render(); 
  };
  window.setAdjustMode = (m) => {
    adjustMode = m;
    document.getElementById("modeNumBtn").classList.toggle("active", m === 'number');
    document.getElementById("modePanelBtn").classList.toggle("active", m === 'panel');
  };
  window.handleAdjust = (axis, val) => { if (adjustMode === 'number') window.adjustNumber(axis, val); else { adjTarget = "panelTrain"; window.adjust(axis, val); } };
  window.adjustNumber = (axis, val) => {
    const target = cfg.number; const pctX = (val / W) * 100, pctY = (val / H) * 100;
    if (axis === "x") target.x += pctX * 2; if (axis === "y") target.y += pctY * 2;
    if (axis === "s") { target.s += pctX * 2; target.h += pctY * 2; }
    applyCfg(); if (mode === "train") loadTrain(trainNum);
  };

  const loadTrain = (n) => { 
    trainNum = Math.max(1, Math.min(52, n)); trainNumEl.textContent = trainNum; strokes = []; 
    const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
    const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
    const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
    if (g?.s) g.s.forEach(s => strokes.push({ c: "#111111", p: s.p.map(p => ({ x: rx + p.x * rw, y: ry + p.y * rh })) }));
    render(); 
  };
  window.trainStep = (d) => loadTrain(trainNum + d);
  window.trainSave = () => {
    const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
    const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
    const s = strokes.map(st => ({ p: st.p.map(p => ({ x: (p.x - rx)/rw, y: (p.y - ry)/rh })) }));
    if (s.length > 0) { localStorage.setItem(`v6_g_${trainNum}`, JSON.stringify({ s })); if (trainNum < 52) window.trainStep(1); else alert("Salvo!"); }
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
      holdTimer = setTimeout(() => { blueBtn.dataset.isHolding = "true"; if (mode === "draw") { visor.style.opacity = cfg.visor.o; visorL1.textContent = lastResult || getExamplePeek(); } }, 200);
    };
    const stopBluePeek = (e) => {
      clearTimeout(holdTimer);
      if (blueBtn.dataset.isHolding === "true") { setTimeout(() => { blueBtn.dataset.isHolding = "false"; }, 50); if (mode === "draw") { visor.style.opacity = 0; setTimeout(() => { if (mode === "draw") visorL1.textContent = cfg.visor.text; }, 300); } }
    };
    blueBtn.addEventListener("mousedown", startBluePeek); window.addEventListener("mouseup", stopBluePeek);
    blueBtn.addEventListener("touchstart", startBluePeek, { passive: true }); window.addEventListener("touchend", stopBluePeek, { passive: true });
  };

  const initEyeButton = (btnId, panelId) => {
    const btn = document.getElementById(btnId); const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    const startPeek = () => panel.classList.add("transparent-peek"); const stopPeek = () => panel.classList.remove("transparent-peek");
    btn.addEventListener("mousedown", startPeek); window.addEventListener("mouseup", stopPeek);
    btn.addEventListener("touchstart", startPeek, { passive: true }); btn.addEventListener("touchend", stopPeek, { passive: true });
  };

  init();
})();
