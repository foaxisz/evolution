import type { ShoppingItem } from '../../types';
import { totalDaLista, faixaExata, porMes, recordes, type Faixa } from '../../lib/compras';
import Modal from '../ui/Modal';

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function escrever(f: Faixa): string {
  if (faixaExata(f)) return moeda(f.min);
  return `${moeda(f.min)} – ${moeda(f.max).replace(/^R\$\s?/, '')}`;
}

/** 'YYYY-MM' → 'ago' / 'ago 25' quando o ano não é o corrente. */
function rotuloDoMes(mes: string, anoAtual: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const nome = MESES_CURTOS[m - 1] ?? '?';
  return ano === anoAtual ? nome : `${nome} ${String(ano).slice(2)}`;
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="font-arcade mb-3 text-[0.5rem] uppercase leading-none tracking-[0.06em] text-text-muted">
        {titulo}
      </p>
      {children}
    </section>
  );
}

/**
 * O relatório da aba Compras.
 *
 * Três blocos, nesta ordem: o dinheiro, o ritmo e os recordes. As contas
 * ficam todas em `lib/compras.ts`, sem imports e testadas no node — erro em
 * soma de dinheiro ou em recorte de mês é invisível na tela e óbvio num
 * teste, e este componente não faz uma conta sequer.
 */
export default function RelatorioDeCompras({
  aberto, itens, hoje, onFechar,
}: {
  aberto: boolean;
  itens: ShoppingItem[];
  /** 'YYYY-MM-DD'. Vem de fora para o relatório ser testável e determinístico. */
  hoje: string;
  onFechar: () => void;
}) {
  const conquistados = itens.filter(i => i.completed);
  const pendentes = itens.filter(i => !i.completed);

  const investido = totalDaLista(conquistados);
  const emAberto = totalDaLista(pendentes);

  const linha = porMes(itens, hoje, 12);
  const pico = Math.max(1, ...linha.map(m => m.quantidade));
  const anoAtual = Number(hoje.slice(0, 4));

  const r = recordes(itens, hoje);
  const temRecorde = r.maisCaro || r.melhorMes || r.esperaMaisLonga;

  return (
    <Modal isOpen={aberto} onClose={onFechar} title="Relatório" maxWidth="max-w-lg">
      <div className="space-y-7">

        <Bloco titulo="Dinheiro">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { rot: 'Investido em você', valor: investido, aceso: true, n: conquistados.length },
              { rot: 'A lista custa', valor: emAberto, aceso: false, n: pendentes.length },
            ].map(c => (
              <div
                key={c.rot}
                className="rounded-md border-solid px-3.5 py-3"
                style={{
                  borderWidth: 1,
                  borderColor: c.aceso
                    ? 'color-mix(in oklab, var(--color-accent) 45%, transparent)'
                    : 'var(--color-border)',
                  backgroundColor: 'var(--color-bg-input)',
                }}
              >
                <p className="font-arcade text-[0.45rem] uppercase leading-none text-text-muted">{c.rot}</p>
                <p
                  className="font-arcade mt-2.5 text-[0.95rem] leading-none"
                  style={{ color: c.aceso ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
                >
                  {escrever(c.valor)}
                </p>
                <p className="mt-2 text-[11px] text-text-muted">
                  {c.n} {c.n === 1 ? 'item' : 'itens'}
                </p>
              </div>
            ))}
          </div>
        </Bloco>

        <Bloco titulo="Últimos 12 meses">
          {/* Barras de altura proporcional ao pico. Mês vazio mantém um fio de
              2px em vez de sumir: uma coluna ausente lê como "não houve mês",
              e o que houve foi um mês sem conquista. */}
          <div className="flex h-24 items-end gap-1">
            {linha.map(m => (
              <div key={m.mes} className="flex flex-1 flex-col items-center gap-1.5" title={`${m.quantidade} em ${m.mes}`}>
                <span
                  className="w-full rounded-[1px] transition-[height] duration-500"
                  style={{
                    height: m.quantidade > 0 ? `${Math.max(8, (m.quantidade / pico) * 76)}px` : '2px',
                    backgroundColor: m.quantidade > 0 ? 'var(--color-accent)' : 'var(--color-border)',
                    boxShadow: m.quantidade > 0
                      ? '0 0 6px color-mix(in oklab, var(--color-accent) 40%, transparent)'
                      : undefined,
                  }}
                />
                <span className="font-arcade text-[0.4rem] leading-none text-text-muted">
                  {rotuloDoMes(m.mes, anoAtual)}
                </span>
              </div>
            ))}
          </div>
        </Bloco>

        <Bloco titulo="Recordes">
          {!temRecorde ? (
            <p className="text-xs text-text-muted">
              Ainda não há recorde. Eles aparecem quando você conquista o primeiro item.
            </p>
          ) : (
            <dl className="space-y-2.5">
              {[
                r.maisCaro && { k: 'O mais caro', v: r.maisCaro.nome, extra: moeda(r.maisCaro.valor) },
                r.melhorMes && {
                  k: 'Melhor mês', v: rotuloDoMes(r.melhorMes.mes, anoAtual),
                  extra: `${r.melhorMes.quantidade} ${r.melhorMes.quantidade === 1 ? 'item' : 'itens'}`,
                },
                r.esperaMaisLonga && {
                  k: 'Espera mais longa', v: r.esperaMaisLonga.nome,
                  extra: r.esperaMaisLonga.dias === 0 ? 'entrou hoje' : `há ${r.esperaMaisLonga.dias} dias`,
                },
              ].filter(Boolean).map(l => (
                <div key={l!.k} className="flex items-baseline gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0">
                  <dt className="font-arcade w-32 flex-shrink-0 text-[0.45rem] uppercase leading-none text-text-muted">
                    {l!.k}
                  </dt>
                  <dd className="font-terminal min-w-0 flex-1 truncate text-[17px] leading-none text-text-primary">
                    {l!.v}
                  </dd>
                  <span className="font-arcade flex-shrink-0 text-[0.5rem] leading-none text-accent-light">
                    {l!.extra}
                  </span>
                </div>
              ))}
            </dl>
          )}
        </Bloco>

      </div>
    </Modal>
  );
}
