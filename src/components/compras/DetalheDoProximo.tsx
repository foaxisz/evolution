import { X } from 'lucide-react';
import type { ShoppingItem } from '../../types';
import { progressoGuardado, faltaGuardar, faixaDePreco } from '../../lib/compras';
import HabitIcon from '../ui/HabitIcon';

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/**
 * O item eleito, desenhado como o DETALHE AMPLIADO da prancha.
 *
 * Prancha técnica destaca o que importa num detalhe em escala maior, com uma
 * etiqueta na borda ligando à origem. É o que esta caixa é — e o motivo de a
 * etiqueta ficar montada NA borda, e não dentro: é assim que se marca um
 * detalhe, e é o que a separa de "mais um cartão, só que maior".
 *
 * Um de cada vez, pela mesma razão da aba Foco: eleger dois próximos é não
 * ter eleito nenhum.
 */
export default function DetalheDoProximo({
  item, cor, onAbrir, onSoltar,
}: {
  item: ShoppingItem;
  /** Cor da categoria do item, ou o destaque da aba. */
  cor: string;
  onAbrir: () => void;
  onSoltar: () => void;
}) {
  const foto = item.imageData || item.imageUrl;
  const faixa = faixaDePreco(item.price, item.tolerancia);
  const pct = progressoGuardado(item.guardado, item.price);
  const falta = faltaGuardar(item.guardado, item.price);
  const guardado = item.guardado ?? 0;

  return (
    <div
      className="relative mb-5 flex gap-4 rounded-md border-solid p-4"
      style={{
        borderWidth: 1,
        borderColor: 'var(--color-accent)',
        backgroundColor: 'color-mix(in oklab, var(--color-accent) 5%, transparent)',
      }}
    >
      {/* A etiqueta monta na borda, com o fundo da página por trás para
          "cortar" a linha — é assim que prancha marca um detalhe. */}
      <span
        className="font-arcade absolute -top-[7px] left-3 px-1.5 text-[0.5rem] uppercase leading-none"
        style={{ backgroundColor: 'var(--color-bg-primary)', color: 'var(--color-accent)' }}
      >
        Detalhe A
      </span>

      <button
        type="button"
        onClick={onSoltar}
        aria-label="Deixar de ser o próximo"
        title="Deixar de ser o próximo"
        className="absolute right-2 top-2 text-text-muted transition-colors hover:text-text-primary"
      >
        <X size={13} />
      </button>

      <button
        type="button"
        onClick={onAbrir}
        className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded border-solid"
        style={{ borderWidth: 1, borderColor: 'var(--color-border-light)', backgroundColor: 'var(--color-bg-input)' }}
      >
        {foto
          ? <img src={foto} alt="" className="h-full w-full object-contain p-1" />
          : <HabitIcon name="target" size={30} color={cor} />}
      </button>

      <div className="min-w-0 flex-1">
        <p className="font-arcade text-[0.5rem] uppercase leading-none tracking-[0.06em]" style={{ color: 'var(--color-accent)' }}>
          Próximo a executar
        </p>

        <button type="button" onClick={onAbrir} className="block w-full text-left">
          <p className="font-terminal mt-1.5 truncate text-[22px] leading-[1.15] text-text-primary">
            {item.name}
          </p>
        </button>

        {faixa && (
          <>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-arcade text-[0.85rem] leading-none" style={{ color: 'var(--color-accent)' }}>
                {moeda(guardado)}
              </span>
              <span className="font-arcade text-[0.5rem] uppercase leading-none text-text-muted">
                de {moeda(item.price!)}{item.tolerancia ? ` ±${item.tolerancia}` : ''}
              </span>
            </div>

            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-[1px] border-solid"
              style={{ borderWidth: 1, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)' }}
            >
              <div
                className="h-full transition-[width] duration-500"
                style={{
                  width: `${pct * 100}%`,
                  backgroundColor: 'var(--color-accent)',
                  boxShadow: pct > 0 ? '0 0 8px color-mix(in oklab, var(--color-accent) 55%, transparent)' : undefined,
                }}
              />
            </div>

            <p className="mt-2.5 text-xs text-text-muted">
              {falta > 0 ? `faltam ${moeda(falta)}` : 'já dá para executar'}
            </p>
          </>
        )}

        {!faixa && (
          <p className="mt-2.5 text-xs text-text-muted">
            Sem preço definido — anote um para acompanhar o quanto falta.
          </p>
        )}
      </div>
    </div>
  );
}
