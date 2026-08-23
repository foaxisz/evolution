import { useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CategoriaDeFoco } from '../../types';
import {
  getTrimestreVigente, salvarMetasDeTrimestre, trimestreDe, periodoDaSemana,
  getMetasDaSemana, salvarMetasDaSemana,
} from '../../store';
import { hojeISO, segundaDaSemana, somarDias, faixaDaSemana, nomeDoPeriodo, posicaoDaSemana, formatarData, dataISO } from '../../lib/data';
import { formatarDuracao, formatarDuracaoCurta } from '../../lib/pomodoro';
import Marcadores from './Marcadores';
import Observacoes from './Observacoes';

interface PainelDeMetasProps {
  categoria: CategoriaDeFoco;
  /** Segundos focados na semana corrente (segunda a domingo). */
  segundosDaSemana: number;
}

/**
 * As escalas do planejamento, da mais longa para a mais curta.
 *
 * Trimestre → semana → horas da semana. A escala do dia não está aqui:
 * são os blocos do cronômetro, na própria página.
 *
 * As duas primeiras são escritas à mão e guardadas para sempre. Rever o
 * que se pretendia num período ao lado do que de fato aconteceu nele é a
 * razão de existirem, e é o que a página de metas faz.
 */
export default function PainelDeMetas({ categoria, segundosDaSemana }: PainelDeMetasProps) {
  const cor = categoria.cor;
  const hoje = hojeISO();

  /*
   * O período do trimestre vive AQUI, não dentro do bloco dele.
   *
   * "Semana 8 de 13" é contada dentro do trimestre. Com o período guardado
   * no bloco do trimestre, o bloco da semana era irmão dele e lia o
   * período do armazenamento no render — então trocar o trimestre não
   * disparava render nenhum na semana e o número continuava o antigo até
   * recarregar a página. Estado compartilhado no pai resolve na origem.
   */
  const [trimestre, setTrimestre] = useState(() => getTrimestreVigente(categoria.id, hoje));
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const salvo = getTrimestreVigente(categoria.id, hoje);
    return salvo ? { inicio: salvo.inicio, fim: salvo.fim } : trimestreDe(hoje);
  });

  function gravarTrimestre(marcadores: string[], novo: Periodo = periodo) {
    const salvo = salvarMetasDeTrimestre({
      id: trimestre?.id, categoriaId: categoria.id,
      inicio: novo.inicio, fim: novo.fim, marcadores,
    });
    setTrimestre(salvo);
    setPeriodo({ inicio: salvo.inicio, fim: salvo.fim });
  }

  return (
    <div className="space-y-6">
      <section>
        <Cabecalho titulo="Horas da semana" cor={cor} />
        <Ritmo segundos={segundosDaSemana} metaMinutos={categoria.metaSemanalMinutos} cor={cor} />
      </section>

      <MetasDoTrimestre
        cor={cor}
        marcadores={trimestre?.marcadores ?? []}
        periodo={periodo}
        onGravar={gravarTrimestre}
      />

      <MetasDaSemana categoria={categoria} periodoDoTrimestreAtual={periodo} />
    </div>
  );
}

interface Periodo {
  inicio: string;
  fim: string;
}

// ══════════════════════════════════════════════════════════════════════
// Trimestre
// ══════════════════════════════════════════════════════════════════════

function MetasDoTrimestre({
  cor, marcadores, periodo, onGravar,
}: {
  cor: string;
  marcadores: string[];
  periodo: Periodo;
  onGravar: (marcadores: string[], periodo?: Periodo) => void;
}) {
  const [seletorAberto, setSeletorAberto] = useState(false);

  return (
    <Marcadores
      titulo="Metas do trimestre"
      apoio={nomeDoPeriodo(periodo.inicio, periodo.fim)}
      cor={cor}
      iniciais={marcadores}
      onGravar={m => onGravar(m)}
      acoes={[{
        icone: <CalendarRange size={11} />,
        rotulo: 'Mudar o período do trimestre',
        aoClicar: () => setSeletorAberto(a => !a),
      }]}
      topo={
        // Acima da lista: é o período que dá sentido aos marcadores abaixo.
        // Escondido até pedirem — trocar o trimestre é coisa de três ou
        // quatro vezes por ano.
        seletorAberto ? (
          <SeletorDePeriodo
            inicio={periodo.inicio}
            fim={periodo.fim}
            cor={cor}
            onEscolher={(inicio, fim) => {
              // Os marcadores vão junto: mudar o período é mover o mesmo
              // trimestre, não começar outro.
              onGravar(marcadores, { inicio, fim });
              setSeletorAberto(false);
            }}
          />
        ) : null
      }
    />
  );
}

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Sempre 42 casas: seis semanas, começando no domingo anterior ao dia 1º.
 *
 * Um mês ocupa cinco ou seis linhas conforme o dia da semana em que cai o
 * dia 1º. Desenhando só as linhas necessárias, o calendário mudava de
 * altura ao virar o mês e o painel inteiro pulava. Fixando em seis, a
 * caixa nunca muda — e as casas que sobram, em vez de vazias, mostram os
 * dias vizinhos, o que também tira o recorte irregular das pontas.
 */
function gradeDeSeisSemanas(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number);
  // Meio-dia, não meia-noite: em fuso negativo a meia-noite do dia 1º cai
  // no dia anterior e a grade inteira anda uma casa.
  const dow = new Date(`${mes}-01T12:00:00`).getDay();
  return Array.from({ length: 42 }, (_, i) => dataISO(new Date(ano, m - 1, 1 - dow + i)));
}

function somarMesAoMes(mes: string, n: number): string {
  const [ano, m] = mes.split('-').map(Number);
  return dataISO(new Date(ano, m - 1 + n, 1)).slice(0, 7);
}

/**
 * Escolha do período por intervalo, num calendário só.
 *
 * Foram por aqui dois desenhos que não serviram. Dois campos de data
 * nativos abriam duas telinhas do sistema e obrigavam a acertar mês, ano e
 * dia em cada uma. Quatro botões de trimestre resolviam num clique, mas
 * tiravam o que importava: o período nem sempre é o do calendário, e o dia
 * exato de começo e fim é justamente o que se quer escolher.
 *
 * Um clique no primeiro dia, outro no último. O intervalo aparece como
 * faixa contínua com as pontas redondas — a faixa é o que se está
 * escolhendo, as pontas são onde ela começa e acaba.
 */
function SeletorDePeriodo({
  inicio, fim, cor, onEscolher,
}: {
  inicio: string;
  fim: string;
  cor: string;
  onEscolher: (inicio: string, fim: string) => void;
}) {
  const [mesVisivel, setMesVisivel] = useState(() => inicio.slice(0, 7));
  // `fim: null` = escolhendo a ponta final. Enquanto está assim, passar o
  // mouse mostra até onde o intervalo iria.
  const [rascunho, setRascunho] = useState<{ inicio: string; fim: string | null }>(
    { inicio, fim }
  );
  const [sobreOMouse, setSobreOMouse] = useState<string | null>(null);

  const grade = gradeDeSeisSemanas(mesVisivel);

  /*
   * Escolher NÃO grava. Só o botão de aplicar grava.
   *
   * Gravando a cada segundo clique, cada tentativa de acertar o intervalo
   * virava um trimestre no histórico — inclusive as erradas, que ficavam
   * lá sem meta nenhuma. Mudar o período de um trimestre é decisão de três
   * vezes por ano; merece um passo de confirmação.
   */
  function escolher(dia: string) {
    // Dia de mês vizinho: leva a vista junto, senão a escolha some da tela.
    if (dia.slice(0, 7) !== mesVisivel) setMesVisivel(dia.slice(0, 7));
    // Intervalo já fechado, ou clique antes do começo: recomeça daí.
    if (rascunho.fim !== null || dia < rascunho.inicio) {
      setRascunho({ inicio: dia, fim: null });
      return;
    }
    setRascunho({ inicio: rascunho.inicio, fim: dia });
  }

  const fimVisual = rascunho.fim ?? (sobreOMouse && sobreOMouse >= rascunho.inicio ? sobreOMouse : null);
  const completo = rascunho.fim !== null;
  const mudou = completo && (rascunho.inicio !== inicio || rascunho.fim !== fim);
  const umDiaSo = rascunho.inicio === fimVisual;

  const mesPorExtenso = formatarData(`${mesVisivel}-01`, "MMMM 'de' yyyy", mesVisivel);
  const seta = 'botao-icone text-text-muted transition-colors hover:text-text-primary';
  // Trilha do intervalo: fina, não o tijolão que reduzia o calendário a
  // barras pretas empilhadas. Só liga as duas pontas.
  const trilha = `color-mix(in oklab, ${cor} 14%, transparent)`;

  return (
    <div
      className="mb-3 rounded-md border p-2"
      style={{
        borderColor: `color-mix(in oklab, ${cor} 25%, var(--color-border))`,
        backgroundColor: 'var(--color-bg-input)',
      }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <button onClick={() => setMesVisivel(m => somarMesAoMes(m, -1))} aria-label="Mês anterior" className={seta}>
          <ChevronLeft size={13} />
        </button>
        {/* Mês em micro-caixa-alta arcade, como os títulos do painel. */}
        <span className="font-arcade text-[0.45rem] uppercase leading-none" style={{ color: cor }}>
          {mesPorExtenso}
        </span>
        <button onClick={() => setMesVisivel(m => somarMesAoMes(m, 1))} aria-label="Próximo mês" className={seta}>
          <ChevronRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-7" onMouseLeave={() => setSobreOMouse(null)}>
        {DIAS_DA_SEMANA.map((d, i) => (
          <span key={i} className="font-arcade pb-1 text-center text-[0.4rem] leading-none text-text-muted">
            {d}
          </span>
        ))}

        {grade.map(dia => {
          const doMes = dia.slice(0, 7) === mesVisivel;
          const ehInicio = dia === rascunho.inicio;
          const ehFim = dia === fimVisual;
          const dentro = fimVisual !== null && dia > rascunho.inicio && dia < fimVisual;
          const ponta = ehInicio || ehFim;

          return (
            <button
              key={dia}
              onClick={() => escolher(dia)}
              onMouseEnter={() => setSobreOMouse(dia)}
              className="group relative h-7"
            >
              {/* Trilha do intervalo, atrás do número e vazando 1px para os
                  lados, então as casas se encostam e o miolo lê como um
                  trecho aceso contínuo. */}
              {dentro && (
                <span className="absolute inset-y-0.5 -left-px -right-px" style={{ backgroundColor: trilha }} />
              )}
              {ponta && !umDiaSo && (
                <span
                  className="absolute inset-y-0.5"
                  style={{
                    backgroundColor: trilha,
                    left: ehInicio ? '50%' : '-1px',
                    right: ehInicio ? '-1px' : '50%',
                  }}
                />
              )}

              {/* Ponta = bloco quadrado aceso. Canto de 2px, nunca círculo —
                  é o que troca "bolinha de calendário de app" por "segmento
                  ligado num painel". */}
              <span
                className="font-terminal relative mx-auto flex h-6 w-6 items-center justify-center rounded-[2px] text-[14px] leading-none transition-colors"
                style={{
                  backgroundColor: ponta ? cor : 'transparent',
                  color: ponta
                    ? 'var(--color-bg-primary)'
                    : dentro
                      ? 'var(--color-text-primary)'
                      : doMes
                        ? 'var(--color-text-secondary)'
                        : 'var(--color-border-light)',
                }}
              >
                {/* Fora de ponta, um realce leve na cor ao passar o mouse —
                    marca o dia sob o cursor sem virar mais um bloco cheio. */}
                {!ponta && (
                  <span
                    className="absolute inset-0 rounded-[2px] opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ backgroundColor: `color-mix(in oklab, ${cor} 16%, transparent)` }}
                    aria-hidden
                  />
                )}
                <span className="relative">{Number(dia.slice(8))}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2.5">
        <span className="font-terminal min-w-0 flex-1 truncate text-[14px] leading-none text-text-secondary">
          {formatarData(rascunho.inicio, 'd MMM', rascunho.inicio)}
          <span className="mx-1.5 text-text-muted">→</span>
          {rascunho.fim ? formatarData(rascunho.fim, 'd MMM', rascunho.fim) : '…'}
        </span>
        <button
          onClick={() => mudou && onEscolher(rascunho.inicio, rascunho.fim!)}
          disabled={!mudou}
          className="font-arcade flex-shrink-0 rounded-[3px] px-3.5 py-1.5 text-[0.4rem] uppercase leading-none transition-colors"
          style={{
            backgroundColor: mudou ? cor : 'transparent',
            color: mudou ? 'var(--color-bg-primary)' : 'var(--color-border-light)',
            cursor: mudou ? 'pointer' : 'default',
          }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Semana
// ══════════════════════════════════════════════════════════════════════

function MetasDaSemana({
  categoria, periodoDoTrimestreAtual,
}: {
  categoria: CategoriaDeFoco;
  /** O período que o bloco do trimestre está mostrando agora. */
  periodoDoTrimestreAtual: Periodo;
}) {
  const cor = categoria.cor;
  const semana = segundaDaSemana();

  const guardado = useState(() => getMetasDaSemana(categoria.id, semana))[0];
  const [metas, setMetas] = useState(() => guardado?.marcadores ?? []);
  const [observacoes, setObservacoes] = useState(() => guardado?.observacoes ?? '');
  // A semana passada não muda enquanto a tela está aberta.
  const [anterior] = useState(
    () => getMetasDaSemana(categoria.id, somarDias(semana, -7))?.marcadores ?? []
  );
  const vazia = metas.length === 0;

  /*
   * "Semana 3 de 13" — onde esta semana cai dentro do trimestre.
   *
   * A semana pertence ao período editado se as duas se SOBREPÕEM em
   * qualquer dia — não pela quinta-feira. Era esse o furo: pôr o início do
   * trimestre em "hoje" numa sexta deixava a quinta desta semana ANTES do
   * início, o gate dava falso e a numeração não mexia. Com sobreposição,
   * definir o início como hoje faz a semana atual virar "Semana 1" na hora,
   * que é o esperado. `posicaoDaSemana` conta a semana que contém o início
   * como a de número 1.
   */
  const fimDaSemana = somarDias(semana, 6);
  const doPainel =
    semana <= periodoDoTrimestreAtual.fim && fimDaSemana >= periodoDoTrimestreAtual.inicio;
  const t = doPainel ? periodoDoTrimestreAtual : periodoDaSemana(categoria.id, semana);
  const { posicao, total } = posicaoDaSemana(semana, t.inicio, t.fim);

  return (
    <Marcadores
      titulo={`Semana ${posicao} de ${total}`}
      apoio={faixaDaSemana(semana)}
      cor={cor}
      iniciais={metas}
      onGravar={m => { salvarMetasDaSemana(categoria.id, semana, { marcadores: m }); setMetas(m); }}
    >
      {/* A semana passada só enquanto a desta ainda está em branco. Depois
          de escrita, ela vira ruído embaixo do que importa agora. */}
      {vazia && anterior.length > 0 && (
        <div className="mt-3 border-l-2 pl-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-text-muted">
            semana passada
          </p>
          <ul className="space-y-1">
            {anterior.map((m, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-text-muted">{m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Por último de propósito: metas se escrevem antes, anotação depois.
          A ordem na coluna é a ordem em que as duas coisas acontecem. */}
      <div className="mt-5">
        <Observacoes
          texto={observacoes}
          cor={cor}
          onGravar={t => {
            salvarMetasDaSemana(categoria.id, semana, { observacoes: t });
            setObservacoes(t);
          }}
        />
      </div>
    </Marcadores>
  );
}

// ══════════════════════════════════════════════════════════════════════
// Peças
// ══════════════════════════════════════════════════════════════════════

function Cabecalho({
  titulo, apoio, cor, acao,
}: {
  titulo: string;
  apoio?: string;
  cor: string;
  acao?: { icone: React.ReactNode; rotulo: string; aoClicar: () => void };
}) {
  return (
    <div className="mb-2.5 flex h-4 items-center gap-2">
      <h2 className="font-arcade flex-shrink-0 text-[0.45rem] uppercase leading-[1.4]" style={{ color: cor }}>
        {titulo}
      </h2>
      <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
      {apoio && <span className="flex-shrink-0 text-[10px] leading-none text-text-muted">{apoio}</span>}
      {acao && (
        <button
          onClick={acao.aoClicar}
          aria-label={acao.rotulo}
          title={acao.rotulo}
          className="alvo-toque flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
        >
          {acao.icone}
        </button>
      )}
    </div>
  );
}

function Ritmo({
  segundos, metaMinutos, cor,
}: { segundos: number; metaMinutos?: number; cor: string }) {
  if (!metaMinutos) {
    return (
      <>
        <p className="font-arcade text-base leading-[1.45] text-text-primary">
          {formatarDuracaoCurta(segundos)}
        </p>
        <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
          focadas esta semana. Defina uma meta no lápis do topo.
        </p>
      </>
    );
  }

  const alvo = metaMinutos * 60;
  const pct = Math.min(1, segundos / alvo);

  return (
    <>
      {/* O feito em bitmap, o alvo em mono: a diferença de fonte já diz qual
          dos dois números é o seu. */}
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-arcade text-base leading-[1.45] text-text-primary">
          {formatarDuracaoCurta(segundos)}
        </span>
        <span className="text-xs text-text-muted">de {formatarDuracao(alvo)}</span>
      </p>
      {/* Barra em esquadro, não cápsula: a ponta arredondada some nos
          primeiros por cento e o começo do progresso fica invisível. */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-[1px] border border-border bg-bg-input">
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${pct * 100}%`, backgroundColor: cor }}
          />
        </div>
        <span className="flex-shrink-0 font-arcade text-[0.5rem]" style={{ color: cor }}>
          {Math.round(pct * 100)}%
        </span>
      </div>
    </>
  );
}
