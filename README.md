<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/2815ee4e-1d6b-4aad-837c-8857bdd56828

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Publicação na Vercel

A interface e as rotas `src/app/api` são servidas pelo Next.js. O ficheiro
`vercel.json` fixa o framework, o comando de build e a pasta `.next`; não publique
apenas o resultado do Vite, pois esse resultado não contém as rotas da API.

Configure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (da mesma instância Clerk usada
pelos utilizadores), `CLERK_SECRET_KEY` e `DATABASE_URL` no ambiente de publicação.
Depois do deploy, um GET sem autenticação para `/api/user/profile` deve devolver
401 em JSON, não 404. Confirme também a gravação do nome com uma sessão iniciada
e volte a carregar a página para verificar a persistência.
