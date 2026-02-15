# Balança Pro+

Sistema de Pesagem Rodoviária completo e responsivo (PWA).

## Funcionalidades

- Registro de pesagens de entrada e saída
- Geração de tickets e relatórios em PDF
- Dashboard com estatísticas
- Suporte offline (PWA)
- Autenticação e banco de dados com Firebase

## Como rodar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acesse `http://localhost:3000` (ou a porta indicada).

## 🚀 Link do Projeto (Vercel)

Clique abaixo para acessar a versão online:

[![Vercel](https://img.shields.io/badge/vercel-%23000000.svg?style=for-the-badge&logo=vercel&logoColor=white)](YOUR_VERCEL_URL_HERE)

> **Nota:** Substitua `YOUR_VERCEL_URL_HERE` pelo link real do seu projeto na Vercel após o deploy.

## Deploy no Netlify

1. Crie um repositório no GitHub e faça o push deste código.
2. No painel do Netlify, clique em "Add new site" -> "Import an existing project".
3. Conecte ao GitHub e selecione este repositório.
4. As configurações de build serão detectadas automaticamente (ou use `npm run build` se tiver script de build, mas para este projeto estático, a pasta raiz é suficiente).
