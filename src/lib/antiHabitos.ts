/**
 * A conta dos anti-hábitos: há quantos dias seguidos se passou limpo.
 *
 * Sem imports, como os outros `lib` daqui: roda no `node` direto.
 *
 * Hábito normal conta SEMANAS que bateram a frequência — perder uma
 * terça não quebra nada se a semana fecha. Largar alguma coisa não
 * funciona assim: o que importa é há quanto tempo não se cai, e um dia
 * conta. Por isso a unidade aqui é dia, e não semana.
 */

/** O mínimo de um registro para esta conta. */
export interface RegistroDeDia {
  habitId: string;
  /** YYYY-MM-DD */
  date: string;
  completed: boolean;
}

/** Um dia para trás, em YYYY-MM-DD. Meio-dia local para fuso nenhum
 *  empurrar a data para o dia anterior. */
function diaAnterior(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Dias limpos seguidos até `hoje`.
 *
 * HOJE SÓ CONTA SE JÁ ESTIVER MARCADO, e esta é a regra que faz o número
 * ser usável: o dia não acabou, então um hoje em branco não é uma queda —
 * é um dia em andamento. Sem isso a sequência zeraria toda manhã e
 * voltaria ao normal à noite, o que não mede nada.
 *
 * A conta para na data de criação: um anti-hábito criado há três dias não
 * pode mostrar cem, e sem esse piso a volta para trás não teria fim.
 *
 * `criadoEm` aceita o ISO completo que o `Habit` guarda; só a parte da
 * data é usada.
 */
export function diasLimpos(
  logs: readonly RegistroDeDia[],
  habitId: string,
  criadoEm: string,
  hoje: string,
): number {
  const marcados = new Set(
    logs.filter(l => l.habitId === habitId && l.completed).map(l => l.date)
  );
  if (marcados.size === 0) return 0;

  const nascimento = criadoEm.slice(0, 10);

  // Hoje entra na conta só se marcado; senão a contagem começa ontem.
  let cursor = marcados.has(hoje) ? hoje : diaAnterior(hoje);

  let dias = 0;
  while (cursor >= nascimento && marcados.has(cursor)) {
    dias++;
    cursor = diaAnterior(cursor);
  }
  return dias;
}
