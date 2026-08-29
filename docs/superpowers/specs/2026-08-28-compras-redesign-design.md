# Reforma da aba Compras

**Data:** 2026-08-28
**Estado:** desenho aprovado, aguardando plano de implementação

## O que a aba é

Não é lista de compras. Nas palavras do dono do app:

> "eu criei, como forma de colocar coisas, nas quais, me aproximam da minha
> melhor versão a cada item que coloco e compro lá"

É uma lista de **equipamento para virar quem se quer ser**. O cabeçalho já
dizia "Rumo à sua melhor versão" — a intenção sempre esteve lá; o que falha é
a execução.

## O problema

O relato foi "não gostei", "achei muito ruim", "as categorias também achei
feias", e "queria algo de progressão". Investigando, dois defeitos concretos:

### 1. A barra de progresso pune quem quer mais

`BarraEvolucao` mostra `conquistados ÷ (pendentes + conquistados)`. Como o
denominador inclui o que ainda falta comprar, **adicionar um desejo novo
derruba a porcentagem**: 3 de 6 é 50%; some um sétimo item e vira 43%.

Numa página chamada "Rumo à sua melhor versão", sonhar mais alto faz a barra
andar para trás. É o defeito de origem, e provavelmente a maior parte do
desconforto.

### 2. As categorias não pertencem a este app

O `Chip` é pílula `rounded-full`, texto `text-sm`, contagem em cinza — chip
genérico de web. O resto do app é quadrado, de fonte `Press Start 2P`, com
cores de fósforo. As categorias destoam de tudo à volta.

## O que NÃO muda

Decidido olhando mockups lado a lado, com as cores e fontes reais do app:

- **O cartão do produto fica exatamente como está.** Foto grande como banner,
  preço, categoria, sombra, elevação no hover. Foram testadas três variações
  (fileira compacta, cartão arcade, e o atual) e a escolha foi o atual.
- **Não entra campo novo.** Foram desenhadas duas versões com um campo
  "porquê" (*o que isto muda em mim*) e uma com "tempo de desejo"
  (*querendo há 3 meses*). Ambas foram recusadas. Nenhuma mudança no tipo
  `ShoppingItem`, nenhuma migração.
- **Categorias continuam sendo do usuário**, com nome, cor e ícone que ele já
  escolhe. Só o desenho do seletor muda.
- **"Conquistado" continua existindo** igual, com o carimbo animado. Adquirir
  faz parte do propósito da aba.
- Preço, foto, link e observação seguem como estão.

## As duas mudanças

### A. Trilha de marcos no lugar da barra de fração

Substitui `BarraEvolucao`.

**Marcos:** 1, 3, 5, 10, 25, 50 itens conquistados.

**Desenho:** uma linha horizontal com um pino por marco. Pino conquistado
acende na cor de destaque com brilho; o trecho de linha entre dois pinos
acesos também acende. Acima de cada pino, o número do marco em fonte arcade.

**Regras que definem o comportamento:**

1. **Conta o acumulado de sempre**, não uma fração. O número de itens
   conquistados só sobe. Adicionar um desejo novo não mexe na trilha — é a
   correção do defeito nº 1.
2. **É global, não segue o filtro de categoria.** Hoje a barra muda quando se
   filtra por categoria. A trilha não: o progresso é da pessoa, não da
   prateleira, e uma trilha que muda ao clicar num filtro não é uma trilha.
3. **Passando de 50**, a trilha fica cheia e o contador continua subindo. Não
   há escada infinita: 50 itens é distante o bastante para essa decisão não
   valer código hoje.
4. **Legenda:** "N conquistados · faltam X para o próximo marco". Passando de
   50, só "N conquistados".
5. **Some a porcentagem e somem as frases** de `frase()` — elas descrevem
   fração de lista, que deixa de existir.

O total investido (soma dos preços dos conquistados) **não** entra nesta
versão: foi mostrado no mockup C e a escolha foi a trilha sozinha.

### B. Categorias em fita segmentada

Substitui a fileira de `Chip`.

**Desenho:** uma peça só, com borda de 2px e cantos de 8px, dividida em
segmentos por filetes verticais. Cada segmento traz o rótulo em `Press Start
2P` micro-caixa-alta e a contagem ao lado. O segmento ativo ganha fundo na cor
da categoria (`color-mix` a ~16%) e o texto na cor cheia.

**Quais segmentos a fita tem, nesta ordem:**

1. "Todas", com a contagem de pendentes
2. Um por categoria do usuário, na cor dela
3. "Sem categoria", **só quando existe algum item sem categoria** — é o
   comportamento de hoje e continua

**Ressalva de layout:** com muitas categorias a fita aperta. No celular ela
**rola de lado** em vez de quebrar linha — quebrar destruiria a leitura de
"peça única" que é o ponto do desenho.

O chip de "Conquistados" fica **fora** da fita, separado como hoje: ele não é
uma categoria, é um modo de ver. Mantém o visual de hoje, com o check verde.

O `ChipCat` do formulário (escolher categoria ao criar item) segue o mesmo
tratamento visual, para as duas telas não divergirem.

## Arquivos

| Arquivo | O quê |
|---|---|
| `src/pages/ShoppingPage.tsx` | 1065 linhas hoje. Sai `BarraEvolucao`, sai `Chip`, entram os dois componentes novos |
| `src/components/compras/TrilhaDeMarcos.tsx` | **novo** — a trilha |
| `src/components/compras/FitaDeCategorias.tsx` | **novo** — a fita, usada no filtro e no formulário |
| `src/lib/marcos.ts` | **novo** — sem imports, testável no node: marcos, qual o próximo, quanto falta |
| `scripts/testar-marcos.mjs` | **novo** — ligado ao `npm run testar` |

`ShoppingPage.tsx` está grande; extrair estes dois componentes a encolhe em
vez de engordá-la, que é o mesmo caminho já usado no `FocusPage`.

## Teste

A lógica de marcos vai para `src/lib/marcos.ts` sem nenhum import, testada no
`node` como `registros.ts` e `tarefas.ts`. Casos que importam:

- 0 conquistados: nenhum pino aceso, próximo marco é 1
- exatamente num marco (1, 3, 5, 10, 25, 50): o pino acende, o próximo é o
  seguinte
- entre marcos: quantos faltam para o próximo
- acima de 50: trilha cheia, sem "faltam X"
- **o teste que prova a correção:** adicionar itens pendentes não altera nada
  do que a trilha mostra

O visual é verificado no navegador: fita com poucas e com muitas categorias,
trilha em 0, em cima de um marco, entre dois, e acima de 50.

## Fora de escopo

Levantados durante a conversa e deliberadamente deixados de fora:

- Campo "porquê" por item — recusado nos mockups
- Tempo de desejo ("querendo há 3 meses") — recusado nos mockups
- Ligar itens às frentes de foco no lugar das categorias
- Total investido no cabeçalho
- Mexer no filtro de período (mês/ano/tudo), que segue filtrando a lista de
  conquistados como hoje
