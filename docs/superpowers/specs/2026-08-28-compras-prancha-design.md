# Aba Compras: a prancha técnica

**Data:** 2026-08-28
**Estado:** desenho aprovado tela a tela, em implementação
**Antecessor:** [2026-08-28-compras-redesign-design.md](2026-08-28-compras-redesign-design.md)

## Por que uma segunda reforma

A primeira consertou a lógica — a barra que andava para trás virou trilha de
marcos — e trocou as pílulas por uma fita. Mas o veredito foi "não gostei de
nenhuma", "quero mudar tudo", "quero algo único".

O diagnóstico veio disso: **eu vinha desenhando peça por peça** — cartão,
depois categorias, depois barra — e o conjunto virou remendo. Cada parte
defensável, o todo incoerente. E as três alternativas de layout que propus
falhavam pelo mesmo motivo: continuavam roxas, iguais ao resto do app. Eram a
mesma aba rearranjada.

A palavra que destravou foi **"único"**. O app já tem precedente: o Pote de
Biscoitos usa `.tube-amber`, que redefine as variáveis de cor e troca o mundo
daquela aba inteira sem trocar um componente.

## O mundo: planta técnica

Ciano sobre azul-noite, com malha de papel de engenharia ao fundo.

A ideia por trás: **você não está comprando, está projetando a versão de si
que quer ser.** Cada item é uma peça especificada; conquistá-lo é executar o
projeto.

```
--bg-primary   #050b14      --accent        #00d9ff
--bg-card      #0a1725      --accent-light  #7febff
--border       #16324d      --text-primary  #dff0ff
--border-light #22557f      --text-muted    #5c86a8
```

A malha tem **duas escalas** — fina de 22px dentro de grossa de 110px, como
papel de engenharia de verdade. Com uma escala só ela lê como papel de
parede; com duas, como material.

## As regras que carregam significado

Estas não são decoração — substituem UI:

**Tracejado = projetado. Contínuo + hachurado = executado.**

Em desenho técnico o que ainda não foi construído se desenha tracejado, e
corte de material se preenche com hachura diagonal. Item na lista tem borda
tracejada; conquistado vira contínua com hachura leve sobre a foto.

Isso **substitui o selo, o check e a borda colorida** — três mecanismos que
hoje fazem o mesmo trabalho. O estado passa a ser lido pela linha.

**Tolerância no preço: `R$ 2.300 ±400`.**

Prancha cota com tolerância. E resolve um problema real: raramente se sabe o
preço exato do que ainda não se comprou. Hoje o campo obriga um número seco
que finge precisão inexistente. Com tolerância, "por volta de dois mil e
trezentos" vira dado honesto.

## Os elementos, de cima para baixo

### 1. Cabeçalho

`COMPRAS` em fonte arcade, e **um botão só**: "+ Novo item". O botão
"Categorias" sai daqui.

### 2. Faixa de legenda — duas caixas

Substitui o painel de duas colunas que ficou grande e vazio.

```
┌─ EM PROJETO ────┐  ┌─ EXECUTADO ─────┐
│ R$ 4.140        │  │ R$ 2.850        │
│ 5 itens         │  │ 3 itens         │
└─────────────────┘  └─────────────────┘
```

O dinheiro é o número grande e a contagem vira apoio: o que importa é
*quanto*, não *quantos*. Saíram "PRANCHA COMPRAS" (redundante — sabe-se em
que aba se está) e "REVISÃO" (era só o mês corrente).

### 3. Trilha de marcos, desenhada como cota

Mesma lógica de `src/lib/marcos.ts`, sem mudança: 1, 3, 5, 10, 25, 50,
contando o acumulado de sempre. Muda só o desenho — linha fina com traços
perpendiculares nas marcas e uma seta `▼ VOCÊ` na posição atual. Instrumento
de medida, não barra estilizada.

### 4. Categorias como camadas

A fita segmentada ganha um **quadradinho de visibilidade** por segmento, como
camada de CAD — que é literalmente o que o filtro faz.

O último segmento é um **"+"**, no mesmo tratamento dos outros. Ele abre o
modal de categorias que já existe, **inteiro**: cria, renomeia e exclui. O
"+" herda a função do botão que saiu do topo; nada se perde, e continua
funcionando no celular.

Segue rolando de lado com `.rolagem-lateral`, sem quebrar linha.

### 5. "O próximo" como DETALHE A

Prancha desenha o que importa num detalhe ampliado, com uma marca ligando à
origem. O item eleito ocupa uma caixa de destaque com a legenda `DETALHE A` na
borda, foto maior, e a cota do quanto já se guardou.

Um item de cada vez — a mesma filosofia da aba Foco.

### 6. Itens

Grade de três, com as regras de tracejado/hachura acima.

## Modelo

Três campos novos em `ShoppingItem`, todos opcionais — **nenhuma migração**, e
o sync leva de graça porque é por registro:

```ts
/** Tolerância do preço, em reais: 1200 ±200. */
tolerancia?: number;
/** Quanto já foi guardado para este item. */
guardado?: number;
```

E um campo novo em `ShoppingCategory`? Não. A eleição do próximo é **um id
só na lista inteira**, então vive fora do item:

```ts
// chave própria no localStorage, sincronizada como documento inteiro
'evo_shopping_proximo': string | null
```

Guardar como campo booleano no item permitiria dois "próximos" ao mesmo
tempo — um estado que não deve existir. Um id único fora torna isso
impossível por construção.

## Fora de escopo

- **Quadro de revisões / linha do tempo** — foi mostrado e recusado
  explicitamente ("pode remover esse quadro de revisões")
- **Reordenar arrastando** — fica para depois; `reordenar` e `ordenarTarefas`
  de `lib/tarefas.ts` já servem quando for a hora
- **Numeração de peça** (`EQ-004`) e **cota sob cada cartão** — cortadas por
  mim antes de mostrar, por peso visual
- O cartão de produto **muda** nesta reforma, ao contrário da primeira: a
  regra tracejado/hachura exige isso

## Teste

`src/lib/marcos.ts` não muda e seus 23 testes continuam valendo.

Lógica nova testável sem imports, em `src/lib/compras.ts`:

- `faixaDePreco(preco, tolerancia)` → `{ min, max }`, para o total da lista
  virar faixa em vez de número falso
- `totalDaLista(itens)` → soma com tolerância acumulada
- `progressoGuardado(guardado, preco)` → 0 a 1, protegido contra preço zero e
  guardado maior que o preço

O visual verifica-se no navegador por estilo inline — nunca por
`getComputedStyle` em elemento sob transição, que neste ambiente devolve o
valor antigo indefinidamente.
