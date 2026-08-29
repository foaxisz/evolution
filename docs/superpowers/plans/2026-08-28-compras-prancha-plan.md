# Plano — aba Compras como prancha técnica

**Desenho:** [2026-08-28-compras-prancha-design.md](../specs/2026-08-28-compras-prancha-design.md)

Sete passos, quatro commits. A ordem é do fundo para a frente: o mundo
primeiro, porque tudo depois é desenhado dentro dele.

---

## Passo 1 — O mundo

`.prancha` em `src/index.css`, no molde do `.tube-amber` que já existe:
redefine as variáveis de cor da subárvore. Mais a malha de duas escalas
(22px dentro de 110px) como `background-image` da página.

Aplicar a classe no contêiner raiz da `ShoppingPage`.

**Verificação:** a aba inteira muda de cor sem que nenhum componente saiba
disso — é o teste de que a técnica do `.tube-amber` funciona aqui.

## Passo 2 — Lógica pura + testes

`src/lib/compras.ts`, sem imports, node-testável:

```ts
export function faixaDePreco(preco?: number, tolerancia?: number):
  { min: number; max: number } | null;
export function totalDaLista(itens: {preco?: number; tolerancia?: number}[]):
  { min: number; max: number };
export function progressoGuardado(guardado?: number, preco?: number): number;
```

Casos: sem preço, sem tolerância, tolerância maior que o preço (piso em 0),
guardado acima do preço (teto em 1), preço zero (divisão), NaN.

`scripts/testar-compras.mjs`, ligado ao `npm run testar`.

## Passo 3 — Faixa de legenda

`src/components/compras/FaixaDeLegenda.tsx`. Duas caixas, dinheiro grande,
contagem de apoio. Substitui o grid de duas colunas e o filtro de período
(que sai junto — era parte do desequilíbrio).

**Verificação:** com lista vazia não mostra traços; mostra zero honesto.

## Passo 4 — Trilha como cota

Reestilizar `TrilhaDeMarcos`: traços perpendiculares, linha fina, seta
`▼ VOCÊ`. **A lógica de `marcos.ts` não muda** — só o desenho.

**Verificação:** os 23 testes de marcos continuam passando sem alteração.

## Passo 5 — Camadas + "+"

Em `FitaDeCategorias`: quadradinho de visibilidade por segmento, e um
segmento final "+" que abre o modal de categorias existente (criar, renomear,
excluir — inteiro). Remover o botão "Categorias" do cabeçalho.

**Verificação:** criar, renomear e excluir categoria seguem funcionando pelo
"+"; a fita ainda rola de lado em 375px.

## Passo 6 — Cartões: tracejado, hachura, tolerância

- Pendente: `border-style: dashed`
- Conquistado: `solid` + hachura diagonal sobre a foto
- Sai o selo/check de estado — a linha passa a contar
- Preço com `±tolerancia` quando houver
- Campo de tolerância no formulário, ao lado do preço

**Verificação:** os dois estados lado a lado, e um item sem tolerância não
mostra `±`.

## Passo 7 — DETALHE A

`src/components/compras/DetalheDoProximo.tsx`. Caixa com legenda na borda,
foto maior, valor guardado e barra.

Eleger: no menu de contexto do cartão, ou num botão do próprio cartão — a
decidir na hora de construir, com o que ficar menos poluído.

Guardar dinheiro: campo no formulário do item.

O id eleito vive em `evo_shopping_proximo`, chave própria, sincronizada como
documento inteiro. **Adicionar à lista `CHAVES_SINCRONIZADAS`** em
`sincronizacao.ts`, senão não sobe.

**Verificação:** eleger um item, ver o detalhe aparecer; eleger outro
substitui o primeiro (nunca dois); conquistar o eleito limpa a eleição.

---

## Commits

1. Passos 1–2 — mundo e lógica
2. Passos 3–4 — legenda e cota
3. Passos 5–6 — camadas e cartões
4. Passo 7 — o próximo

## Risco conhecido

O passo 7 é o único que mexe na sincronização. Uma chave nova fora de
`CHAVES_SINCRONIZADAS` grava local e nunca sobe — falha silenciosa, do tipo
que já custou dias neste projeto. Conferir explicitamente.
