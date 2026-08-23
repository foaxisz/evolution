import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Table2, Check } from 'lucide-react';
import type { CategoriaDeFoco, SessaoDeFoco, Action } from '../../types';
import {
  calcularMes, mesesComDados, mesAtual, nomeDoMes, mesCurto, somarMeses, resumoGeral,
  ultimosMeses,
} from '../../lib/metricas';
import { montarCSV, baixarArquivo, nomeDoArquivo } from '../../lib/relatorio';
import { BarrasDoMes, GradeDeHorarios, BarrasDaSemana, RankingDeTarefas } from './Graficos';
import Duracao from './Duracao';
import Bloco from '../ui/Bloco';
import { RitmoAcumulado, UltimosMeses, DuracaoDosBlocos, ConclusaoPorHora } from './GraficosExtras';
import HabitIcon from '../ui/HabitIcon';

/**
 * Painel de dados de uma frente.
 *
 * Os cartões do topo são de sempre — total, semana, hoje. Os gráficos são
 * de um mês por vez: "todo o histórico" num gráfico só produz uma tela em
 * que os últimos trinta dias ocupam três pixels, e é justamente o pedaço
 * que se quer olhar.
 */
export default function PainelDeDados({
  categoria, sessoes, acoes, onVoltar,
}: {
  categoria: CategoriaDeFoco;
  sessoes: SessaoDeFoco[];
  acoes: Action[];
  onVoltar: () => void;
}) {
  const cor = categoria.cor;
  const [mes, setMes] = useState(mesAtual());

  // O valor sob o cursor vai para o cabeçalho do bloco correspondente, no
  // lugar onde já havia texto — em vez de uma faixa própria que fica vazia
  // enquanto ninguém aponta nada.
  const [lendo, setLendo] = useState<Record<string, string | null>>({});
  const ler = useCallback(
    (chave: string) => (texto: string | null) =>
      setLendo(a => (a[chave] === texto ? a : { ...a, [chave]: texto })),
    []
  );

  const meses = useMemo(
    () => mesesComDados(sessoes.filter(s => s.categoriaId === categoria.id)),
    [sessoes, categoria.id]
  );
  const m = useMemo(() => calcularMes(sessoes, acoes, categoria.id, mes), [sessoes, acoes, categoria.id, mes]);
  const geral = useMemo(() => resumoGeral(sessoes, acoes, categoria.id), [sessoes, acoes, categoria.id]);
  const anterior = useMemo(
    () => calcularMes(sessoes, acoes, categoria.id, somarMeses(mes, -1)),
    [sessoes, acoes, categoria.id, mes]
  );
  const meses6 = useMemo(
    () => ultimosMeses(sessoes, categoria.id, mes),
    [sessoes, categoria.id, mes]
  );

  const horaPico = m.porHora.indexOf(Math.max(...m.porHora));
  const aproveitamento = m.blocos ? Math.round((m.blocosCompletos / m.blocos) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 pb-32 md:p-6 md:pb-32 lg:p-8 lg:pb-32">
      {/* ── Barra de sistema ── */}
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
          <span className="truncate">{categoria.nome}</span>
        </span>

        <span className="filete hidden flex-1 sm:block" style={{ color: cor }} />

        <NavegadorDeMes mes={mes} meses={meses} cor={cor} onMudar={setMes} />

        <span className="mx-1 hidden h-4 w-px bg-border sm:block" />

        <BaixarCSV
          cor={cor}
          onBaixar={() => baixarArquivo(
            montarCSV(sessoes, acoes, categoria, mes),
            nomeDoArquivo(categoria, mes),
            'text/csv'
          )}
        />
      </div>

      {/* ── Cartões ──
          Tempo e tarefas, nas mesmas três janelas. O grupo se distingue
          pela cor do número: a da frente para tempo, branco para tarefas —
          um matiz só, sem inventar uma segunda paleta. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cartao rotulo="Foco total" tom={cor} indice={0}>
          <Duracao segundos={geral.totalSegundos} cor={cor} />
        </Cartao>
        <Cartao rotulo="Foco na semana" tom={cor} indice={1}>
          <Duracao segundos={geral.semanaSegundos} cor={cor} />
        </Cartao>
        <Cartao rotulo="Foco hoje" tom={cor} indice={2}>
          <Duracao segundos={geral.hojeSegundos} cor={cor} />
        </Cartao>
        <Cartao rotulo="Tarefas no total" tom="var(--color-text-primary)" indice={3}>
          <Valor n={String(geral.tarefasTotal)} />
        </Cartao>
        <Cartao rotulo="Tarefas na semana" tom="var(--color-text-primary)" indice={4}>
          <Valor n={String(geral.tarefasSemana)} />
        </Cartao>
        <Cartao rotulo="Tarefas hoje" tom="var(--color-text-primary)" indice={5}>
          <Valor n={String(geral.tarefasHoje)} />
        </Cartao>
      </div>

      {m.blocos === 0 ? (
        <Bloco titulo="Tempo por dia" cor={cor} apoio={nomeDoMes(mes)}>
          <p className="py-10 text-center text-sm text-text-muted">Nenhum bloco em {nomeDoMes(mes)}.</p>
        </Bloco>
      ) : (
        <>
          <Bloco titulo="Tempo por dia" cor={cor} apoio={lendo.dia ?? nomeDoMes(mes)} destacado={!!lendo.dia}>
            <BarrasDoMes m={m} cor={cor} onLer={ler('dia')} />
          </Bloco>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <Bloco
              titulo="Quando você focou"
              cor={cor}
              apoio={lendo.grade ?? `pico às ${String(horaPico).padStart(2, '0')}h`}
              destacado={!!lendo.grade}
            >
              <GradeDeHorarios m={m} cor={cor} onLer={ler('grade')} />
            </Bloco>

            <Bloco titulo="Onde o tempo foi" cor={cor} apoio={`${m.porTarefa.length}`}>
              <RankingDeTarefas m={m} cor={cor} />
            </Bloco>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Bloco
              titulo="Ritmo acumulado"
              cor={cor}
              apoio={lendo.ritmo ?? `vs. ${mesCurto(somarMeses(mes, -1))}`}
              destacado={!!lendo.ritmo}
            >
              <RitmoAcumulado m={m} anterior={anterior} cor={cor} onLer={ler('ritmo')} />
            </Bloco>

            <Bloco titulo="Últimos meses" cor={cor}>
              <UltimosMeses dados={meses6} mesAberto={mes} cor={cor} onIr={setMes} />
            </Bloco>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Bloco titulo="Dia da semana" cor={cor} apoio={lendo.semana ?? undefined} destacado={!!lendo.semana}>
              <BarrasDaSemana m={m} cor={cor} onLer={ler('semana')} />
            </Bloco>

            <Bloco
              titulo="Duração dos blocos"
              cor={cor}
              apoio={lendo.duracao ?? undefined}
              destacado={!!lendo.duracao}
            >
              <DuracaoDosBlocos m={m} cor={cor} onLer={ler('duracao')} />
            </Bloco>
          </div>

          <Bloco
            titulo="Onde você desiste"
            cor={cor}
            apoio={lendo.conclusao ?? `${aproveitamento}% até o fim`}
            destacado={!!lendo.conclusao}
          >
            <ConclusaoPorHora m={m} cor={cor} onLer={ler('conclusao')} />
          </Bloco>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Peças
// ══════════════════════════════════════════════════════════════════════

/**
 * Navegação de mês por setas.
 *
 * Era um `<select>` transparente por cima de uma caixa desenhada. Parecia
 * quebrado: clicar selecionava o texto embaixo e a lista abria com a
 * aparência do sistema. Com duas setas não há nada invisível capturando
 * clique.
 */
function NavegadorDeMes({
  mes, meses, cor, onMudar,
}: { mes: string; meses: string[]; cor: string; onMudar: (m: string) => void }) {
  const maisAntigo = meses[meses.length - 1] ?? mes;
  const maisRecente = meses[0] ?? mes;
  const temAnterior = mes > maisAntigo;
  const temProximo = mes < maisRecente;

  const seta = 'botao-icone transition-colors';

  return (
    <div className="flex flex-shrink-0 items-center gap-0.5">
      <button
        onClick={() => temAnterior && onMudar(somarMeses(mes, -1))}
        disabled={!temAnterior}
        aria-label="Mês anterior"
        className={`${seta} ${temAnterior ? 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary' : 'cursor-default text-border'}`}
      >
        <ChevronLeft size={15} />
      </button>

      <span
        className="font-arcade min-w-[4.5rem] whitespace-nowrap text-center text-[0.5rem] uppercase leading-[1.5]"
        style={{ color: cor }}
        title={nomeDoMes(mes)}
      >
        {mesCurto(mes)}
      </span>

      <button
        onClick={() => temProximo && onMudar(somarMeses(mes, 1))}
        disabled={!temProximo}
        aria-label="Próximo mês"
        className={`${seta} ${temProximo ? 'text-text-muted hover:bg-bg-card-hover hover:text-text-primary' : 'cursor-default text-border'}`}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

function Valor({ n }: { n: string }) {
  return (
    <span className="font-arcade text-[1.15rem] leading-[1.45] text-text-primary">{n}</span>
  );
}

/** Cartão do topo: risco da cor, rótulo, número. Nada mais. */
function Cartao({
  rotulo, tom, indice, children,
}: { rotulo: string; tom: string; indice: number; children: React.ReactNode }) {
  return (
    <div
      className="linha-entrando rounded-lg border border-border bg-bg-card px-3.5 py-3"
      style={{ animationDelay: `${indice * 50}ms` }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-[3px] flex-shrink-0 rounded-[1px]" style={{ backgroundColor: tom }} />
        <p className="min-w-0 truncate text-[10px] uppercase tracking-[0.14em] text-text-muted">{rotulo}</p>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/** Baixa a planilha e vira um tique por dois segundos — o navegador baixa
 *  em silêncio e sem retorno a pessoa clica de novo achando que falhou. */
function BaixarCSV({ cor, onBaixar }: { cor: string; onBaixar: () => void }) {
  const [feito, setFeito] = useState(false);

  return (
    <button
      onClick={() => {
        onBaixar();
        setFeito(true);
        window.setTimeout(() => setFeito(false), 2000);
      }}
      aria-label="Baixar planilha do mês"
      title="Baixar planilha do mês (.csv)"
      className="botao-icone transition-colors hover:bg-bg-card-hover"
      style={{ color: feito ? cor : 'var(--color-text-muted)' }}
    >
      {feito ? <Check size={13} /> : <Table2 size={13} />}
    </button>
  );
}
