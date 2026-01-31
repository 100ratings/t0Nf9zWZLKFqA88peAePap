# 🔐 Sethi Draw - Sistema de Licenciamento

Este repositório contém o aplicativo **Sethi Draw** com um sistema de licenciamento integrado que permite o uso em apenas **um dispositivo por vez**.

## 📂 Estrutura do Projeto

- **`/app`**: Código fonte do aplicativo mobile (PWA) com tela de ativação.
- **`/backend`**: Servidor API em Node.js para gerenciamento das licenças.
- **`/admin`**: Painel administrativo para criar e gerenciar as chaves de ativação.

## 🚀 Como Configurar

### 1. Backend (Servidor)
O backend é responsável por validar as chaves.
1. Entre na pasta `backend`.
2. Execute `npm install`.
3. Configure o arquivo `.env` com sua senha admin e segredo JWT.
4. Inicie com `node server.js`.

### 2. Aplicativo e Painel Admin
Ambos precisam saber o endereço do seu servidor backend.
1. No arquivo `app/config.js`, altere `BASE_URL` para a URL do seu servidor.
2. No arquivo `admin/admin-config.js`, altere `BASE_URL` para a URL do seu servidor.

## 🛠️ Funcionalidades
- **Ativação Única**: Cada chave funciona em apenas 1 celular.
- **Desconexão Automática**: Se ativar em um novo celular, o antigo é desconectado.
- **Painel Admin**: Gere novas chaves para seus clientes facilmente.

---
Desenvolvido para Sethi Draw.
