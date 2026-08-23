import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TrendingUp } from 'lucide-react';
import {
  getHabits, getHabitLogs, getCookieJarEntries,
} from '../store';
import { dataISO, formatarData, somarDias } from '../lib/data';
import {
  acumulado, semanaCorrente, numeros, corridaDoMes, trajetorias, marcas, diasDesde,
} from '../lib/evolucao';
import Bloco from '../components/ui/Bloco';
import { Placar, CelulaPlacar, Cru } from '../components/ui/Placar';
import CurvaDeAcumulo from '../components/dashboard/CurvaDeAcumulo';
import SemanaAtual from '../components/dashboard/SemanaAtual';
import CorridaDoMes from '../components/dashboard/CorridaDoMes';
import TrajetoriaDosHabitos from '../components/dashboard/TrajetoriaDosHabitos';
import UltimasVitorias from '../components/dashboard/UltimasVitorias';
import SuasMarcas from '../components/dashboard/SuasMarcas';
import LinhasDeHabito, { type LinhaDeHabito } from '../components/dashboard/LinhasDeHabito';

const COR = 'var(--color-accent)';
const JANELA_DO_HABITO = 30;
const VITORIAS_MOSTRADAS = 3;

/**
 * Painel de evolução: hábitos, constância e o que já foi conquistado.
 *
 * O eixo é ACÚMULO, não taxa. A versão anterior desta tela era um console
 * de análise — percentual de constância, correlação entre hábitos, carga
 * de entrada e saída — e com o volume de dado real de um app pessoal ela
 * virava uma parede de zeros que dizia à pessoa que ela não tinha nada.
 * Análise expõe o que falta; evolução mostra o que se juntou. São telas
 * opostas, e esta é a segunda.
 *
 * Duas regras, herdadas de defeito real:
 *
 * 1. NENHUM BLOCO MOSTRA ZERO. Sem base, o bloco não renderiza — nada de
 *    "0 de 7", "em 0 com agenda" ou doze barras vazias.
 * 2. NENHUM NÚMERO SE REPETE. Cada valor tem um dono; recorde vive em
 *    "Suas marcas", nunca duplicado no placar.
 *
 * O Foco não entra: é a aba de trabalho e não tem ligação com o resto do
 * app. Medalha por limiar arbitrário também não — é a gamificação que o
 * projeto recusa. Recorde pessoal fica, porque é alvo, não prêmio.
 */
export default function DashboardPage() {
  const hoje = useMemo(() => new Date(), []);
  const hojeISO = dataISO(hoje);

  const habits = useMemo(() => getHabits().filter(h => !h.archived), []);
  const logs = useMemo(() => getHabitLogs().filter(l => l.completed), []);
  const vitorias = useMemo(
    () => getCookieJarEntries()
      .filter(e => e.description?.trim())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, VITORIAS_MOSTRADAS),
    []
  );

  const acumulo = useMemo(() => acumulado(logs, hojeISO), [logs, hojeISO]);
  const semana = useMemo(() => semanaCorrente(logs, hojeISO), [logs, hojeISO]);
  const nums = useMemo(() => numeros(logs, hojeISO), [logs, hojeISO]);
  const corrida = useMemo(() => corridaDoMes(logs, hojeISO), [logs, hojeISO]);
  const trajetos = useMemo(() => trajetorias(habits, logs, hojeISO), [habits, logs, hojeISO]);
  const recordes = useMemo(() => marcas(habits, logs, hojeISO), [habits, logs, hojeISO]);

  /**
   * Cumprimento de cada hábito contra a meta DELE, nos últimos 30 dias.
   * Só entra hábito com registro na janela: uma barra zerada não informa
   * que o hábito vai mal, informa que ele não começou.
   */
  const porHabito = useMemo<LinhaDeHabito[]>(() => {
    const ini = somarDias(hojeISO, -(JANELA_DO_HABITO - 1));
    const iniAnterior = somarDias(hojeISO, -(JANELA_DO_HABITO * 2 - 1));
    const fimAnterior = somarDias(hojeISO, -JANELA_DO_HABITO);

    const cumprimento = (id: string, de: string, ate: string) => {
      const h = habits.find(x => x.id === id);
      if (!h) return 0;
      // Alvo do período = frequência semanal × semanas na janela.
      const alvo = Math.max(1, h.frequency * (JANELA_DO_HABITO / 7));
      const n = logs.filter(l => l.habitId === id && l.date >= de && l.date <= ate).length;
      return Math.min(100, (n / alvo) * 100);
    };

    return habits
      .map(h => ({
        habit: h,
        atual: cumprimento(h.id, ini, hojeISO),
        delta: cumprimento(h.id, ini, hojeISO) - cumprimento(h.id, iniAnterior, fimAnterior),
      }))
      .filter(l => l.atual > 0)
      .sort((a, b) => b.atual - a.atual);
  }, [habits, logs, hojeISO]);

  // Sem nenhum registro não há evolução para mostrar — e inventar uma
  // tela de zeros seria pior do que dizer a verdade.
  if (!acumulo || !nums) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 p-4 md:p-6 lg:p-8 animate-fade-in">
        <Cabecalho hoje={hoje} />
        <div className="mt-6 rounded-xl border border-border bg-bg-card p-10 text-center">
          <TrendingUp size={26} className="mx-auto mb-4 text-accent" />
          <p className="text-base font-medium text-text-primary">Sua evolução começa no primeiro registro</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-muted">
            Marque um hábito hoje e esta tela passa a acumular — daqui em
            diante ela só cresce.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 p-4 md:space-y-5 md:p-6 lg:p-8 animate-fade-in">
      <Cabecalho hoje={hoje} />

      {/* 1 ── Sua evolução ─────────────────────────────────────────── */}
      <Bloco
        titulo="Sua evolução"
        cor={COR}
        destaque
        apoio={`desde ${formatarData(acumulo.desde, "d 'de' MMMM")}`}
      >
        <CurvaDeAcumulo dados={acumulo} cor={COR} />
      </Bloco>

      <div className="grid gap-4 md:gap-5 lg:grid-cols-12">
        {/* 2 ── Esta semana ───────────────────────────────────────── */}
        {semana && (
          <div className="lg:col-span-7">
            <Bloco titulo="Esta semana" cor={COR}>
              <SemanaAtual dados={semana} cor={COR} />
            </Bloco>
          </div>
        )}

        {/* 3 ── Números ───────────────────────────────────────────── */}
        <div className={semana ? 'lg:col-span-5' : 'lg:col-span-12'}>
          <Bloco titulo="Números" cor={COR}>
            <Placar colunas={3}>
              <CelulaPlacar rotulo="Sequência">
                <Cru valor={String(nums.sequencia)} unidade={nums.sequencia === 1 ? 'dia' : 'dias'} cor={COR} />
              </CelulaPlacar>
              <CelulaPlacar rotulo="Este mês" delta={nums.deltaMes}>
                <Cru valor={String(nums.esteMes)} cor={COR} />
              </CelulaPlacar>
              <CelulaPlacar rotulo="Dias ativos">
                <Cru valor={String(nums.diasAtivos)} cor={COR} />
              </CelulaPlacar>
            </Placar>
          </Bloco>
        </div>
      </div>

      {/* 4 ── Seus hábitos ─────────────────────────────────────────── */}
      {porHabito.length > 0 && (
        <Bloco titulo="Seus hábitos" cor={COR} apoio="últimos 30 dias">
          <LinhasDeHabito linhas={porHabito} />
        </Bloco>
      )}

      {/* 5 ── Corrida do mês ───────────────────────────────────────── */}
      {corrida && (
        <Bloco titulo="Corrida do mês" cor={COR} apoio={`${corrida.nomeAtual} contra ${corrida.nomeAnterior}`}>
          <CorridaDoMes dados={corrida} cor={COR} />
        </Bloco>
      )}

      {/* 6 e 7 ── Trajetória e vitórias ─────────────────────────────
          Emparelhados só quando os DOIS existem. Um bloco de 7 colunas
          sozinho deixa as outras 5 vazias à direita, e o vão fica maior
          que o conteúdo. */}
      <div className="grid gap-4 md:gap-5 lg:grid-cols-12">
        {trajetos.length > 0 && (
          <div className={vitorias.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}>
            <Bloco titulo="Trajetória de cada hábito" cor={COR} apoio="12 semanas">
              <TrajetoriaDosHabitos linhas={trajetos} />
            </Bloco>
          </div>
        )}

        {vitorias.length > 0 && (
          <div className={trajetos.length > 0 ? 'lg:col-span-5' : 'lg:col-span-12'}>
            <Bloco titulo="Suas vitórias" cor="var(--color-cookie)">
              <UltimasVitorias entradas={vitorias} cor="var(--color-cookie)" />
            </Bloco>
          </div>
        )}
      </div>

      {/* 8 ── Suas marcas ──────────────────────────────────────────── */}
      {recordes.length > 0 && (
        <Bloco titulo="Suas marcas" cor={COR} apoio="o melhor que você já fez">
          <SuasMarcas marcas={recordes} cor={COR} />
        </Bloco>
      )}

      <p className="pt-1 text-center text-[11px] text-text-muted">
        acompanhando há {diasDesde(acumulo.desde, hojeISO)} dias
      </p>
    </div>
  );
}

function Cabecalho({ hoje }: { hoje: Date }) {
  return (
    <div className="flex items-center gap-3 border-b border-border pb-3">
      <h1 className="font-arcade flex-shrink-0 text-[0.55rem] uppercase text-text-primary">Dashboard</h1>
      <span className="h-px flex-1 bg-border" />
      <span className="flex-shrink-0 text-[11px] text-text-muted">
        {format(hoje, "EEEE, d 'de' MMMM", { locale: ptBR })}
      </span>
    </div>
  );
}
