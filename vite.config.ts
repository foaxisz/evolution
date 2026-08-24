import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // O service worker é gerado pelo Workbox a partir dos arquivos que o
      // build emite. Escrever um à mão daria certo hoje e quebraria no
      // próximo deploy: o Vite renomeia os assets com hash a cada build, e
      // uma lista de precache fixa passaria a apontar para arquivos mortos.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],

      manifest: {
        name: 'Evolution',
        short_name: 'Evolution',
        description: 'Saber o que fazer, manter constância, perceber evolução.',
        lang: 'pt-BR',
        // `standalone` tira a barra do navegador: aberto pela tela inicial,
        // parece aplicativo e não aba.
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#0a0812',
        background_color: '#0a0812',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // As fontes vêm do Google e são o único recurso externo do app.
        // Sem cache, abrir offline mostraria o texto na fonte de sistema —
        // o que, num app cuja identidade É a tipografia, parece quebrado.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-arquivos',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        // DESLIGADO de propósito, e não por esquecimento.
        //
        // Em desenvolvimento o plugin serve um `dev-sw.js` SEM handler de
        // `fetch`. O Chrome exige esse handler para considerar o app
        // instalável, então testar PWA contra `npm run dev` nunca oferece
        // "Instalar" — e o app parece quebrado quando na verdade é o SW de
        // dev que é incompleto. Pior: o SW ligado em dev ainda pode servir
        // asset velho e fazer uma edição "não pegar".
        //
        // Para testar instalação, use o build de verdade:
        //   npm run build && npm run preview
        enabled: false,
      },
    }),
  ],
  server: {
    // `true` faz o Vite escutar em todas as interfaces, e não só em
    // localhost — é o que permite abrir o app no celular pelo IP da
    // máquina, na mesma rede Wi-Fi.
    //
    // Vale só para o servidor de desenvolvimento: qualquer aparelho da
    // rede passa a alcançar a porta enquanto ele estiver rodando. Em rede
    // pública, feche o servidor quando terminar.
    host: true,
  },

  preview: {
    host: true,
    // O `vite preview` não lê `PORT` sozinho: ele fixa a 4173 e falha se
    // ela estiver ocupada. Lendo a variável aqui, quem sobe o servidor
    // pode atribuir a porta livre que quiser, e nada no app depende de um
    // número específico — não há callback de OAuth nem webhook apontando
    // para cá. Sem a variável, mantém o padrão do Vite.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
})
