# Plano de implementação — reforma da aba Compras

**Desenho:** [2026-08-28-compras-redesign-design.md](../specs/2026-08-28-compras-redesign-design.md)
**Data:** 2026-08-28

Oito passos, em ordem. Cada um termina verificável por conta própria — se um
falhar, os anteriores continuam de pé.

---

## Decisão tomada no plano, não no desenho

**O trecho entre marcos enche proporcionalmente.**

Nos mockups o trecho de linha acendia inteiro ao bater o marco. Isso deixaria
a trilha **parada por 25 itens** entre o marco 25 e o 50 — nada se move
enquanto se conquista. Para uma tela cujo pedido foi "algo de progressão",
isso é o oposto do objetivo.

Então o trecho entre `MARCOS[i]` e `MARCOS[i+1]` enche na proporção
`(n − MARCOS[i]) ÷ (MARCOS[i+1] − MARCOS[i])`. O pino só acende ao bater o
marco; a linha se move a cada item.

Se preferir o comportamento do mockup — linha binária —, é uma linha de código
e some.

---

## Passo 1 — `src/lib/marcos.ts`, com teste antes

Sem nenhum import, para rodar no `node` como `registros.ts` e `tarefas.ts`.

```ts
export const MARCOS = [1, 3, 5, 10, 25, 50] as const;

/** O próximo marco a bater. `null` quando já passou do último. */
export function proximoMarco(conquistados: number): number | null;

/** Quantos faltam para o próximo. `null` quando já passou do último. */
export function faltamPara(conquistados: number): number | null;

/** Estado de desenho da trilha: um item por marco. */
export function trilha(conquistados: number): {
  marco: number;
  aceso: boolean;
  /** 0 a 1 — quanto do trecho ATÉ este marco está preenchido. */
  preenchimento: number;
}[];
```

`trilha()` devolve tudo pronto para desenhar, então o componente não faz
conta. É o mesmo padrão de `ordenarTarefas`/`reordenar`.

**Verificação:** `node scripts/testar-marcos.mjs` (passo 2) passa.

## Passo 2 — `scripts/testar-marcos.mjs`

Casos que importam:

| Caso | Espera |
|---|---|
| 0 conquistados | nenhum pino aceso, próximo = 1, preenchimento 0 |
| exatamente 1, 3, 5, 10, 25, 50 | o pino acende; próximo é o seguinte |
| entre marcos (ex: 7) | faltam 3; trecho 10 preenchido em 0,4 |
| 50 | todos acesos, `proximoMarco` = null, `faltamPara` = null |
| acima de 50 (ex: 73) | igual a 50, sem estourar nem voltar |
| **negativo ou NaN** | trata como 0, nunca quebra a tela |

E o teste que prova a correção do defeito de origem:

> **adicionar itens pendentes não muda nada** — `trilha(3)` é idêntica
> independentemente de existirem 6 ou 60 itens na lista, porque a função nem
> recebe o total.

Ligar ao `npm run testar`, junto dos três que já existem.

**Verificação:** `npm run testar` mostra quatro suítes passando. Reverter a
implementação faz os testes falharem.

## Passo 3 — `src/components/compras/TrilhaDeMarcos.tsx`

Recebe `conquistados: number` e nada mais. Desenha com flexbox (nada de
posicionamento absoluto — foi o que quebrou os mockups):

- Um `.mtrecho` por marco, `flex: 1`
- Número do marco em `font-arcade text-[8px]` acima
- Pino de 12px, `rounded-[3px]` — quadrado, como as casas do calendário e as
  bandeiras de prioridade. Nunca círculo.
- Aceso: fundo `--color-accent` + brilho curto. Segue a lição das prioridades:
  brilho discreto, porque numa fileira de seis ele se repete.
- Trecho de 3px preenchido conforme `preenchimento`
- Legenda: `N conquistados · faltam X para o próximo marco`, ou só
  `N conquistados` acima de 50

**Verificação:** renderiza em 0, 1, 7, 25, 50 e 73 sem erro no console.

## Passo 4 — trocar a barra na `ShoppingPage`

- `<BarraEvolucao>` sai, `<TrilhaDeMarcos>` entra
- O número passa a ser **global**: `itens.filter(i => i.completed).length`,
  sem passar por `escopoItens`
- `escopoTotal` e `escopoConquistados` ficam órfãos — remover

**Verificação:** trocar o filtro de categoria **não** altera a trilha. É o
ponto do desenho.

## Passo 5 — `src/components/compras/FitaDeCategorias.tsx`

Uma peça, borda de 2px, `rounded-lg`, dividida por filetes de 1px. Cada
segmento: rótulo em `font-arcade text-[7px]` caixa-alta + contagem. Ativo
ganha fundo `color-mix(in oklab, cor 16%, transparent)` e texto na cor cheia.

Segmentos, nesta ordem: `Todas` → uma por categoria → `Sem categoria` (só
quando existe item sem categoria).

No celular: `overflow-x-auto` com `rolagem-limpa` (a classe já existe no
projeto), **sem** quebrar linha.

O componente serve as duas telas — filtro e formulário — via uma prop
`comContagem`, que o formulário desliga.

**Verificação:** com 2 categorias e com 12; em tela de 375px a fita rola de
lado e não quebra.

## Passo 6 — trocar `Chip` e `ChipCat`

`FitaDeCategorias` entra nos dois lugares. O chip de **"Conquistados" fica
como está**, fora da fita, com o check verde — não é categoria, é modo de ver.

**Verificação:** filtrar por categoria e por "Conquistados" segue funcionando;
criar item com categoria também.

## Passo 7 — varrer o que morreu

Depois dos passos acima ficam sem uso em `ShoppingPage.tsx`:
`BarraEvolucao`, `Chip`, `ChipCat`, `frase()`, `pctConquistado()`,
`MAX_BLOCOS`.

Remover, e conferir com `npx oxlint` que não sobrou import órfão.

**Verificação:** `npm run typecheck`, `npm run build` e `oxlint` limpos. O
arquivo encolhe — é o ganho colateral de extrair os dois componentes.

## Passo 8 — verificar no navegador

Semear itens de teste e conferir, medindo por `getComputedStyle` (screenshot
não funciona nesta sessão):

1. Trilha em 0, entre marcos, em cima de um marco, e acima de 50
2. **Adicionar item pendente não move a trilha** — o defeito que originou tudo
3. Trocar filtro de categoria não move a trilha
4. Fita com poucas e com muitas categorias; rolagem lateral em 375px
5. Marcar item como conquistado avança a trilha na hora
6. Console sem erros

Limpar os dados de teste do `localStorage` ao terminar.

---

## Ordem de commit

Um commit por bloco coerente, não um por passo:

1. Passos 1–2 — a lógica e seus testes
2. Passos 3–4 — a trilha na tela
3. Passos 5–6 — a fita nas duas telas
4. Passo 7 — a limpeza

Assim cada commit é revisável sozinho, e a lógica entra com teste desde o
primeiro.
