import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * A cor do quadriculado do Excalidraw, trocada na compilação.
 *
 * Ela é constante no código deles — `#dddddd` e `#e5e5e5`, cinzas pensados
 * para tela branca — e não sai por variável de CSS nem por prop: o
 * quadriculado é desenhado no canvas, e canvas não lê CSS. Sobre a
 * prancheta roxa escura daqui, esses cinzas viram uma gaiola acesa que
 * ofusca o próprio desenho.
 *
 * Trocar o literal na hora de compilar é feio, e é a única porta que
 * existe. Por isso ele GRITA quando não encontra: numa atualização do
 * pacote que renomeie a constante, a falha aparece no terminal em vez de
 * a gaiola branca voltar em silêncio.
 */
const GRADE_ORIGINAL = /\{\s*Bold:\s*"#dddddd",\s*Regular:\s*"#e5e5e5"\s*\}/

/** Discreta: a fina quase encosta no fundo, e a de cada dez marca a
 *  divisão sem virar régua. */
const GRADE_NOSSA = '{Bold:"#3f3163",Regular:"#2a2050"}'

const ONDE_ACHOU = { sim: false }

function repintar(codigo: string): string | null {
  if (!GRADE_ORIGINAL.test(codigo)) return null
  ONDE_ACHOU.sim = true
  return codigo.replace(GRADE_ORIGINAL, GRADE_NOSSA)
}

/*
 * A troca acontece em DOIS lugares, e não por descuido.
 *
 * `transform` é do Rollup e vale no `build`. Em desenvolvimento o Vite
 * pré-empacota as dependências com esbuild e o `transform` não chega nelas
 * — sem o gancho do esbuild, o quadriculado sairia roxo no build e cinza
 * no `npm run dev`, que é o tipo de diferença que faz consertar duas vezes
 * a mesma coisa.
 *
 * Tirar o Excalidraw do pré-empacotamento (`optimizeDeps.exclude`) era o
 * caminho curto e não funciona: ele carrega dependência em CJS, e sem o
 * pré-empacotamento a página nem monta.
 */
function grade(): Plugin {
  return {
    name: 'grade-do-excalidraw',
    enforce: 'pre',

    config() {
      return {
        optimizeDeps: {
          esbuildOptions: {
            plugins: [{
              name: 'grade-do-excalidraw-esbuild',
              setup(build: {
                onLoad: (
                  opcoes: { filter: RegExp },
                  cb: (a: { path: string }) => Promise<unknown>,
                ) => void
              }) {
                build.onLoad({ filter: /excalidraw/ }, async ({ path }) => {
                  if (!path.endsWith('.js')) return null
                  const fs = await import('node:fs/promises')
                  const novo = repintar(await fs.readFile(path, 'utf8'))
                  return novo === null ? null : { contents: novo, loader: 'js' }
                })
              },
            }],
          },
        },
      }
    },

    transform(codigo, id) {
      if (!id.includes('@excalidraw')) return null
      return repintar(codigo)
    },

    buildEnd() {
      if (!ONDE_ACHOU.sim) {
        this.warn(
          'A constante da grade do Excalidraw não foi encontrada — o ' +
          'quadriculado vai aparecer em cinza claro. Confira ' +
          'GRADE_ORIGINAL no vite.config.ts contra a versão instalada.'
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [
    grade(),
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
        id: '/',
        name: 'Evolution',
        short_name: 'Evolution',
        description: 'Saber o que fazer, manter constância, perceber evolução.',
        lang: 'pt-BR',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#0a0812',
        background_color: '#0a0812',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icone-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // O precache é a CASCA do app, e só ela.
        //
        // Listar `**/*.js` traria junto os ~8MB do Excalidraw — locales,
        // fontes e o motor de desenho inteiro — e todo mundo baixaria isso
        // na instalação, inclusive quem nunca vai abrir um quadro livre.
        // Ele desce sob demanda e fica no cache de execução, logo abaixo.
        globPatterns: [
          '**/*.{css,html,svg,png,ico,webmanifest}',
          'assets/index-*.js',
          'assets/workbox-window*.js',
          'registerSW.js',
        ],
        runtimeCaching: [
          {
            // O resto dos pedaços do próprio app. O nome carrega o hash do
            // conteúdo, então CacheFirst nunca serve versão velha: build
            // novo = nome novo = pedido novo.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pedacos-do-app',
              expiration: { maxEntries: 220, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // As fontes vêm do Google e são o único recurso externo do app.
          // Sem cache, abrir offline mostraria o texto na fonte de sistema —
          // o que, num app cuja identidade É a tipografia, parece quebrado.
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
