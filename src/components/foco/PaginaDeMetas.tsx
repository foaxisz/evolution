import { useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { CategoriaDeFoco, SessaoDeFoco, Action } from '../../types';
import {
  getMetasDeSemana, getMetasDeTrimestre, trimestreDe, periodoDaSemana,
  alternarCumpridaSemana, alternarCumpridaTrimestre,
} from '../../store';
import {
  hojeISO, segundaDaSemana, somarDias, faixaDaSemana, nomeDaSemana, nomeDoPeriodo,
  posicaoDaSemana, diaLocal, diaDaSemanaDe,
} from '../../lib/data';
import { formatarDuracao, formatarDuracaoCurta } from '../../lib/pomodoro';
import { resumoDoPeriodo, variacao, DIAS_CURTOS, type ResumoDoPeriodo } from '../../lib/metricas';
import HabitIcon from '../ui/HabitIcon';
import CaixaDeMarcar from './CaixaDeMarcar';
import Duracao from './Duracao';
import BarrasVerticais from '../ui/BarrasVerticais';
import { Placar, CelulaPlacar, Cru } from '../ui/Placar';

/** Um período do histórico, já com as metas escritas e as cumpridas. */
interface Periodo {
  chave: string;
  escala: 'semana' | 'trimestre';
  inicio: string;
  fim: string;
  rotulo: string;
  /** Faixa exata de dias, quando o rótulo é relativo ("esta semana"). */
  faixa?: string;
  marcadores: string[];
  cumpridas: string[];
  observacoes?: string;
  emCurso: boolean;
  segundos: number;
  /** Id do registro salvo — só trimestre, e só quando há um. Necessário
   *  para marcar meta como cumprida. */
  registroId?: string;
}

interface NoTrimestre extends Periodo {
  semanas: Periodo[];
}

/**
 * Histórico das metas: o que foi planejado ao lado do que aconteceu.
 *
 * Uma coluna de trimestres em forma de PASTA, com as semanas de cada um
 * aninhadas — a semana pertence ao trimestre ("Semana 5 de 10"), e mostrar
 * os dois lado a lado escondia essa relação e deixava metade da tela vazia.
 * O detalhe ocupa a largura que sobra, em duas colunas.
 *
 * Marcar meta como cumprida é reflexão sobre um período fechado, e mora só
 * aqui — a frente de trabalho não tem esse toggle.
 */
export default function PaginaDeMetas({
  categoria, sessoes, acoes, onVoltar,
}: {
  categoria: CategoriaDeFoco;
  sessoes: SessaoDeFoco[];
  acoes: Action[];
  onVoltar: () => void;
}) {
  const cor = categoria.cor;
  // Bump ao marcar cumprida: força reler as metas do armazenamento.
  const [versao, setVersao] = useState(0);
  const recarregar = () => setVersao(v => v + 1);

  const arvore = useMemo(
    () => montarArvore(categoria.id, sessoes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categoria.id, sessoes, versao]
  );

  const todos = useMemo(() => arvore.flatMap(t => [t, ...t.semanas]), [arvore]);

  // Começa no período em curso; senão, no primeiro da lista.
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [expandidos, setExpandidos] = useState<Set<string>>(() => {
    const emCurso = montarArvore(categoria.id, sessoes).find(t => t.emCurso);
    return new Set(emCurso ? [emCurso.chave] : []);
  });

  const atual =
    todos.find(p => p.chave === escolhido) ??
    todos.find(p => p.emCurso && p.escala === 'semana') ??
    todos[0] ?? null;

  const resumo = useMemo(
    () => (atual ? resumoDoPeriodo(sessoes, acoes, categoria.id, atual.inicio, atual.fim) : null),
    [atual, sessoes, acoes, categoria.id]
  );

  // Comparação com a janela anterior de mesmo tamanho.
  const anterior = useMemo(() => {
    if (!atual) return null;
    const dias = diasEntre(atual.inicio, atual.fim).length;
    const fim = somarDias(atual.inicio, -1);
    const inicio = somarDias(atual.inicio, -dias);
    return resumoDoPeriodo(sessoes, acoes, categoria.id, inicio, fim);
  }, [atual, sessoes, acoes, categoria.id]);

  // O trimestre que contém o período selecionado — para a trajetória de
  // semanas aparecer também quando uma semana está aberta.
  const trimestreDoAtual = useMemo(() => {
    if (!atual) return null;
    if (atual.escala === 'trimestre') return arvore.find(t => t.chave === atual.chave) ?? null;
    return arvore.find(t => t.semanas.some(s => s.chave === atual.chave)) ?? null;
  }, [atual, arvore]);

  function marcar(p: Periodo, meta: string) {
    if (p.escala === 'semana') alternarCumpridaSemana(categoria.id, p.inicio, meta);
    else if (p.registroId) alternarCumpridaTrimestre(p.registroId, meta);
    recarregar();
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 p-4 pb-32 md:p-6 md:pb-32 lg:p-8 lg:pb-32">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border pb-3">
        <button
          onClick={onVoltar}
          className="alvo-toque font-arcade flex flex-shrink-0 items-center gap-2 text-[0.45rem] uppercase text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={13} />
          <span className="hidden sm:inline">voltar</span>
        </button>

        <span className="font-arcade flex min-w-0 items-center gap-2 text-[0.45rem] uppercase text-text-secondary">
          <HabitIcon name={categoria.icone} size={11} color={cor} />
          <span className="truncate">{categoria.nome} · metas</span>
        </span>

        <span className="filete hidden flex-1 sm:block" style={{ color: cor }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[19rem_1fr]">
        {/* ── Árvore: trimestres como pastas, semanas dentro ── */}
        <div className="min-w-0">
          <div className="mb-3 flex h-4 items-center gap-2">
            <h2 className="font-arcade flex-shrink-0 text-[0.45rem] uppercase leading-[1.4]" style={{ color: cor }}>
              Períodos
            </h2>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="rolagem-limpa max-h-[calc(100vh-12rem)] space-y-2 pr-1">
            {arvore.map(t => (
              <PastaDoTrimestre
                key={t.chave}
                no={t}
                cor={cor}
                selecionada={atual?.chave}
                expandida={expandidos.has(t.chave)}
                onExpandir={() => setExpandidos(atuais => {
                  const novo = new Set(atuais);
                  if (novo.has(t.chave)) novo.delete(t.chave); else novo.add(t.chave);
                  return novo;
                })}
                onEscolher={setEscolhido}
              />
            ))}
          </div>
        </div>

        {/* ── Detalhe ── */}
        {atual && resumo && (
          <Detalhe
            periodo={atual}
            resumo={resumo}
            anterior={anterior}
            trimestre={trimestreDoAtual}
            cor={cor}
            onMarcar={meta => marcar(atual, meta)}
            onEscolherSemana={setEscolhido}
          />
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Montagem da árvore
// ══════════════════════════════════════════════════════════════════════

function somar(sessoes: SessaoDeFoco[], categoriaId: string, inicio: string, fim: string): number {
  return sessoes.reduce((soma, s) => {
    if (s.tipo !== 'foco' || s.categoriaId !== categoriaId) return soma;
    const dia = diaLocal(s.inicio);
    return dia >= inicio && dia <= fim ? soma + s.segundosFocados : soma;
  }, 0);
}

function montarSemanas(categoriaId: string, sessoes: SessaoDeFoco[]): Periodo[] {
  const atual = segundaDaSemana();
  const metas = getMetasDeSemana(categoriaId);
  const chaves = new Set<string>([atual]);

  metas.forEach(m => chaves.add(m.semana));
  sessoes.forEach(s => {
    if (s.tipo !== 'foco' || s.categoriaId !== categoriaId) return;
    const dia = diaLocal(s.inicio);
    if (dia) chaves.add(segundaDaSemana(dia));
  });

  return [...chaves]
    .sort((a, b) => b.localeCompare(a))
    .map(semana => {
      const fim = somarDias(semana, 6);
      const t = periodoDaSemana(categoriaId, semana);
      const { posicao, total } = posicaoDaSemana(semana, t.inicio, t.fim);
      const reg = metas.find(m => m.semana === semana);
      return {
        chave: `s:${semana}`,
        escala: 'semana' as const,
        inicio: semana,
        fim,
        rotulo: `Semana ${posicao} de ${total}`,
        faixa: nomeDaSemana(semana) === faixaDaSemana(semana)
          ? faixaDaSemana(semana)
          : nomeDaSemana(semana).toLowerCase(),
        marcadores: reg?.marcadores ?? [],
        cumpridas: reg?.cumpridas ?? [],
        observacoes: reg?.observacoes,
        emCurso: semana === atual,
        segundos: somar(sessoes, categoriaId, semana, fim),
      };
    });
}

/** Trimestres com as semanas aninhadas por sobreposição. */
function montarArvore(categoriaId: string, sessoes: SessaoDeFoco[]): NoTrimestre[] {
  const hoje = hojeISO();
  const salvos = getMetasDeTrimestre(categoriaId);
  const semanas = montarSemanas(categoriaId, sessoes);

  interface Bruto {
    inicio: string; fim: string;
    marcadores: string[]; cumpridas: string[];
    registroId?: string;
    semanas: Periodo[];
  }
  const mapa = new Map<string, Bruto>();
  const chaveDe = (i: string, f: string) => `t:${i}_${f}`;

  // Trimestres salvos primeiro (carregam metas, marcadas e o id).
  salvos.forEach(m => {
    mapa.set(chaveDe(m.inicio, m.fim), {
      inicio: m.inicio, fim: m.fim,
      marcadores: m.marcadores, cumpridas: m.cumpridas ?? [],
      registroId: m.id, semanas: [],
    });
  });

  // Cada semana entra na pasta do trimestre que a cobre; se essa pasta
  // ainda não existe (trimestre de calendário sem metas), cria vazia.
  semanas.forEach(w => {
    const q = periodoDaSemana(categoriaId, w.inicio);
    const chave = chaveDe(q.inicio, q.fim);
    if (!mapa.has(chave)) {
      mapa.set(chave, { inicio: q.inicio, fim: q.fim, marcadores: [], cumpridas: [], semanas: [] });
    }
    mapa.get(chave)!.semanas.push(w);
  });

  // Garante que o trimestre corrente exista mesmo sem semana nem meta.
  const atualCal = trimestreDe(hoje);
  const chaveAtual = chaveDe(atualCal.inicio, atualCal.fim);
  if (!salvos.some(m => hoje >= m.inicio && hoje <= m.fim) && !mapa.has(chaveAtual)) {
    mapa.set(chaveAtual, { inicio: atualCal.inicio, fim: atualCal.fim, marcadores: [], cumpridas: [], semanas: [] });
  }

  return [...mapa.entries()]
    .map(([chave, b]): NoTrimestre => ({
      chave,
      escala: 'trimestre',
      inicio: b.inicio, fim: b.fim,
      rotulo: nomeDoPeriodo(b.inicio, b.fim),
      marcadores: b.marcadores,
      cumpridas: b.cumpridas,
      registroId: b.registroId,
      emCurso: hoje >= b.inicio && hoje <= b.fim,
      segundos: somar(sessoes, categoriaId, b.inicio, b.fim),
      semanas: b.semanas.sort((a, c) => c.inicio.localeCompare(a.inicio)),
    }))
    .sort((a, c) => c.inicio.localeCompare(a.inicio));
}

// ══════════════════════════════════════════════════════════════════════
// Árvore — pastas e linhas
// ══════════════════════════════════════════════════════════════════════

function PastaDoTrimestre({
  no, cor, selecionada, expandida, onExpandir, onEscolher,
}: {
  no: NoTrimestre;
  cor: string;
  selecionada?: string;
  expandida: boolean;
  onExpandir: () => void;
  onEscolher: (chave: string) => void;
}) {
  const aceso = selecionada === no.chave;

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: aceso ? `color-mix(in oklab, ${cor} 50%, var(--color-border))` : 'var(--color-border)' }}
    >
      <div
        className="flex items-center gap-1 transition-colors"
        style={{ backgroundColor: aceso ? 'var(--color-bg-card-hover)' : 'var(--color-bg-card)' }}
      >
        {/* Seta separada: expandir sem precisar selecionar. */}
        <button
          onClick={onExpandir}
          aria-label={expandida ? 'Recolher trimestre' : 'Expandir trimestre'}
          className="botao-icone flex-shrink-0 text-text-muted transition-transform hover:text-text-primary"
          style={{ transform: expandida ? 'rotate(90deg)' : undefined }}
        >
          <ChevronRight size={13} />
        </button>

        <button onClick={() => onEscolher(no.chave)} className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-left">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-primary">{no.rotulo}</span>
          <SelosDeMeta periodo={no} cor={cor} />
          {no.emCurso && (
            <span className="font-arcade flex-shrink-0 text-[0.35rem] uppercase leading-none" style={{ color: cor }}>
              agora
            </span>
          )}
        </button>
      </div>

      {expandida && (
        <div className="border-t border-border">
          {no.semanas.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-text-muted">Sem semanas registradas.</p>
          ) : (
            no.semanas.map(s => (
              <LinhaDeSemana
                key={s.chave}
                semana={s}
                cor={cor}
                aceso={selecionada === s.chave}
                onEscolher={() => onEscolher(s.chave)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function LinhaDeSemana({
  semana, cor, aceso, onEscolher,
}: { semana: Periodo; cor: string; aceso: boolean; onEscolher: () => void }) {
  return (
    <button
      onClick={onEscolher}
      className="flex w-full items-center gap-2 py-2 pl-3 pr-3 text-left transition-colors"
      style={{ backgroundColor: aceso ? 'var(--color-bg-card-hover)' : undefined }}
    >
      {/* Marca de canal: acesa só na semana escolhida. */}
      <span
        className="h-6 w-[3px] flex-shrink-0 rounded-[1px]"
        style={{ backgroundColor: aceso ? cor : 'var(--color-border)' }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-text-primary">{semana.rotulo}</span>
        <span className="block text-[10px] text-text-muted">
          {semana.faixa && semana.faixa !== semana.rotulo ? semana.faixa : faixaDaSemana(semana.inicio)}
        </span>
      </span>
      <SelosDeMeta periodo={semana} cor={cor} />
      <span
        className="font-arcade flex-shrink-0 text-[0.4rem] leading-none"
        style={{ color: semana.segundos ? cor : 'var(--color-text-muted)' }}
      >
        {semana.segundos ? formatarDuracao(semana.segundos) : '—'}
      </span>
    </button>
  );
}

/** "2/3" cumpridas, ou o número de metas, ou nada. */
function SelosDeMeta({ periodo, cor }: { periodo: Periodo; cor: string }) {
  if (periodo.marcadores.length === 0) return null;
  const feitas = periodo.cumpridas.length;
  const total = periodo.marcadores.length;
  const tudo = feitas === total && total > 0;
  return (
    <span
      className="font-arcade flex-shrink-0 rounded px-1.5 py-0.5 text-[0.35rem] uppercase leading-none tabular-nums"
      style={{
        color: feitas > 0 ? (tudo ? 'var(--color-bg-primary)' : cor) : 'var(--color-text-muted)',
        backgroundColor: tudo ? cor : feitas > 0 ? `color-mix(in oklab, ${cor} 16%, transparent)` : 'transparent',
      }}
      title={`${feitas} de ${total} cumpridas`}
    >
      {feitas}/{total}
    </span>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Detalhe
// ══════════════════════════════════════════════════════════════════════

function Detalhe({
  periodo, resumo, anterior, trimestre, cor, onMarcar, onEscolherSemana,
}: {
  periodo: Periodo;
  resumo: ResumoDoPeriodo;
  anterior: ResumoDoPeriodo | null;
  trimestre: NoTrimestre | null;
  cor: string;
  onMarcar: (meta: string) => void;
  onEscolherSemana: (chave: string) => void;
}) {
  // O gráfico por dia só faz sentido com algum foco registrado.
  const temPorDia = resumo.totalSegundos > 0;
  const temTrajetoria = !!(trimestre && trimestre.semanas.length > 1);

  const mostraPorDia = periodo.escala === 'semana' && temPorDia;
  const doisGraficos = mostraPorDia && temTrajetoria;

  return (
    <div
      className="min-w-0 space-y-6 rounded-xl border bg-bg-card p-4 md:p-5"
      style={{
        borderColor: 'var(--color-border)',
        borderTopColor: `color-mix(in oklab, ${cor} 40%, var(--color-border))`,
      }}
    >
      <div className="flex h-4 items-center gap-2">
        <h2 className="font-arcade flex-shrink-0 text-[0.5rem] uppercase leading-[1.4]" style={{ color: cor }}>
          {periodo.rotulo}
        </h2>
        <span className="h-px flex-1 bg-border" />
        <span className="flex-shrink-0 text-[10px] leading-none text-text-muted">
          {periodo.faixa && periodo.faixa !== periodo.rotulo
            ? periodo.faixa
            : periodo.escala === 'semana' ? 'semana' : 'trimestre'}
        </span>
      </div>

      {/* Placar: os quatro números no topo, largura cheia, com cara de
          mostrador de console — é o que ancora a leitura do período. */}
      <PlacarDoPeriodo resumo={resumo} anterior={anterior} cor={cor} />

      {/* Tudo em coluna única, largura cheia. Emparelhar um gráfico ao lado
          das metas deixava a linha torta: a lista tem altura variável e o
          gráfico é bloco fixo, então nunca alinhavam e sobrava vão embaixo
          do mais curto. Empilhado, cada seção fecha na própria altura. */}
      <section>
        <Titulo
          cor={cor}
          apoio={periodo.marcadores.length > 0 ? `${periodo.cumpridas.length}/${periodo.marcadores.length} cumpridas` : undefined}
        >
          Metas escritas
        </Titulo>
        {periodo.marcadores.length === 0 ? (
          <p className="text-[13px] text-text-muted">Nada foi escrito para este período.</p>
        ) : periodo.escala === 'trimestre' && !periodo.registroId ? (
          // Duas colunas de itens: um checklist curto largura cheia ficava
          // com todo o lado direito vazio.
          <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {periodo.marcadores.map((m, i) => (
              <li key={i} className="font-terminal text-[16px] leading-6 text-text-primary">{m}</li>
            ))}
          </ul>
        ) : (
          <ul className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {periodo.marcadores.map((m, i) => {
              const feita = periodo.cumpridas.includes(m);
              return (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-[3px] flex-shrink-0">
                    <CaixaDeMarcar
                      marcada={feita}
                      cor={cor}
                      rotulo={feita ? `Desmarcar: ${m}` : `Marcar como cumprida: ${m}`}
                      onAlternar={() => onMarcar(m)}
                    />
                  </span>
                  <span
                    className={`font-terminal min-w-0 flex-1 break-words text-[16px] leading-6 ${
                      feita ? 'text-text-muted line-through' : 'text-text-primary'
                    }`}
                  >
                    {m}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Os dois gráficos lado a lado. Emparelhar aqui não entorta como
          entortava ao lado das metas: ali a lista tinha altura variável e
          o gráfico não; aqui os dois são blocos da MESMA altura fixa,
          então a linha fecha reta e a largura é toda usada. */}
      {(mostraPorDia || temTrajetoria) && (
        <div className={`grid gap-x-8 gap-y-6 ${doisGraficos ? 'md:grid-cols-2' : ''}`}>
          {mostraPorDia && (
            <section>
              <Titulo cor={cor}>Foco por dia</Titulo>
              <PorDia dias={diasEntre(periodo.inicio, periodo.fim)} porDia={resumo.porDia} cor={cor} />
            </section>
          )}

          {temTrajetoria && (
            <section>
              <Titulo cor={cor} apoio={periodo.escala === 'semana' ? 'onde esta semana cai' : undefined}>
                Trajetória{periodo.escala === 'semana' ? ' do trimestre' : ''}
              </Titulo>
              <Trajetoria semanas={trimestre!.semanas} cor={cor} selecionada={periodo.chave} onEscolher={onEscolherSemana} />
            </section>
          )}
        </div>
      )}

      {periodo.observacoes && (
        <section>
          <Titulo cor={cor}>Observações</Titulo>
          <p className="font-terminal max-w-3xl whitespace-pre-wrap break-words text-[16px] leading-6 text-text-secondary">
            {periodo.observacoes}
          </p>
        </section>
      )}

      {/* Onde o tempo foi: largura cheia — barra deitada com nome longo não
          cabe numa coluna estreita. */}
      {resumo.porTarefa.length > 0 && (
        <section>
          <Titulo cor={cor}>Onde o tempo foi</Titulo>
          <div className="space-y-1.5">
            {resumo.porTarefa.slice(0, 8).map(t => (
              <div key={t.nome} className="relative h-8 overflow-hidden rounded-[3px] bg-bg-input">
                <span
                  className="barra-esticando absolute inset-y-0 left-0"
                  style={{
                    '--largura': `${Math.max(1.5, (t.segundos / resumo.porTarefa[0].segundos) * 100)}%`,
                    backgroundColor: cor,
                    opacity: 0.22,
                  } as React.CSSProperties}
                />
                <div className="relative flex h-full items-center gap-2.5 px-3">
                  <span className="font-terminal min-w-0 flex-1 truncate text-[15px] leading-none text-text-primary">
                    {t.nome}
                  </span>
                  <span className="flex-shrink-0 text-[10px] tabular-nums text-text-muted">{t.blocos}×</span>
                  <span className="font-arcade flex-shrink-0 text-[0.4rem] leading-none" style={{ color: cor }}>
                    {formatarDuracao(t.segundos)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Os quatro números do período, na fileira compartilhada de placar. */
function PlacarDoPeriodo({
  resumo, anterior, cor,
}: { resumo: ResumoDoPeriodo; anterior: ResumoDoPeriodo | null; cor: string }) {
  return (
    <Placar>
      <CelulaPlacar rotulo="Tempo focado" delta={variacao(resumo.totalSegundos, anterior?.totalSegundos ?? 0)}>
        <Duracao segundos={resumo.totalSegundos} cor={cor} tamanho="sm" />
      </CelulaPlacar>
      <CelulaPlacar
        rotulo="Blocos"
        apoio={resumo.blocos ? `${Math.round((resumo.blocosCompletos / resumo.blocos) * 100)}% até o fim` : undefined}
      >
        <Cru valor={String(resumo.blocos)} cor={cor} />
      </CelulaPlacar>
      <CelulaPlacar rotulo="Dias com foco" delta={variacao(resumo.diasAtivos, anterior?.diasAtivos ?? 0)}>
        <Cru valor={String(resumo.diasAtivos)} unidade={`de ${resumo.diasNoPeriodo}`} cor={cor} />
      </CelulaPlacar>
      <CelulaPlacar rotulo="Tarefas feitas">
        <Cru valor={String(resumo.tarefasConcluidas)} cor={cor} />
      </CelulaPlacar>
    </Placar>
  );
}

/**
 * Faixa de trajetória: uma barra por semana do trimestre, do começo ao
 * fim. Dá pra ver o embalo de relance; clicar numa barra abre a semana.
 */
function Trajetoria({
  semanas, cor, selecionada, onEscolher,
}: { semanas: Periodo[]; cor: string; selecionada?: string; onEscolher: (chave: string) => void }) {
  // As semanas chegam do mais recente para o mais antigo; a trajetória lê
  // da esquerda (começo) para a direita (agora).
  const ordem = [...semanas].reverse();
  const pico = Math.max(1, ...ordem.map(s => s.segundos));

  return (
    <div>
      {/* Mesma altura do `PorDia`: os dois dividem a linha e precisam
          fechar rente embaixo. */}
      <div className="flex h-24 items-end gap-1">
        {ordem.map(s => {
          const escolhida = s.chave === selecionada;
          return (
            <button
              key={s.chave}
              onClick={() => onEscolher(s.chave)}
              title={`${s.rotulo} · ${s.segundos ? formatarDuracao(s.segundos) : 'sem foco'}`}
              className="group relative flex h-full flex-1 items-end"
            >
              <span className="absolute inset-0 rounded-[1px] bg-bg-input/50 transition-colors group-hover:bg-bg-input" />
              <span
                className="relative w-full rounded-t-[1px] transition-[background-color,opacity]"
                style={{
                  height: s.segundos > 0 ? `${Math.max(6, (s.segundos / pico) * 100)}%` : '2px',
                  backgroundColor: s.segundos > 0 ? cor : 'var(--color-border)',
                  opacity: escolhida ? 1 : 0.5,
                  boxShadow: escolhida ? `0 0 0 1px ${cor}` : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-arcade text-[0.4rem] leading-none text-text-muted">
        <span>semana 1</span>
        <span>{ordem.length}</span>
      </div>
    </div>
  );
}

/**
 * Foco por dia do período.
 *
 * O desenho é o `BarrasVerticais` compartilhado; o que este uso escolhe é
 * a leitura: o RÓTULO DO DIA vira a duração enquanto o cursor está nele,
 * em vez de mandar o valor para o cabeçalho como faz o painel de dados.
 * Não abre espaço novo, não tem borda, e apaga sozinho ao sair — quem
 * aponta a quarta já sabe que é quarta.
 */
function PorDia({ dias, porDia, cor }: { dias: string[]; porDia: Map<string, number>; cor: string }) {
  const valores = dias.map(d => porDia.get(d) ?? 0);

  return (
    <BarrasVerticais
      valores={valores}
      cor={cor}
      larguraMaxima="3.25rem"
      rotulo={(i, aceso) =>
        // Forma curta: `2h10`, não `2h 10min` — Press Start 2P gasta um
        // bloco por glifo e a forma longa estoura a coluna.
        aceso ? formatarDuracaoCurta(valores[i]) : DIAS_CURTOS[diaDaSemanaDe(dias[i])]
      }
    />
  );
}

// ── peças pequenas ────────────────────────────────────────────────────

function Titulo({
  cor, apoio, children,
}: { cor: string; apoio?: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex h-4 items-center gap-2">
      <h3 className="font-arcade flex-shrink-0 text-[0.45rem] uppercase leading-[1.4]" style={{ color: cor }}>
        {children}
      </h3>
      <span className="h-px flex-1 bg-border" />
      {apoio && (
        <span className="flex-shrink-0 truncate text-[10px] leading-none text-text-muted">{apoio}</span>
      )}
    </div>
  );
}

/** Todos os dias entre duas datas, inclusive. */
function diasEntre(inicio: string, fim: string): string[] {
  const dias: string[] = [];
  let d = inicio;
  for (let i = 0; d <= fim && i < 400; i++) {
    dias.push(d);
    d = somarDias(d, 1);
  }
  return dias;
}
