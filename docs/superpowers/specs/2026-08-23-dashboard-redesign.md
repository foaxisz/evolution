# Redesign do Dashboard — Plano completo

**Projeto:** Evolution
**Data:** 2026-08-23
**Escopo:** aba Dashboard (hábitos, constância, ações, compras)
**Fora de escopo:** aba Foco (é a frente de trabalho e não tem ligação com o resto do app)

---

## 0. Ponto de partida (leia antes de executar)

O Dashboard foi reconstruído hoje. Este plano **supersede** aquela reconstrução: ele
não é uma lista de ajustes, é a especificação de uma tela nova. O que já existe entra
aqui como *inventário de peças*, não como restrição.

**Peças que sobrevivem** (já compartilhadas, testadas em duas telas):

| arquivo | papel | destino |
|---|---|---|
| `src/components/ui/Bloco.tsx` | moldura de seção com título arcade + fio | evolui (§6) |
| `src/components/ui/Placar.tsx` | fileira de células com hairline | evolui (§6) |
| `src/components/ui/BarrasVerticais.tsx` | barras com trilho + leitura no cabeçalho | mantém |
| `src/components/dashboard/Descobertas.tsx` | leituras em frase | mantém |
| `src/components/dashboard/Progressao.tsx` | barra de feito/total | mantém |
| `src/components/dashboard/LinhasDeHabito.tsx` | nome dentro da barra | mantém |
| `src/lib/descobertas.ts` | cálculo dos cruzamentos, com piso de amostra | **expande** (§2) |

**Peça que já morreu:** `MapaDeAtividade.tsx` (heatmap de 17 semanas) — removido por
densidade baixa. Não ressuscitar sem resolver §1.2.

---

## 1. Análise do estado atual

### 1.1 Problemas de gráfico e layout

| # | Problema | Evidência | Gravidade |
|---|---|---|---|
| P1 | **Ausência de hierarquia** — todas as seções têm o mesmo peso visual (mesma moldura, mesmo título, mesmo espaçamento). A página é uma pilha uniforme. | 6 `<Bloco>` idênticos empilhados com `space-y-5` | Alta |
| P2 | **Sem ponto de entrada** — não existe um elemento que responda "e aí, como estou?" em meio segundo. O olho cai no placar de 4 células, que são 4 respostas de peso igual. | `Placar` com 4 `CelulaPlacar` equivalentes | Alta |
| P3 | **Densidade baixa por área** — largura fixa `max-w-4xl` com seções de largura cheia desperdiça a metade direita em telas grandes; gráficos de 7 e 12 pontos esticados viram tijolo. | `max-w-4xl` + `larguraMaxima` como remendo | Alta |
| P4 | **Identidade só na tipografia** — o arcade aparece em rótulo e número, mas as molduras, os fundos e as barras são de dashboard genérico. Não há tratamento de tubo, borda, grade ou brilho. | `Bloco` = `rounded-xl border` neutro | Alta |
| P5 | **Sem controle temporal** — a janela de 30 dias e as 12 semanas são fixas em constante. O usuário não escolhe recorte. | `const JANELA = 30` | Média |
| P6 | **Gráficos mudos sem hover** — a leitura só existe sob o cursor; em toque, some. | `onApontar` → `apoio` do `Bloco` | Média |
| P7 | **Zero estado de carregamento/transição** — a página aparece pronta; trocar de aba não tem passagem. | `animate-fade-in` só no container | Baixa |

### 1.2 Limitações de experiência

- **Não há navegação para dentro.** Nenhum número é clicável. Ver "3 ações em aberto" não leva às ações.
- **Não há comparação escolhida pelo usuário.** Os deltas comparam sempre com o período anterior imediato; não dá para comparar com o melhor mês, nem com a média.
- **Mobile é a mesma página empilhada.** Sem priorização diferente: o usuário no celular rola 6 blocos para chegar às descobertas.
- **Nada persiste.** Filtro, seção recolhida, ordem — nada é lembrado entre sessões.
- **Acessibilidade não endereçada.** Cor é o único código em vários lugares (delta verde/vermelho, barra abaixo da média). Sem `prefers-reduced-motion` nas barras novas.

### 1.3 Oportunidades

1. **Metáfora de gabinete.** O app já tem CRT, fósforo e bitmap; o Dashboard pode ser o *painel da máquina*, com marquise, mostradores e log. Isso resolve P1 e P2 de uma vez, porque a metáfora **impõe** hierarquia.
2. **Densidade em grade.** Trocar a coluna única por grade de 12 colunas resolve P3 e permite gráfico pequeno lado a lado com gráfico grande.
3. **Descobertas como produto.** É a única coisa da tela que o usuário não conseguiria calcular de cabeça. Hoje é uma seção no meio; deveria ser protagonista.
4. **`.tube-amber` já existe.** O projeto já sabe recolorir uma subárvore inteira redefinindo variáveis. É o mecanismo pronto para temas por área.

---

## 2. Seleção e priorização de dados

### 2.1 Princípio de corte

> **A tela mostra o que o usuário não calcularia sozinho.**
> Contagem e sequência ele já sabe — não devolva o que ele acabou de fazer.
> O que só a máquina enxerga é o cruzamento.

Segundo princípio, herdado do projeto: **sem gamificação**. Medalha por limiar
arbitrário (10/50/100 conclusões), troféu, XP e nível estão proibidos. Recorde
pessoal é permitido — é ponto de comparação, não prêmio.

### 2.2 Camadas

**Camada 1 — Marquise (o número do momento).** Um único indicador, grande, com
tratamento de tubo. Não é a sequência: é o **estado da constância agora**, com
uma frase curta.

**Camada 2 — Placar (4 números âncora).**

| métrica | por que fica | fonte |
|---|---|---|
| Sequência | é o hábito mental de quem rastreia; esperado | `descobertas` |
| Dias perfeitos | concreto e verificável — tudo que a agenda previa foi feito | `diasPerfeitos()` |
| Dias ativos | denominador honesto (`24 de 30`) | placar |
| Conclusões | volume bruto, com delta | placar |

**Camada 3 — Descobertas (as leituras).** O protagonista. Ver §2.3.

**Camada 4 — Mostradores (gráficos).** Dias ativos por semana, dias da semana, por hábito.

**Camada 5 — Log (o que está aberto).** Ações e compras como progressão.

**Camada 6 — Rodapé.** Áreas de evolução, desafios, data de início.

### 2.3 Catálogo de cruzamentos

Já implementados em `src/lib/descobertas.ts`:

| id | leitura | piso de amostra |
|---|---|---|
| `domino` | hábito A puxa hábito B | 10 dias de cada lado, ganho ≥ 20pp |
| `dia-fraco` | dia da semana que escapa | 4 ocorrências, ganho ≥ 15pp |
| `retomada` | tempo para voltar depois de falhar | 3 vãos |
| `vacuo` | maior buraco sem registro | ≥ 3 dias |
| `sumido` | hábito abandonado | ≥ 7 dias, ≥ 3 registros históricos |
| `acao-velha` | ação parada | ≥ 7 dias |
| `desejo` | tempo entre querer e comprar | 3 compras |

**A implementar nesta fase:**

| id | leitura | por que é boa |
|---|---|---|
| `horario` | "78% dos seus registros acontecem antes das 10h" | exige `createdAt` no log — ver §7 dependências |
| `mes-a-mes` | "agosto está 18% acima de julho" | escala longa que hoje não existe |
| `sobrevivencia` | "os hábitos que você mantém passaram dos 21 dias; os que largou morreram em 9" | responde "vou aguentar esse?" |
| `efeito-fds` | "seu fim de semana rende 40% do dia útil" | recorte que o dia-a-dia esconde |
| `custo-da-lista` | "R$ 3.149 parados há mais de 30 dias na lista de compras" | cruza valor com tempo |
| `carga` | "você fecha 2,3 ações por semana e abre 3,1" | entra vs sai — prevê acúmulo |

**Regra inviolável:** descoberta sem amostra **não existe**, não aparece com número
frágil. Com quatro dias de registro dá para "provar" qualquer correlação, e um app
que afirma bobagem com confiança é pior que um calado.

### 2.4 Principal vs. secundário

| Principal (sempre visível) | Secundário (atrás de interação) |
|---|---|
| Marquise, Placar, 3 primeiras descobertas | Descobertas 4+ ("ver todas") |
| Dias ativos por semana | Série mensal (12 meses) |
| Em que dias você aparece | Detalhe por hábito individual |
| Aberto agora | Histórico de áreas completo |

---

## 3. Direcionamento visual (identidade arcade)

### 3.1 A regra dos três planos

O maior risco de "estética forte" é comer o dado. Resolve-se separando a tela em
três planos, com permissões diferentes:

| plano | o que é | efeitos permitidos | efeitos proibidos |
|---|---|---|---|
| **Fundo** | página, molduras, calhas | scanlines, vinheta, grade de fósforo, gradiente sutil | — |
| **Chrome** | títulos, rótulos, bordas, fios, legendas | bitmap, brilho de fósforo, letterspacing largo, caixa alta | — |
| **Dado** | barra, linha, célula, número do placar | cor sólida, opacidade, contorno de 1px | **scanline, blur, glow, gradiente, textura, sombra** |

> Nunca aplique `crt-scanlines` ou `.glow` sobre uma marca de dado.
> O brilho vaza para o vizinho e a listra altera a área percebida da barra.
> O arcade mora na moldura; o dado fica limpo.

### 3.2 Paleta

Base já existente em `src/index.css` (`@theme`) — **não inventar hex novo em componente**:

| token | valor | uso no Dashboard |
|---|---|---|
| `--color-bg-primary` | `#0a0812` | fundo da página |
| `--color-bg-card` | `#16112a` | fundo de bloco |
| `--color-bg-input` | `#0f0b1c` | trilho de barra |
| `--color-border` | `#2b2145` | fio, hairline, grade |
| `--color-border-light` | `#3f3163` | borda em hover |
| `--color-text-primary` | `#ece8f8` | número grande |
| `--color-text-secondary` | `#a99cd0` | frase de descoberta |
| `--color-text-muted` | `#8578ad` | rótulo, eixo |
| `--color-accent` | `#a855f7` | cor primária de dado |
| `--color-accent-light` | `#c88cff` | pico, ponta acesa |
| `--color-success` | `#3ddc97` | delta positivo, padrão que ajuda |
| `--color-danger` | `#ff4d8d` | delta negativo, o que escapa |
| `--color-warning` | `#ffb000` | atenção sem alarme |
| `--color-info` | `#38bdf8` | série secundária |

**Tokens novos a acrescentar** (`@theme`, para o Dashboard):

```css
--color-fosforo-grade: rgba(168, 85, 247, 0.055); /* grade de fundo */
--color-tubo-vinheta:  rgba(0, 0, 0, 0.45);        /* escurecimento nas bordas */
```

**Regra de cor de dado:** máximo **duas** rampas por gráfico. Se a cor codifica
significado (acima/abaixo da média), a legenda é obrigatória — hoje "barra vermelha
= abaixo da média" só está no `apoio` em texto, o que é frágil.

**Contraste:** todo texto sobre `--color-bg-card` precisa de ≥ 4.5:1.
`--color-text-muted` (`#8578ad`) sobre `#16112a` passa; **não escurecer mais**.

### 3.3 Tipografia

| família | classe | onde | por quê |
|---|---|---|---|
| Press Start 2P | `.font-arcade` | rótulo, número de placar, eixo, título de bloco | bitmap: ótima em texto curto, paredão em texto longo |
| VT323 | `.font-terminal` | frase de descoberta, nome de hábito, observação | terminal CRT legível em corpo pequeno |
| JetBrains Mono | padrão | números tabulares em tabela densa | leitura neutra |

**Escala arcade** (Press Start 2P renderiza grande; os corpos são menores que o nominal):

| uso | tamanho |
|---|---|
| Marquise | `text-[1.6rem]` |
| Número de placar | `text-[0.8rem]` |
| Título de bloco | `text-[0.45rem]` |
| Eixo / rótulo de barra | `text-[0.4rem]` |
| Selo / badge | `text-[0.35rem]` |

**VT323 sempre ≥ 15px** — ela renderiza menor que o nominal.

### 3.4 Tratamentos que dizem "arcade" sem sujar dado

1. **Grade de fósforo no fundo do bloco** — `background-image` de linhas a 1px em `--color-fosforo-grade`, espaçadas 24px. Fica atrás do gráfico, some sob a barra.
2. **Cantoneiras** (`corner brackets`) nos 4 cantos do bloco em destaque — 8px de traço em `--color-accent`, opacidade 0.5.
3. **Fio que some nas pontas** — `.filete`, já existe.
4. **Marca de canal** — quadrado de 3px (`rounded-[1px]`) antes de rótulo importante.
5. **Vinheta de tubo** — `radial-gradient` escurecendo os cantos da marquise apenas.
6. **Scanlines** — `.crt-scanlines` **só** na marquise. Em nenhum outro lugar.

---

## 4. Redesign de gráficos

### 4.1 Escolha por dado

| dado | gráfico hoje | gráfico recomendado | por quê |
|---|---|---|---|
| Dias ativos por semana (12 semanas, 0–7) | barras verticais | **mantém barras verticais** | escala fixa 0–7, teto igual em toda semana: comparação direta sem calcular |
| Taxa por dia da semana (7 valores, %) | barras verticais + linha de média | **barras + linha de média + rótulo de desvio** | 7 categorias nominais; linha de referência transforma "alto/baixo" em "acima/abaixo de você" |
| Consistência por hábito (3–8 valores, %) | barra horizontal com nome dentro | **mantém** | nome longo não cabe em barra vertical; nome dentro dobra a altura útil |
| Aberto vs. fechado (2 razões) | barra de progresso | **mantém** | razão parte/todo, uma dimensão |
| Áreas de evolução (série 1–5 por área) | sparkline + primeira→última | **slope chart** (só primeiro e último ponto, ligados) | a pergunta é "subiu ou desceu"; o meio da série é ruído em escala de 1–5 |
| Mês a mês (novo) | — | **barras verticais com linha de média móvel** | escala longa; a média móvel separa tendência de oscilação |
| Carga: abre vs. fecha (novo) | — | **duas séries empilhadas em espelho** (abre para cima, fecha para baixo) | mostra saldo visualmente sem exigir subtração mental |

### 4.2 Regras de desenho

- **Piso de altura de 3%** para valor não-zero: barra invisível e barra ausente contam coisas diferentes e não podem parecer a mesma. (Já implementado.)
- **Teto de largura de barra** (`larguraMaxima`) para poucas categorias em faixa larga — evita tijolo.
- **Sem eixo Y com grade completa.** Máximo 3 linhas de referência (0, meio, topo) a `opacity: 0.55`.
- **Rótulo do eixo vira o valor no hover** — padrão já estabelecido no app; mantém.
- **Zero não responde ao mouse** — não há valor para ler, e a barra ausente já disse.

### 4.3 Animação

| momento | animação | duração | nota |
|---|---|---|---|
| Entrada de barra | `crescerBarra` (existe), escalonada | 450ms, +40ms por barra | `transform-origin: bottom` |
| Entrada de barra horizontal | `esticarBarra` (existe) | 600ms, +45ms por item | |
| Número do placar | **contagem crescente** (novo) | 700ms, `ease-out` | só na primeira montagem; nunca em re-render |
| Hover em barra | `background-color` | 150ms | **sem** transform, sem escala |
| Rótulo → valor | `color` | 150ms | troca de texto é instantânea |
| Troca de filtro | fade das barras + regrow | 300ms | não animar altura de/para durante troca de dataset |

**Obrigatório:** respeitar `prefers-reduced-motion` — o bloco já existe em
`src/index.css:447` e cobre `.barra-crescendo` e `.barra-esticando`. Toda animação
nova entra nesse bloco.

**Proibido:** brilho pulsante em dado, partículas, screen shake, confete. É
gamificação com outro nome.

---

## 5. Reorganização do layout

### 5.1 Grade

Trocar `max-w-4xl` coluna única por **`max-w-6xl` com grade de 12 colunas**
(`gap-4`, `md:gap-5`).

```
┌──────────────────────────────────────────────────────────┐
│ CABEÇALHO           Dashboard ──────────── [30d ▾] [seg] │  12 col
├──────────────────────────────────────────────────────────┤
│ MARQUISE                                                 │  12 col
│ estado da constância + frase                             │  (scanlines aqui)
├──────────────┬──────────────┬──────────────┬─────────────┤
│ SEQUÊNCIA    │ DIAS PERFEIT.│ DIAS ATIVOS  │ CONCLUSÕES  │  3 col cada
├──────────────┴──────────────┴──────────────┴─────────────┤
│ O QUE OS DADOS DIZEM                                     │  12 col
│ 3 leituras + "ver todas"                                 │  (destaque: cantoneiras)
├───────────────────────────────┬──────────────────────────┤
│ DIAS ATIVOS POR SEMANA        │ EM QUE DIAS VOCÊ APARECE  │  7 col │ 5 col
├───────────────────────────────┴──────────────────────────┤
│ POR HÁBITO                                               │  12 col
├───────────────────────────────┬──────────────────────────┤
│ ABERTO AGORA                  │ ÁREAS DE EVOLUÇÃO         │  6 col │ 6 col
└───────────────────────────────┴──────────────────────────┘
```

**Por que esse pareamento funciona:** só emparelhar blocos de **altura fixa**.
Gráfico com gráfico fecha reto; gráfico com **lista** (metas, descobertas) entorta,
porque a lista tem altura variável e sobra vão embaixo do mais curto. Regra herdada
de erro real cometido no histórico de metas.

### 5.2 Responsividade

| faixa | comportamento |
|---|---|
| `< 640px` (mobile) | coluna única. **Ordem muda:** Marquise → Descobertas → Placar (2×2) → Aberto agora → gráficos. O insight vem antes do número no celular, porque rolar 4 blocos para chegar nele é perder o produto. |
| `640–1024px` (tablet) | Placar em 2×2; gráficos em coluna única largura cheia |
| `> 1024px` (desktop) | grade de 12 colunas conforme diagrama |
| `> 1536px` | mantém `max-w-6xl` — não esticar; 7 barras em 1400px viram tijolo |

**Toque:** sem hover. Em `< 768px` o valor de cada barra aparece **sempre** sob o
eixo (em vez de só no hover), com corpo reduzido. Alternativa aceita: tap seleciona
e mantém a leitura no cabeçalho.

---

## 6. Componentes e interações

### 6.1 Componentes novos

| componente | arquivo | responsabilidade |
|---|---|---|
| `Marquise` | `components/dashboard/Marquise.tsx` | número-herói + frase + scanlines + vinheta |
| `SeletorDeJanela` | `components/dashboard/SeletorDeJanela.tsx` | 7d / 30d / 90d / tudo — persistido |
| `NumeroRolante` | `components/ui/NumeroRolante.tsx` | contagem crescente, respeita reduced-motion |
| `Cantoneiras` | `components/ui/Cantoneiras.tsx` | 4 cantos, decorativo, `aria-hidden` |
| `SlopeChart` | `components/dashboard/SlopeChart.tsx` | áreas de evolução: primeiro → último |
| `Legenda` | `components/ui/Legenda.tsx` | obrigatória quando cor codifica significado |

### 6.2 Evolução de componentes existentes

- **`Bloco`** ganha `destaque?: boolean` (cantoneiras + borda acesa) e `acao?: ReactNode` (slot para "ver todas" / filtro no cabeçalho).
- **`Placar`** ganha `colunas?: 2 | 4` para o arranjo 2×2 no mobile.
- **`CelulaPlacar`** ganha `onClick?` — número clicável navega para a aba de origem.

### 6.3 Padrões de interação

| interação | comportamento | feedback |
|---|---|---|
| Hover em barra | valor sobe ao cabeçalho do bloco; rótulo do eixo vira o valor; barra fecha na cor cheia | 150ms de cor, sem movimento |
| Clique em célula do placar | navega para a aba de origem | borda acende 120ms antes de navegar |
| Clique em "ver todas" | expande descobertas em altura, sem modal | `linhaEntra` escalonado |
| Troca de janela | refaz os gráficos | barras somem e crescem; números rolam |
| Bloco sem dado | **não renderiza** | — |
| Descoberta sem amostra | **não existe** | — |

**Estado de foco:** anel de 2px em `--color-accent-light` com `outline-offset: 2px`.
Nunca remover outline sem substituto — o app é navegável por teclado.

### 6.4 Feedback e acessibilidade

- Toda barra é `<button>` ou tem `role="img"` com `aria-label` completo (`"terça-feira: 57% dos dias"`).
- Delta nunca é **só** cor: sempre acompanha sinal (`+`/`−`) e sufixo (`pp`/`%`).
- Barra abaixo da média nunca é **só** vermelha: acompanha a linha de referência tracejada e a legenda.
- `aria-live="polite"` no `apoio` do `Bloco` para a leitura de hover ser anunciada.

---

## 7. Plano de implementação

### 7.1 Fases

| fase | entrega | arquivos | complexidade | depende de |
|---|---|---|---|---|
| **F1** | Tokens e utilitários novos: `--color-fosforo-grade`, `--color-tubo-vinheta`, `.grade-fosforo`, `.vinheta-tubo`, animação `contarNumero` (+ reduced-motion) | `src/index.css` | **Baixa** | — |
| **F2** | Grade de 12 colunas e reordenação mobile | `DashboardPage.tsx` | **Média** | F1 |
| **F3** | `Marquise` + `NumeroRolante` + `Cantoneiras` | 3 arquivos novos | **Média** | F1 |
| **F4** | `Bloco` com `destaque`/`acao`; `Placar` com `colunas`; `CelulaPlacar` clicável | `ui/Bloco.tsx`, `ui/Placar.tsx` | **Baixa** | F1 |
| **F5** | `SeletorDeJanela` + janela variável (substituir `const JANELA = 30`) | `DashboardPage.tsx`, `lib/descobertas.ts`, `store` | **Alta** | F4 |
| **F6** | 6 descobertas novas (§2.3) | `lib/descobertas.ts` | **Alta** | F5 |
| **F7** | `SlopeChart` substituindo sparkline de áreas | `dashboard/SlopeChart.tsx` | **Média** | F1 |
| **F8** | Legenda, `aria-label`, `aria-live`, foco visível, leitura sempre visível em toque | todos os de gráfico | **Média** | F2–F7 |
| **F9** | Gráfico mês a mês e carga (abre vs. fecha) | 2 arquivos novos | **Alta** | F5, F6 |

### 7.2 Ordem recomendada

```
F1 → F4 → F2 → F3 → F7 → F5 → F6 → F8 → F9
        └── cedo: destrava tudo   └── F8 antes de F9: não acumular dívida de a11y
```

**Racional:** F4 é barata e destrava F2/F3. F8 (acessibilidade) vem **antes** da
última fase de features de propósito — dívida de a11y acumulada nunca é paga depois.

### 7.3 Dependências e riscos

| item | risco | mitigação |
|---|---|---|
| Descoberta `horario` | `HabitLog` **não guarda hora**, só `date`. Não é implementável hoje. | Ou acrescentar `createdAt` ao `HabitLog` (migração de dado, retroativo impossível), ou **cortar** a descoberta. Recomendo cortar na F6 e reavaliar. |
| Janela variável (F5) | `descobertas.ts` tem pisos de amostra calibrados para ~100 dias. Em janela de 7d quase nada passa. | Pisos passam a ser relativos ao tamanho da janela; abaixo de 30d, a seção de descobertas mostra aviso em vez de sumir. |
| `NumeroRolante` | animar número a cada re-render causa tremor. | Anima só na primeira montagem (`useRef` de "já animou"). |
| Grade de 12 colunas | Tailwind não compila classe dinâmica. | Classes literais (`md:col-span-7`), nunca `` `col-span-${n}` ``. |
| Contraste da grade de fósforo | linha a 1px sobre card escuro pode sumir ou brigar com a barra. | Testar com `opacity` entre 0.04 e 0.07; a barra tem `z-index` acima. |

### 7.4 Verificação

O projeto **não tem framework de teste** (sem vitest/jest, zero `*.test.*`).
Verificação por fase:

1. `npm run build` (`tsc -b && vite build`) — nunca `tsc --noEmit`, o tsconfig raiz tem `files: []`.
2. `npx oxlint src/` — zero aviso novo nos arquivos tocados.
3. Navegador com dados semeados: estrutura, ordem de seções, seções vazias ocultas, hover, e **caso de amostra mínima** (3 registros) para confirmar que nada é inventado.
4. `resize_window` em 375 / 768 / 1280 para conferir a reordenação mobile.

Adicionar vitest é uma decisão à parte; se entrar, `lib/descobertas.ts` é o melhor
primeiro alvo — é função pura e concentra a lógica que pode mentir para o usuário.

---

## 8. Guia de estilo do Dashboard

### 8.1 Tokens

```css
/* Cor — usar SEMPRE var(), nunca hex em componente */
--color-bg-primary    #0a0812   página
--color-bg-card       #16112a   bloco
--color-bg-card-hover #1e1738   bloco em hover
--color-bg-input      #0f0b1c   trilho de barra
--color-border        #2b2145   fio, hairline
--color-border-light  #3f3163   borda acesa
--color-accent        #a855f7   dado primário
--color-accent-light  #c88cff   pico, ponta
--color-success       #3ddc97   positivo
--color-danger        #ff4d8d   negativo
--color-warning       #ffb000   atenção
--color-info          #38bdf8   série secundária
--color-fosforo-grade rgba(168,85,247,.055)   NOVO
--color-tubo-vinheta  rgba(0,0,0,.45)         NOVO
```

| categoria | valores |
|---|---|
| **Raio** | `2px` marca de dado · `3px` barra · `8px` controle · `12px` bloco. **Célula de mapa/pixel: 0.** |
| **Borda** | `1px solid var(--color-border)`. Bloco em destaque: topo em `color-mix(in oklab, var(--color-accent) 40%, var(--color-border))` |
| **Espaço** | `gap-2` entre barras · `gap-4` entre blocos · `p-4 md:p-5` dentro do bloco · `space-y-5` na página |
| **Sombra** | **nenhuma em dado.** Bloco em destaque: `0 0 0 1px color-mix(in oklab, var(--color-accent) 30%, transparent)` |
| **Brilho** | `.glow` só em chrome. Rótulo aceso: `text-shadow: 0 0 10px color-mix(in oklab, var(--cor) 60%, transparent)` |
| **Opacidade de dado** | `1` aceso · `0.5` repouso (via `color-mix(… 50%, transparent)`) · `0.4` trilho |

### 8.2 Como o arcade se manifesta, elemento a elemento

| elemento | manifestação arcade | limite |
|---|---|---|
| Título de bloco | Press Start 2P, caixa alta, cor de destaque, fio até a borda | 0.45rem — maior vira paredão |
| Marquise | scanlines + vinheta + número em bitmap 1.6rem | **único** lugar com scanlines |
| Bloco em destaque | cantoneiras nos 4 cantos + borda de topo tingida | decorativo, `aria-hidden` |
| Barra | cor sólida a 50%, fecha em cheio no hover | sem gradiente, sem glow, sem raio no topo |
| Trilho | `bg-bg-input/40`, retangular | marca o lugar; nunca some |
| Rótulo de eixo | bitmap 0.4rem, acende na cor no hover | vira o valor no hover |
| Número do placar | bitmap 0.8rem + unidade 0.45rem em `muted` | duração usa `formatarDuracaoCurta` (`2h10`), nunca a forma longa |
| Frase de descoberta | VT323 16px, `text-secondary` | ≥ 15px sempre |
| Delta | 10px, `tabular-nums`, sinal explícito | cor **nunca** sozinha |
| Fundo de bloco | grade de fósforo a 1px / 24px | `opacity ≤ 0.07` |

### 8.3 Anti-padrões

| não faça | porque |
|---|---|
| `crt-scanlines` num gráfico | a listra altera a área percebida da barra |
| `.glow` numa barra | o brilho vaza para a barra vizinha e falseia a comparação |
| Hex literal em componente | quebra o `.tube-amber` e qualquer tema futuro |
| `:hover` em CSS para cor de dado | `color-mix()` com variável de tema não resolve de forma confiável em `:hover`; o app usa estado do React |
| Classe Tailwind dinâmica | não compila; usar literal ou `style` |
| Medalha, troféu, XP, nível, confete | gamificação — proibida pelo princípio do projeto |
| Emparelhar gráfico com lista | alturas diferentes deixam a linha torta com vão embaixo |
| Número grande sem denominador | `24` não diz nada; `24 de 30` diz |

---

## 9. Critérios de aceite

O redesign está pronto quando:

1. Um usuário novo identifica **em menos de 3 segundos** qual é o número mais importante da tela.
2. Nenhuma seção renderiza vazia, em nenhum estado de dado.
3. Com 3 registros, a tela **não afirma** nenhuma correlação.
4. Todo dado é legível com `prefers-reduced-motion: reduce` e sem cor (teste em escala de cinza).
5. Em 375px, a primeira coisa abaixo da marquise é uma descoberta — não um número.
6. `npm run build` e `npx oxlint src/` limpos, sem aviso novo.
7. Nenhum hex literal novo em componente; nenhum efeito de tubo sobre marca de dado.
