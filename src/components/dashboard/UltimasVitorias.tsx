import type { CookieJarEntry } from '../../types';
import { formatarData } from '../../lib/data';

/**
 * As últimas vitórias escritas no Pote de Biscoitos.
 *
 * O único bloco do painel que não é número, e provavelmente o que mais
 * convence: nenhum gráfico prova avanço melhor do que a própria pessoa
 * lendo "terminei o curso que travei três vezes", escrito por ela.
 *
 * Mostra o TEXTO, nunca a contagem. Saber que existem 23 vitórias no pote
 * é placar — reler uma delas é o que o pote existe para fazer.
 */
export default function UltimasVitorias({
  entradas, cor,
}: { entradas: CookieJarEntry[]; cor: string }) {
  return (
    <ul className="space-y-3">
      {entradas.map(e => (
        <li key={e.id} className="flex gap-2.5">
          <span className="mt-[3px] w-[3px] flex-shrink-0 rounded-[1px]" style={{ backgroundColor: cor }} />
          <span className="min-w-0 flex-1">
            <span className="font-terminal block break-words text-[16px] leading-[1.35] text-text-primary">
              {e.description}
            </span>
            <span className="font-arcade mt-1 block text-[0.4rem] leading-none text-text-muted">
              {formatarData(e.date, "d 'de' MMM")}
              {e.category && ` · ${e.category}`}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
