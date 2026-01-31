(() => {
  const board = document.getElementById("board");
  const ctx = board?.getContext("2d", { alpha: true });
  const visor = document.getElementById("visor");
  const visorL1 = document.getElementById("visorLine1");
  const footer = document.getElementById("footer");
  const setupPanel = document.getElementById("setupPanel");
  const trainPanel = document.getElementById("trainPanel");
  const trainNumEl = document.getElementById("trainNumDisplay");

  let W = window.innerWidth, H = window.innerHeight, DPR = window.devicePixelRatio || 1;

  let mode = "draw"; 
  let color = "#111111";
  let strokes = [];
  let currentStroke = null;
  let swipeData = { start: null, arrows: [] };
  
  let tapCounts = { red: 0, green: 0, yellow: 0 };
  let lastTapTimes = { red: 0, green: 0, yellow: 0 };
  
  let trainNum = 1;
  let adjTarget = "visor";
  let lastResult = ""; 

  let cfg = JSON.parse(localStorage.getItem("mnem_v6_cfg") || JSON.stringify({
    visor: { x: 50, y: 80, s: 15, lh: 1.1, y2: 0, text: "…", label: "Peek 1", inverted: false },
    number: { x: 12.5, y: 34, s: 75, h: 41, label: "Número" },
    footer: { x: 50, y: 90, s: 10, o: 0.3, text: "Sethi Draw v.1.0.2 (1.4.2814)", label: "Peek 2" },
    peek: { x: 50, y: 82, s: 15, text: "", label: "Peek" },
    toolbar: { x: 50, y: 50, s: 1, label: "Toolbar" },
    panelSetup: { x: 50, y: 30, s: 1, o: 0.6, label: "Painel Setup" },
    panelTrain: { x: 50, y: 30, s: 1, o: 0.98, label: "Painel Treino" }
  }));
  // Garantir propriedades de visibilidade
  Object.keys(cfg).forEach(k => { if (cfg[k].visible === undefined) cfg[k].visible = true; });
  if (cfg.visor.lh === undefined) cfg.visor.lh = 1.1;
  if (cfg.visor.y2 === undefined) cfg.visor.y2 = 0;
  if (!cfg.footer) cfg.footer = { x: 214, y: 780, s: 10, o: 0.3, text: "Sethi Draw v.1.0.2 (1.4.2814)" };
  if (cfg.footer.o === undefined) cfg.footer.o = 0.3;
  if (!cfg.peek) cfg.peek = { x: 214, y: 720, s: 15, text: "" };
  if (!cfg.toolbar) cfg.toolbar = { x: 50, y: 50, s: 1, label: "Toolbar" };
  // Garantir que todos tenham labels atualizados
  if (!cfg.visor.label || cfg.visor.label === "Visor") cfg.visor.label = "Peek 1";
  if (cfg.visor.inverted === undefined) cfg.visor.inverted = false;
  if (!cfg.footer.label || cfg.footer.label === "Rodapé") cfg.footer.label = "Peek 2";
  if (!cfg.number.label) cfg.number.label = "Número";
  if (!cfg.peek.label) cfg.peek.label = "Peek";
  if (!cfg.toolbar.label) cfg.toolbar.label = "Toolbar";
  if (!cfg.panelSetup) cfg.panelSetup = { x: 50, y: 30, s: 1, o: 0.6, label: "Painel Setup" };
  if (!cfg.panelTrain) cfg.panelTrain = { x: 50, y: 30, s: 1, o: 0.98, label: "Painel Treino" };

  const STACK = ["4C","2H","7D","3C","4H","6D","AS","5H","9S","2S","QH","3D","QC","8H","6S","5S","9H","KC","2D","JH","3S","8S","6H","10C","5D","KD","2C","3H","8D","5C","KS","JD","8C","10S","KH","JC","7S","10H","AD","4S","7H","4D","AC","9C","JS","QD","7C","QS","10D","6C","AH","9D"];
  const posMap = {}; STACK.forEach((c, i) => posMap[c] = i + 1);

  const init = () => {
    window.addEventListener('resize', onResize);
    onResize();
    bindEvents();
  };

  const onResize = () => {
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
  };

  const applyCfg = () => {
    visor.style.display = cfg.visor.visible ? "block" : "none";
    visor.style.left = (cfg.visor.x * W / 100) + "px";
    visor.style.top = (cfg.visor.y * H / 100) + "px";
    visor.style.fontSize = cfg.visor.s + "px";
    visor.style.lineHeight = cfg.visor.lh;
    
    visor.style.color = "#000000";
    
    if (mode === "draw") {
      visorL1.textContent = cfg.visor.text;
      visor.style.opacity = 0;
    } else {
      visor.style.opacity = cfg.footer.o;
    }
    
    footer.style.display = cfg.footer.visible ? "block" : "none";
    footer.style.left = (cfg.footer.x * W / 100) + "px";
    footer.style.top = (cfg.footer.y * H / 100) + "px";
    footer.style.fontSize = cfg.footer.s + "px";
    footer.style.opacity = cfg.footer.o;
    footer.textContent = cfg.footer.text;

    if (mode === "setup" && adjTarget === "peek") {
      visorL1.textContent = "PEEK PREVIEW";
      visor.style.opacity = cfg.footer.o;
    }

    const tb = document.getElementById("toolbar");
    if (tb) {
      tb.style.display = cfg.toolbar.visible ? "flex" : "none";
      tb.style.left = (cfg.toolbar.x * W / 100) + "px";
      tb.style.top = (cfg.toolbar.y * H / 100) + "px";
      tb.style.transform = `translateX(-50%) scale(${cfg.toolbar.s})`;
    }

    // Estilo dinâmico dos painéis
    const ps = document.getElementById("setupPanel");
    if (ps) {
      ps.style.left = (cfg.panelSetup.x * W / 100) + "px";
      ps.style.top = (cfg.panelSetup.y * H / 100) + "px";
      ps.style.transform = `translateX(-50%) scale(${cfg.panelSetup.s})`;
      ps.style.background = `rgba(255, 255, 255, ${cfg.panelSetup.o})`;
    }
    const pt = document.getElementById("trainPanel");
    if (pt) {
      pt.style.left = (cfg.panelTrain.x * W / 100) + "px";
      pt.style.top = (cfg.panelTrain.y * H / 100) + "px";
      pt.style.transform = `translateX(-50%) scale(${cfg.panelTrain.s})`;
      pt.style.background = `rgba(255, 255, 255, ${cfg.panelTrain.o})`;
    }

    localStorage.setItem("mnem_v6_cfg", JSON.stringify(cfg));
  };

  const bindEvents = () => {
    document.querySelectorAll(".swatch").forEach(s => {
      s.onclick = (e) => {
        e.stopPropagation();
        const now = Date.now();
        const c = s.dataset.color;
        document.querySelectorAll(".swatch").forEach(b => b.classList.remove("active"));
        s.classList.add("active");
        color = c;

        const updateTap = (key, limit, action) => {
          if (now - lastTapTimes[key] < 500) {
            tapCounts[key]++;
          } else {
            tapCounts[key] = 1;
          }
          lastTapTimes[key] = now;
          if (tapCounts[key] >= limit) {
            action();
            tapCounts[key] = 0;
          }
        };

        if (c === "#FF3B30") updateTap('red', 1, toggleSwipe);
        if (c === "#2FD36B") updateTap('green', 5, toggleTrain);
        if (c === "#F7C600") updateTap('yellow', 5, toggleSetup);
      };
    });

    document.getElementById("undoBtn").onclick = (e) => { e.stopPropagation(); strokes.pop(); render(); };
    document.getElementById("clearBtn").onclick = (e) => { e.stopPropagation(); strokes = []; render(); };

    window.onpointerdown = (e) => {
      if (e.target.closest("#toolbar") || e.target.closest(".panel")) return;
      const p = getPt(e); e.preventDefault();
      if (mode === "swipe") { swipeData.start = p; return; }
      if (mode === "train") {
        const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
        const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
        if (p.x < rx || p.x > rx + rw || p.y < ry || p.y > ry + rh) return;
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
        if (arrow) {
          swipeData.arrows.push(arrow);
          updateVisorProgress();
          visor.style.opacity = cfg.footer.o;
          if (swipeData.arrows.length === 7) resolveSwipe();
        }
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

  const updateVisorProgress = () => {
    const arr = swipeData.arrows;
    const len = arr.length;
    const arrowsStr = arr.join("");
    
    let content = arrowsStr;
    
    if (len === 3) {
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      content = (rank && suit) ? rank+suit : "??";
    } else if (len === 5) {
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      const card = (rank && suit) ? rank+suit : "??";
      const dec = {"↑↑":0,"↑→":10,"→↑":20,"→→":30,"→↓":40,"↓→":50}[arr[3]+arr[4]];
      const decStr = dec !== undefined ? (dec/10).toString() : "?";
      content = `${card} ${decStr}`;
    } else if (len === 7) {
      const rank = {"↑→":"A","→↑":"2","→→":"3","→↓":"4","↓→":"5","↓↓":"6","↓←":"7","←↓":"8","←←":"9","←↑":"10","↑←":"J","↑↑":"Q","↑↓":"K"}[arr[0]+arr[1]];
      const suit = {"↑":"S","→":"H","↓":"C","←":"D"}[arr[2]];
      const card = (rank && suit) ? rank+suit : "??";
      const dec = {"↑↑":0,"↑→":10,"→↑":20,"→→":30,"→↓":40,"↓→":50}[arr[3]+arr[4]];
      const unt = {"↑↑":0,"↑→":1,"→↑":2,"→→":3,"→↓":4,"↓→":5,"↓↓":6,"↓←":7,"←↓":8,"←←":"9"}[arr[5]+arr[6]];
      const num = (dec !== undefined && unt !== undefined) ? dec + unt : "??";
      content = `${card} ${num}`;
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
    const num = (dec !== undefined && unt !== undefined) ? dec + unt : 0;

    if (!card || num < 1 || num > 52) { 
      visorL1.textContent = "ERRO"; 
      lastResult = "ERRO";
    } else {
      const pos = posMap[card];
      const cut = ((pos - num % 52) + 52) % 52;
      const cutNum = cut === 0 ? 52 : cut;
      
      const cardStr = STACK[cutNum-1];
      const numStr = cutNum.toString().padStart(2, '0');
      const peekResult = cfg.visor.inverted ? `${numStr} ${cardStr}` : `${cardStr} ${numStr}`;
      
      visorL1.textContent = peekResult;
      
      lastResult = peekResult;
      
      const ZZ_raw = cutNum.toString().padStart(2, '0');
      const ZZ = ZZ_raw[0] + "." + ZZ_raw[1]; 
      const XX = pos.toString().padStart(2, '0'); 
      const YY = num.toString().padStart(2, '0'); 
      
      footer.textContent = `Sethi Draw v.1.0.2 (${ZZ}.${XX}${YY})`;
      
      stamp(num);
    }
    setTimeout(() => { 
      if (mode !== "setup") {
        visor.style.opacity = 0; 
        setTimeout(() => {
          if (mode === "draw") {
            visorL1.textContent = cfg.visor.text;
          }
        }, 300);
      }
      swipeData.arrows = []; 
      mode = "draw"; 
    }, 1000);
  };

  const stamp = (n) => {
    const g = JSON.parse(localStorage.getItem(`v6_g_${n}`) || "null");
    const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
    const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
    if (g?.s) {
      g.s.forEach(s => strokes.push({ c: "#111111", p: s.p.map(p => ({ x: rx + p.x * rw, y: ry + p.y * rh })) }));
    } else {
      ctx.save(); ctx.font = "bold 50px sans-serif"; ctx.fillText(n, rx + 20, ry + 60); ctx.restore();
    }
    render();
  };

  window.toggleSetup = () => {
    if (mode === "setup") { mode = "draw"; setupPanel.classList.add("hidden"); visor.style.opacity = 0; applyCfg(); }
    else { mode = "setup"; setupPanel.classList.remove("hidden"); visor.style.opacity = cfg.footer.o; visorL1.textContent = lastResult; }
  };

  const toggleSwipe = () => {
    if (mode === "swipe") { 
      mode = "draw"; 
      visor.style.opacity = 0; 
    } else { 
      mode = "swipe"; 
      visor.style.opacity = cfg.footer.o; 
      visorL1.textContent = "."; 
    }
    swipeData.arrows = [];
  };

  window.setTarget = (t) => { 
    adjTarget = t; 
    const target = cfg[t];
    document.getElementById("adjTargetName").textContent = target.label || t; 
    
    // Mostra/esconde controles específicos de opacidade
    document.getElementById("oControl").style.display = (t === "visor" || t === "footer" || t === "panelSetup" || t === "panelTrain") ? "block" : "none";
    
    // Botão de editar texto (apenas para Peek 2 / footer)
    const editBtn = document.getElementById("editTextBtn");
    editBtn.style.display = (t === "footer") ? "block" : "none";
    
    // Botão de inverter ordem (apenas para Peek 1 / visor)
    const invertBtn = document.getElementById("invertOrderBtn");
    if (invertBtn) {
      invertBtn.style.display = (t === "visor") ? "block" : "none";
      invertBtn.textContent = cfg.visor.inverted ? "Ordem: 05 4H → 4H 05" : "Ordem: 4H 05 → 05 4H";
    }
    
    applyCfg();
  };

  window.adjust = (axis, val) => {
    const target = cfg[adjTarget];
    if (!target) return;

    // Converte valores de ajuste fixos para percentuais aproximados
    // val costuma ser 5 ou -5. Em uma tela de 400px, 5px é ~1.25%
    const pctX = (val / W) * 100;
    const pctY = (val / H) * 100;

    if (axis === "x") target.x += pctX * 2; // Multiplicador para manter sensibilidade
    if (axis === "y") target.y += pctY * 2;
    if (axis === "s") {
      if (adjTarget === "toolbar" || adjTarget === "panelSetup" || adjTarget === "panelTrain") {
        target.s = Math.max(0.5, Math.min(2.0, target.s + val * 0.01));
      } else if (adjTarget === "number") {
        target.s += pctX * 2; 
        target.h += pctY * 2;
      } else {
        target.s += val * 0.5; // Tamanho de fonte/escala
      }
    }
    if (axis === "o" && (adjTarget === "visor" || adjTarget === "footer" || adjTarget === "panelSetup" || adjTarget === "panelTrain")) {
      target.o = Math.max(0.05, Math.min(1.0, (target.o || 0.5) + val));
    }
    applyCfg();
  };

  window.editTargetText = () => {
    const target = cfg[adjTarget];
    if (!target || adjTarget !== "footer") return;
    const n = prompt(`Novo conteúdo para ${target.label}:`, target.text);
    if (n !== null) { target.text = n; applyCfg(); }
  };

  window.toggleInvertOrder = () => {
    cfg.visor.inverted = !cfg.visor.inverted;
    const invertBtn = document.getElementById("invertOrderBtn");
    if (invertBtn) {
      invertBtn.textContent = cfg.visor.inverted ? "Ordem: 05 4H → 4H 05" : "Ordem: 4H 05 → 05 4H";
    }
    applyCfg();
  };

  window.toggleTrain = () => {
    if (mode === "train") { 
      mode = "draw"; 
      trainPanel.classList.add("hidden"); 
      render(); 
    } else { 
      mode = "train"; 
      trainPanel.classList.remove("hidden"); 
      loadTrain(1); 
    }
  };

  const loadTrain = (n) => { 
    trainNum = Math.max(1, Math.min(52, n)); 
    trainNumEl.textContent = trainNum; 
    strokes = []; 
    
    const g = JSON.parse(localStorage.getItem(`v6_g_${trainNum}`) || "null");
    const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
    const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
    if (g?.s) {
      g.s.forEach(s => {
        strokes.push({ 
          c: "#111111", 
          p: s.p.map(p => ({ x: rx + p.x * rw, y: ry + p.y * rh })) 
        });
      });
    }
    render(); 
  };
  window.trainStep = (d) => loadTrain(trainNum + d);
  window.trainSave = () => {
    const rx = cfg.number.x * W / 100, ry = cfg.number.y * H / 100;
    const rw = cfg.number.s * W / 100, rh = cfg.number.h * H / 100;
    const s = strokes.map(st => ({ 
      p: st.p.map(p => ({ x: (p.x - rx)/rw, y: (p.y - ry)/rh })) 
    }));
    
    if (s.length > 0) {
      localStorage.setItem(`v6_g_${trainNum}`, JSON.stringify({ s }));
      if (trainNum < 52) {
        window.trainStep(1);
      } else {
        alert("Todos os números (1-52) foram salvos!");
      }
    }
  };

  window.exportGlyphs = () => {
    const backup = {
      cfg: cfg, 
      glyphs: {}
    };
    for (let i = 1; i <= 52; i++) {
      const g = localStorage.getItem(`v6_g_${i}`);
      if (g) backup.glyphs[i] = JSON.parse(g);
    }
    const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sethi_draw_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  window.importGlyphs = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (data.cfg && data.glyphs) {
          cfg = data.cfg;
          localStorage.setItem("mnem_v6_cfg", JSON.stringify(cfg));
          Object.keys(data.glyphs).forEach(k => {
            localStorage.setItem(`v6_g_${k}`, JSON.stringify(data.glyphs[k]));
          });
          applyCfg();
        } 
        else {
          Object.keys(data).forEach(k => {
            localStorage.setItem(`v6_g_${k}`, JSON.stringify(data[k]));
          });
        }
        
        alert("Backup importado com sucesso! (Glifos e Configurações)");
        if (mode === "train") loadTrain(trainNum);
        render();
      } catch (err) {
        alert("Erro ao importar backup. Verifique o arquivo.");
      }
    };
    reader.readAsText(file);
  };

  init();
})();
