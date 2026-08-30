# Histórias — a prática de colecionar momentos

**Data:** 2026-08-30
**Estado:** desenho aprovado, em implementação

## De onde vem

Da "Homework for Life", de Matthew Dicks. A prática é simples e a disciplina
é tudo: **toda noite**, reflita sobre o dia e pergunte *"se eu tivesse que
contar uma história de cinco minutos sobre hoje, qual seria o momento?"* — por
mais banal que ele pareça. Escreva uma ou duas frases. Só isso.

O que ela produz, segundo quem faz: uma lente que passa a enxergar momentos
onde antes só havia rotina, a sensação de que os dias param de escorrer, e um
acervo ao qual se pode voltar.

## Por que NÃO é o Pote de Biscoitos

As duas guardam data + texto curto, e por isso a tentação de fundir é grande.
Seria um erro:

| | Pote de Biscoitos | Histórias |
|---|---|---|
| O que entra | o que te dá força na dúvida | o momento mais "história" do dia |
| Curadoria | só o que vale guardar | **tudo**, inclusive o banal |
| Ritmo | quando acontece | **todo dia** |

"Andei com a cachorra na chuva de cueca às 2 da manhã" é uma entrada perfeita
de Histórias e não é um biscoito — não dá força nenhuma. Misturadas, o pote
enche de banalidade e para de servir ao que serve.

**Convivem na mesma aba, em sub-abas separadas**, com dados e telas próprios.
É vizinhança, não fusão.

## O que muda no Pote

O formulário de registrar é um cartão sempre aberto — textarea de três linhas,
campo de categoria em largura cheia, botão e a dica do Ctrl+Enter. São uns
180px empurrando os biscoitos para baixo mesmo de quem só quer ler.

Passa a **colapsar**: fechado é uma linha. Ao focar, cresce para o textarea, a
categoria, o botão e os atalhos de categoria já usadas. A dica do Ctrl+Enter
aparece só enquanto se escreve, que é quando ela serve.

## Histórias

### Dado

Chave nova `evo_historias`, e **em `CHAVES_SINCRONIZADAS`** — esquecer essa
linha grava local e nunca sobe, que é a falha silenciosa clássica deste
projeto.

```ts
export interface Historia {
  id: string;
  /** 'YYYY-MM-DD' — o dia a que a história pertence. */
  data: string;
  /** Uma ou duas frases. É snippet, não texto longo. */
  texto: string;
  createdAt: string;
}
```

Mais de uma por dia é permitido: o Dicks mostra dias com dois itens.

### Tela — fita de filme

Escolhido entre três desenhos, olhando os três lado a lado.

Cada dia é um **quadro numa fita**, com as perfurações desenhadas nas laterais.
A metáfora é direta: são momentos capturados. Data em micro-caixa-alta arcade
no topo do quadro, texto em fonte de terminal.

Acima da fita, nesta ordem: a **sequência de dias seguidos** e o **campo de
hoje**.

### A sequência

Conta dias consecutivos com pelo menos uma entrada.

**Regra que importa:** se ainda não há entrada de hoje, a contagem parte de
ONTEM. A prática é de escrever à noite — sem isso, às 15h a tela diria que a
sequência quebrou, punindo quem ainda vai cumprir o ritual.

## Lógica e teste

`src/lib/historias.ts`, sem imports, testável no `node` como os outros quatro:

- `sequencia(historias, hoje)` → dias seguidos
- `agruparPorDia(historias)` → `[{ dia, itens }]`, mais novo primeiro

Contagem de dias seguidos erra por um dia em virada de mês, ano bissexto e
fuso — invisível na tela, óbvio num teste. Casos: vazio; só hoje; só ontem;
buraco no meio; duas no mesmo dia contando UM dia; virada de mês e de ano.

## Fora de escopo

- Lembrete/notificação à noite
- Exportar as histórias
- Marcar uma história como "vira biscoito"
- Busca — entra quando houver volume que a justifique
