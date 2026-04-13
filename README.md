# Nexus Video Hub

Este é um hub de vídeos do YouTube com geração automática de artigos SEO usando a API do Groq.

## 🚀 Como rodar o projeto localmente

1. **Clone o repositório:**
   ```bash
   git clone <url-do-seu-repositorio>
   cd <nome-da-pasta>
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente:**
   - Crie um arquivo `.env` na raiz do projeto.
   - Copie o conteúdo de `.env.example` para o `.env`.
   - Adicione suas chaves do Firebase e a `VITE_GROQ_API_KEY`.

4. **Inicie o servidor de desenvolvimento:**
   ```bash
   npm run dev
   ```

## 🌐 Deploy no Netlify via GitHub

1. Suba este código para um repositório no seu **GitHub**.
2. No **Netlify**, clique em "Add new site" > "Import an existing project".
3. Conecte com seu GitHub e selecione este repositório.
4. **Configurações de Build:**
   - Build Command: `npm run build`
   - Publish directory: `dist`
5. **Variáveis de Ambiente (Site Settings > Environment variables):**
   - Adicione todas as variáveis do seu `.env` (Firebase e Groq).

## 🛠️ Tecnologias
- React + Vite
- Tailwind CSS
- Firebase Firestore
- Groq SDK (IA)
- Framer Motion
