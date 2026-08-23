# Testes manuais

Três arquivos que rodam no console do navegador, com o app aberto em
`http://localhost:5173`. Ficam fora de `src/` e de `public/`, então não
entram no build.

## Como carregar

Cole no console:

```js
for (const f of ['semear', 'auditar', 'fuzz']) {
  const r = await fetch(`/@fs/E:/evolution/testes/${f}.js?v=` + Date.now());
  (0, eval)(await r.text());
}
```

## `semear.js` — dados de mentira

```js
semear('realista')   // meses de histórico em todas as telas
semear('vazio')      // tudo zerado
semear('unico')      // exatamente um registro de cada
semear('volume')     // 25 hábitos, 200 biscoitos, 150 produtos, 120 ações
semear('extremo')    // texto gigante, emoji, HTML, número fora de faixa
semear('legado')     // esquema antigo, sem os campos novos
limparDados()        // apaga tudo
```

## `auditar.js` — varredura das 8 páginas

```js
await auditar()
```

Procura tela branca, erro de console, rolagem lateral, texto quebrado
(`NaN`, `Invalid Date`, `[object Object]`) e alvo de toque pequeno demais.

A medição do alvo de toque usa `elementFromPoint`, não a caixa do
elemento — é a única forma de enxergar a área ampliada por
`.alvo-toque`, que é um pseudo-elemento.

## `fuzz.js` — usuário mais rápido que a animação

```js
await fuzz()
```

Nove testes: clique repetido, sair da página no meio da animação de
saída, concluir tudo em rajada, desfazer, abrir e fechar modal em
sequência, salvar com nome vazio, navegar em rajada, marcar hábito
repetidamente, e esvaziar o grupo que está filtrado.

## Achado conhecido, deixado de propósito

O quadradinho de dia da semana na tela Hábitos tem 20x20 visuais e
23x31 de área de toque. O passo da grade é 24px: crescer mais faria o
toque cair no dia vizinho, que é pior do que o alvo pequeno.
