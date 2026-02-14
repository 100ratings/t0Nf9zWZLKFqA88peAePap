# Mudanças Implementadas - Suporte a Landscape

## Resumo
Adicionado suporte completo para orientação landscape (horizontal) no aplicativo Sethi Draw, com detecção automática e controles manuais de ajuste.

## Arquivos Modificados

### 1. app/style.css
- **Adicionado**: Variáveis CSS `--scale-portrait` e `--scale-landscape` para controle de escala
- **Adicionado**: Media query `@media (orientation: landscape)` com ajustes responsivos para:
  - Toolbar (posição e tamanho)
  - Painéis (escala e dimensões)
  - Visor e footer (escala)
  - Telas de ativação e instalação (padding e fontes)
- **Modificado**: Aviso de orientação agora sempre oculto em landscape

### 2. app/app.js
- **Modificado**: Função `checkOrientation()` - removido bloqueio de landscape, adicionada aplicação de classes CSS
- **Adicionado**: Função `applyOrientationScales()` - aplica as escalas configuradas via CSS variables
- **Adicionado**: Propriedades `scalePortrait` e `scaleLandscape` no objeto de configuração `cfg`
- **Modificado**: Função `ensureCfg()` - inicializa as novas propriedades de escala
- **Modificado**: Função `updateAdjustUI()` - renderiza controles de escala de orientação
- **Adicionado**: Função `adjustOrientationScale()` - ajusta escala com incremento/decremento
- **Adicionado**: Função `adjustOrientationScaleDirect()` - ajusta escala com valor direto

### 3. app/index.html
- **Adicionado**: Seção "Escala de Orientação" no painel de configurações
- **Adicionado**: Container `<div id="orientationScales">` para controles dinâmicos

## Funcionalidades Implementadas

### Detecção Automática
- O app detecta automaticamente quando o dispositivo é virado
- Aplica classes CSS `landscape-mode` ou `portrait-mode` ao body
- Ajusta layout automaticamente via media queries

### Controles Manuais
Localizados no menu "Configurações do App", seção "Escala de Orientação":
- **Portrait (%)**: Ajusta escala da interface em modo vertical (50% a 150%)
- **Landscape (%)**: Ajusta escala da interface em modo horizontal (50% a 150%)
- Controles com botões +/- e input numérico direto
- Valores salvos automaticamente no localStorage

## Arquivos Preservados (Não Alterados)
✓ app/license-manager.js
✓ app/activation-init.js
✓ app/sw.js (Service Worker)
✓ app/manifest.json
✓ Telas de instalação e ativação (lógica mantida)

## Compatibilidade
- Funciona em iOS e Android
- Mantém compatibilidade com PWA
- Não afeta sistema de licenças
- Configurações persistem entre sessões
