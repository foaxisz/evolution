import { useState, useMemo } from 'react';
import { Trash2, Search, X } from 'lucide-react';
import type { Action, CategoriaDeFoco } from '../../types';
import { formatarData } from '../../lib/data';
import { formatarDuracao } from '../../lib/pomodoro';
import Modal from '../ui/Modal';
import CaixaDeMarcar from './CaixaDeMarcar';

interface ModalDeTarefasProps {
  aberto: boolean;
  categoria: CategoriaDeFoco;
  tarefas: Action[];
  tempoPorTarefa: Map<string, number>;
  onFechar: () => void;
  onAlternar: (id: string) => void;
  onExcluir: (id: string) => void;
}

/**
 * Histórico de tarefas da frente.
 *
 * Existe porque a lista da página é sobre o que fazer AGORA: enchê-la de
 * tarefas concluídas transforma trabalho em arquivo morto. O que já foi
 * feito continua valendo — só não no mesmo lugar.
 *
 * Agrupado por dia, com o tempo focado em cada uma: é o registro de onde
 * as horas da frente foram parar.
 */
export default function ModalDeTarefas({
  aberto, categoria, tarefas, tempoPorTarefa, onFechar, onAlternar, onExcluir,
}: ModalDeTarefasProps) {
  const cor = categoria.cor;
  const [busca, setBusca] = useState('');

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtradas = termo
      ? tarefas.filter(t => t.name.toLowerCase().includes(termo))
      : tarefas;

    // A data que importa é a de conclusão; para as abertas, a de criação.
    const porDia = new Map<string, Action[]>();
    filtradas.forEach(t => {
      const dia = (t.completed ? t.completedAt : t.createdAt)?.slice(0, 10) ?? '';
      if (!porDia.has(dia)) porDia.set(dia, []);
      porDia.get(dia)!.push(t);
    });

    return [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [tarefas, busca]);

  const total = grupos.reduce((soma, [, itens]) => soma + itens.length, 0);

  return (
    <Modal isOpen={aberto} onClose={onFechar} title="Tarefas da frente">
      <div className="space-y-4">
        <label className="flex cursor-text items-center gap-2.5 rounded-xl border border-border bg-bg-input px-3.5 py-2.5 transition-colors focus-within:border-border-light">
          <Search size={14} className="flex-shrink-0 text-text-muted" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Procurar por nome"
            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              aria-label="Limpar busca"
              className="alvo-toque flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              <X size={13} />
            </button>
          )}
        </label>

        {total === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            {busca ? 'Nada com esse nome.' : 'Nenhuma tarefa nesta frente ainda.'}
          </p>
        ) : (
          <div className="rolagem-limpa max-h-[50vh] space-y-4">
            {grupos.map(([dia, itens]) => (
              <section key={dia}>
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-arcade text-[0.45rem] uppercase text-text-muted">
                    {dia ? formatarData(dia, "d 'de' MMMM") : 'sem data'}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                  <span className="font-arcade text-[0.45rem] text-text-muted">{itens.length}</span>
                </div>

                <div className="space-y-1">
                  {itens.map(t => {
                    const segundos = tempoPorTarefa.get(t.id) ?? 0;
                    return (
                      <div
                        key={t.id}
                        className="group flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-bg-card-hover"
                      >
                        <CaixaDeMarcar
                          marcada={t.completed}
                          cor={cor}
                          rotulo={t.completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
                          onAlternar={() => onAlternar(t.id)}
                        />

                        <span
                          className={`font-terminal min-w-0 flex-1 truncate text-[17px] leading-[1.35] ${
                            t.completed ? 'text-text-muted line-through' : 'text-text-primary'
                          }`}
                          title={t.name}
                        >
                          {t.name}
                        </span>

                        {segundos > 0 && (
                          <span className="flex-shrink-0 font-arcade text-[0.45rem] text-text-muted">
                            {formatarDuracao(segundos)}
                          </span>
                        )}

                        <button
                          onClick={() => onExcluir(t.id)}
                          aria-label={`Excluir ${t.name}`}
                          className="alvo-toque flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
