# Anti-hábitos — o que se quer parar

**Data:** 2026-09-13
**Estado:** desenho aprovado, em implementação

## O que é

Hábitos ao contrário: coisas que a pessoa quer **deixar** de fazer. Sem
youtube, sem rede social, sem café, sem jogo — exatamente a lista que já
está cravada no modal da Missão, na aba Hoje, e que até agora era só um
lembrete sem acompanhamento nenhum.

## O gesto é o mesmo, a leitura é que inverte

Decidido na conversa: **confirmar cada dia limpo**, e não registrar
recaídas. Marcar continua significando "coisa boa aconteceu", igual aos
hábitos de hoje, então o gesto, o armazenamento e a faixa de sete dias não
mudam em nada.

O que muda é a unidade da sequência. Hábito normal conta **semanas que
bateram a frequência**; anti-hábito conta **dias limpos seguidos**, que é
o número que importa para quem está largando algo.

A alternativa era só registrar a queda e deixar o silêncio significar
limpo — menos trabalho diário, mas o silêncio também é o que acontece
quando a pessoa some do app, e aí o número mente para cima. Confirmar
custa um toque por dia e o número passa a valer o que diz.

## Modelo

Um campo em `Habit`:

```ts
tipo?: 'fazer' | 'evitar'
```

Ausente = hábito normal, então **nenhuma migração**: todo dado que já
existe continua válido e se comporta como antes.

Ao criar um `evitar`, grava também `frequency: 7` e todos os dias em
`preferredDays`. Isso não é enfeite — é o que faz o resto do app
continuar certo de graça: `trajetorias()` em `evolucao.ts` usa
`h.frequency` como meta da semana, e com 7 uma semana limpa dá 100%.
Dashboard e cálculo de evolução funcionam sem uma linha de mudança.

### Por que não entidade separada

Considerada e descartada. Modelo mais limpo, sem campos mortos — e ao
preço de duplicar marcar, somar, ordenar e sincronizar, além de obrigar a
aba Hoje a juntar duas fontes. Muito código para o mesmo comportamento.

### Por que não só convenção

Um hábito chamado "Sem café" com frequência 7 não custaria nada, mas o app
não conseguiria distinguir — sem seção própria e sem número próprio, que
é justamente o que se quer.

## A conta de dias limpos

`diasLimpos(logs, habitId, criadoEm, hoje)` — pura, anda para trás:

1. **Hoje só conta se já estiver marcado.** O dia não acabou, e um hoje em
   branco não pode ler como queda — senão a sequência zera toda manhã.
2. De ontem para trás, cada dia marcado soma um.
3. O primeiro dia sem marca para a conta.
4. Para também na data de criação: um anti-hábito criado há três dias não
   mostra cem.

Marcar para trás continua valendo, pela faixa da semana. É assim que se
conserta um dia esquecido — e é o que impede o esquecimento de virar uma
queda falsa permanente.

## Onde aparece

**Aba Hoje:** seção "Evitar", abaixo de Hábitos. Cartão com o número
grande de dias limpos e a faixa de sete dias.

**Página Hábitos:** ao criar, escolhe entre "Fazer" e "Evitar". Para
`evitar`, o formulário esconde frequência, dias preferidos e meta diária —
não significam nada ali. A lista ganha a mesma separação por seção.

## O que fica de fora, de propósito

- **Registro explícito de recaída.** Dia sem marca é queda. É a mesma
  ambiguidade que os hábitos normais já têm, e resolver só para um dos
  dois criaria duas gramáticas no mesmo app.
- **Ligação com o modal da Missão.** O texto de lá é cravado no código de
  propósito, para o combinado não virar rascunho que se negocia numa
  terça difícil.
- **Anti-hábito nos dois cartões de sequência em destaque** do topo da aba
  Hoje. Misturar semanas e dias no mesmo cartão exigiria rótulo de unidade
  e não paga agora.
- **Limite diário** ("até 1 café", "até 30min de rede"). Foi oferecido e
  recusado: a meta é zero.

## Testes

`diasLimpos` é pura, então vai para `scripts/testar-anti-habitos.mjs`,
dentro do `npm run testar`:

- nunca marcado
- marcado hoje
- hoje em branco, ontem marcado (não pode zerar)
- buraco no meio
- dia anterior à criação
- preenchimento retroativo de um dia esquecido
