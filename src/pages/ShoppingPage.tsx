import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ShoppingBag, Plus, Trash2, Pencil, ExternalLink, Check,
  ImagePlus, X, AlertTriangle, Crosshair, ChartNoAxesColumn,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getShoppingItems,
  getShoppingCategories,
  saveShoppingCategory,
  deleteShoppingCategory,
  saveShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  getUltimoErroDeGravacao,
  getUsoDoArmazenamento,
  getProximoDeCompra,
  setProximoDeCompra,
} from '../store';
import type { ShoppingItem, ShoppingCategory } from '../types';
import Modal from '../components/ui/Modal';
import Toast from '../components/ui/Toast';
import EmptyState from '../components/ui/EmptyState';
import TrilhaDeMarcos from '../components/compras/TrilhaDeMarcos';
import FitaDeCategorias from '../components/compras/FitaDeCategorias';
import FaixaDeLegenda from '../components/compras/FaixaDeLegenda';
import DetalheDoProximo from '../components/compras/DetalheDoProximo';
import RelatorioDeCompras from '../components/compras/RelatorioDeCompras';
import { totalDaLista } from '../lib/compras';
import { MARCOS, faltamPara } from '../lib/marcos';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import HabitIcon, { HABIT_ICONS, HABIT_ICON_KEYS } from '../components/ui/HabitIcon';
import { reduzirImagem, formatarBytes } from '../lib/imagem';

const CORES = ['#a855f7', '#c88cff', '#38bdf8', '#3ddc97', '#ffb000', '#ff6b35', '#ff4d8d', '#00e5ff'];

const SEM_CATEGORIA = '__sem__';
const CONQUISTADOS = '__conquistados__';

/** Duração do carimbo e da saída do card. Somadas dão o gesto inteiro. */
const MS_CARIMBO = 380;
const MS_SAIDA = 260;


function moeda(v?: number): string {
  if (v === undefined || Number.isNaN(v)) return '';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Campo de texto que vira número, ou nada.
 *
 * Devolve `undefined` para vazio e para lixo — e `undefined` é o valor
 * legítimo de "sem isto": o `JSON.stringify` omite a chave, e o campo
 * simplesmente não existe no item. Zero seria diferente e errado: uma
 * tolerância de zero diz "o preço é exato", que não é o mesmo que "não
 * informei tolerância".
 */
function numeroOuNada(bruto: string): number | undefined {
  const t = bruto.trim();
  if (!t) return undefined;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Quando o item foi conquistado. Itens antigos podem não ter `completedAt`
 *  — aí vale a data de criação. Sem nenhuma das duas, só entra em "Tudo". */
function dataConquista(item: ShoppingItem): Date | null {
  const bruto = item.completedAt ?? item.createdAt;
  if (!bruto) return null;
  const d = new Date(bruto);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface FormItem {
  id?: string;
  name: string;
  categoryId: string;
  price: string;
  tolerancia: string;
  guardado: string;
  productUrl: string;
  imageData: string;
  imageUrl: string;
  notes: string;
}

const FORM_VAZIO: FormItem = {
  name: '', categoryId: '', price: '', tolerancia: '', guardado: '',
  productUrl: '', imageData: '', imageUrl: '', notes: '',
};

interface Aviso {
  chave: number;
  itemId: string;
  mensagem: string;
  detalhe?: string;
  desfazivel: boolean;
}

export default function ShoppingPage() {
  const [itens, setItens] = useState<ShoppingItem[]>(() => getShoppingItems());
  const [categorias, setCategorias] = useState<ShoppingCategory[]>(() => getShoppingCategories());
  const [filtro, setFiltro] = useState<string>('todas');
  const [erro, setErro] = useState<string | null>(null);
  const [proximoId, setProximoId] = useState<string | null>(() => getProximoDeCompra());

  const [formAberto, setFormAberto] = useState(false);
  const [form, setForm] = useState<FormItem>(FORM_VAZIO);
  const [catAberta, setCatAberta] = useState(false);
  const [gerenciarAberto, setGerenciarAberto] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  /** itens com o carimbo na tela */
  const [marcando, setMarcando] = useState<Set<string>>(new Set());
  /** itens encolhendo para fora da grade — ficam no DOM até a animação acabar */
  const [saindo, setSaindo] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [catForm, setCatForm] = useState({ id: '', name: '', icon: 'target', color: CORES[0] });
  const [excluirItem, setExcluirItem] = useState<ShoppingItem | null>(null);
  const [excluirCat, setExcluirCat] = useState<ShoppingCategory | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const temporizadores = useRef<number[]>([]);

  // Desmontar a página no meio de uma animação não pode deixar timer solto
  // chamando setState em componente morto.
  useEffect(() => () => { temporizadores.current.forEach(window.clearTimeout); }, []);

  const agendar = useCallback((fn: () => void, ms: number) => {
    temporizadores.current.push(window.setTimeout(fn, ms));
  }, []);

  const recarregar = useCallback(() => {
    setItens(getShoppingItems());
    setCategorias(getShoppingCategories());
    setErro(getUltimoErroDeGravacao());
    setProximoId(getProximoDeCompra());
  }, []);

  const emAnimacao = (id: string) => marcando.has(id) || saindo.has(id);

  /** Comprar: carimbo, o card sai, grava e oferece desfazer. */
  function conquistar(item: ShoppingItem) {
    if (emAnimacao(item.id)) return;
    setMarcando(p => new Set(p).add(item.id));

    agendar(() => setSaindo(p => new Set(p).add(item.id)), MS_CARIMBO);

    agendar(() => {
      toggleShoppingItem(item.id);
      recarregar();
      setMarcando(p => { const n = new Set(p); n.delete(item.id); return n; });
      setSaindo(p => { const n = new Set(p); n.delete(item.id); return n; });

      // Lê do armazenamento, não do estado: o setItens acima ainda não
      // chegou nesta closure.
      const frescos = getShoppingItems();
      const n = frescos.filter(i => i.completed).length;

      /*
       * O aviso dizia "50% da lista", e carregava o mesmo defeito da barra
       * antiga: a fração encolhe quando um desejo novo entra. Agora ele fala
       * a língua da trilha — e o momento de bater um marco é justamente
       * quando vale dizer isso em voz alta.
       */
      const faltam = faltamPara(n);
      const bateuMarco = MARCOS.includes(n as (typeof MARCOS)[number]);
      const progresso =
        bateuMarco ? `marco de ${n} alcançado`
        : faltam !== null ? `${faltam === 1 ? 'falta 1' : `faltam ${faltam}`} para o próximo marco`
        : `${n} conquistados`;

      setAviso({
        chave: Date.now(),
        itemId: item.id,
        mensagem: `${item.name} conquistado`,
        detalhe: [item.price ? moeda(item.price) : null, progresso]
          .filter(Boolean).join(' · '),
        desfazivel: true,
      });
    }, MS_CARIMBO + MS_SAIDA);
  }

  /** Devolver para a lista — sem carimbo, só a saída. */
  function devolver(item: ShoppingItem) {
    if (emAnimacao(item.id)) return;
    setSaindo(p => new Set(p).add(item.id));
    agendar(() => {
      toggleShoppingItem(item.id);
      recarregar();
      setSaindo(p => { const n = new Set(p); n.delete(item.id); return n; });
      setAviso({
        chave: Date.now(),
        itemId: item.id,
        mensagem: `${item.name} voltou para a lista`,
        desfazivel: false,
      });
    }, MS_SAIDA);
  }

  function desfazer() {
    if (!aviso) return;
    toggleShoppingItem(aviso.itemId);
    recarregar();
    setAviso(null);
  }

  /*
   * O eleito só vale enquanto está PENDENTE. Conquistar o item ou excluí-lo
   * apaga a eleição sozinho, sem código de limpeza em cada caminho — é o que
   * se ganha guardando um id em vez de um booleano no item.
   */
  const proximo = itens.find(i => i.id === proximoId && !i.completed) ?? null;

  function eleger(id: string | null) {
    setProximoDeCompra(id);
    setProximoId(id);
  }

  const pendentes = itens.filter(i => !i.completed);
  const conquistados = itens.filter(i => i.completed);
  const verConquistados = filtro === CONQUISTADOS;

  const naCategoria = (i: ShoppingItem) => {
    if (filtro === 'todas') return true;
    if (filtro === SEM_CATEGORIA) return !i.categoryId;
    return i.categoryId === filtro;
  };

  const visiveis = verConquistados
    ? [...conquistados].sort((a, b) => {
        const da = dataConquista(a)?.getTime() ?? 0;
        const db = dataConquista(b)?.getTime() ?? 0;
        return db - da;
      })
    : pendentes.filter(naCategoria);


  /*
   * A trilha é GLOBAL: não segue o filtro de categoria.
   *
   * A barra anterior seguia, e por isso mudava ao clicar num filtro — o que
   * a fazia parecer o progresso da prateleira, não o seu. Progresso de quem
   * usa o app não muda porque a vista foi filtrada.
   */
  const totalConquistados = itens.filter(i => i.completed).length;


  const uso = getUsoDoArmazenamento();

  function abrirNovo() {
    setForm({
      ...FORM_VAZIO,
      categoryId: filtro !== 'todas' && filtro !== SEM_CATEGORIA && filtro !== CONQUISTADOS ? filtro : '',
    });
    setFormAberto(true);
  }

  function abrirEdicao(item: ShoppingItem) {
    setForm({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId ?? '',
      price: item.price !== undefined ? String(item.price) : '',
      tolerancia: item.tolerancia !== undefined ? String(item.tolerancia) : '',
      guardado: item.guardado !== undefined ? String(item.guardado) : '',
      productUrl: item.productUrl ?? '',
      imageData: item.imageData ?? '',
      imageUrl: item.imageUrl ?? '',
      notes: item.notes ?? '',
    });
    setFormAberto(true);
  }

  async function usarArquivo(arquivo: File) {
    try {
      const mini = await reduzirImagem(arquivo);
      setForm(f => ({ ...f, imageData: mini, imageUrl: '' }));
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao processar a imagem.');
    }
  }

  async function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (arquivo) await usarArquivo(arquivo);
    if (arquivoRef.current) arquivoRef.current.value = '';
  }

  /** Ctrl+V com uma foto copiada da loja cai direto no campo. */
  function colar(e: React.ClipboardEvent) {
    const arquivo = Array.from(e.clipboardData.files).find(f => f.type.startsWith('image/'));
    if (!arquivo) return;
    e.preventDefault();
    void usarArquivo(arquivo);
  }

  function salvarItem() {
    if (!form.name.trim()) return;
    const preco = form.price.trim() ? Number(form.price.replace(',', '.')) : undefined;
    const ok = saveShoppingItem({
      id: form.id,
      name: form.name.trim(),
      categoryId: form.categoryId || undefined,
      price: preco !== undefined && !Number.isNaN(preco) ? preco : undefined,
      tolerancia: numeroOuNada(form.tolerancia),
      guardado: numeroOuNada(form.guardado),
      productUrl: form.productUrl.trim() || undefined,
      imageData: form.imageData || undefined,
      imageUrl: form.imageData ? undefined : form.imageUrl.trim() || undefined,
      notes: form.notes.trim() || undefined,
    });
    if (!ok) { setErro(getUltimoErroDeGravacao()); return; }
    setFormAberto(false);
    recarregar();
  }

  /** Enter salva a partir de qualquer campo de uma linha. */
  function enterSalva(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); salvarItem(); }
  }

  function salvarCategoria() {
    if (!catForm.name.trim()) return;
    const nova = saveShoppingCategory({
      id: catForm.id || undefined,
      name: catForm.name.trim(),
      icon: catForm.icon,
      color: catForm.color,
    });
    // Criada de dentro do formulário de item: já deixa selecionada.
    if (!catForm.id && formAberto) setForm(f => ({ ...f, categoryId: nova.id }));
    setCatAberta(false);
    setCatForm({ id: '', name: '', icon: 'target', color: CORES[0] });
    recarregar();
  }

  const contarEm = (id: string) =>
    pendentes.filter(i => (id === SEM_CATEGORIA ? !i.categoryId : i.categoryId === id)).length;

  const acharCategoria = (id?: string) => categorias.find(c => c.id === id);

  return (
    /*
     * DUAS camadas, e a separação importa.
     *
     * A `prancha` carrega o fundo e a malha, então ela precisa ocupar a ABA
     * INTEIRA. Estava junto com o `max-w-4xl`, e o resultado era a prancha
     * virar um retângulo de 896px boiando num vão escuro — o mundo terminava
     * no meio da tela.
     *
     * O `.tube-amber` do Pote de Biscoitos pode viver na caixa estreita
     * porque define SÓ variáveis de cor, sem fundo. Ao dar fundo à prancha eu
     * saí desse padrão sem levar o contêiner junto.
     *
     * A altura mínima desconta a barra de navegação do celular, que fica
     * dentro do `main`: sem isso, `100dvh` aqui dentro criaria 4rem de
     * rolagem morta no telefone.
     */
    <div className="prancha min-h-[calc(100dvh-4rem)] w-full p-4 animate-fade-in md:min-h-dvh md:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-4xl">
      {/* Cabeçalho */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Compras</h1>
        <div className="flex gap-2">
          {/* Só o "+", num círculo de roxo calmo. O gradiente forte do
              `btn-grad` puxava o olho para o canto superior direito antes de
              qualquer coisa da lista — e a lista é o assunto da tela. */}
          <button
            onClick={() => setRelatorioAberto(true)}
            aria-label="Relatório"
            title="Relatório"
            className="flex h-10 w-10 items-center justify-center rounded-[3px] border-solid transition-colors duration-200"
            style={{
              borderWidth: 2,
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-bg-card)',
              color: 'var(--color-text-muted)',
            }}
          >
            <ChartNoAxesColumn size={16} />
          </button>
          <button
            onClick={abrirNovo}
            aria-label="Novo item"
            title="Novo item"
            /* Quadrado de canto 3px, como as casas do calendário, os pinos da
               trilha e os segmentos da fita. Redondo destoava de uma aba em
               que tudo o mais tem canto reto. */
            className="flex h-10 w-10 items-center justify-center rounded-[3px] border-solid transition-colors duration-200"
            style={{
              borderWidth: 2,
              borderColor: 'color-mix(in oklab, var(--color-accent) 55%, transparent)',
              backgroundColor: 'color-mix(in oklab, var(--color-accent) 16%, transparent)',
              color: 'var(--color-accent-light)',
            }}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <FaixaDeLegenda
        emProjeto={{ itens: pendentes.length, valor: totalDaLista(pendentes) }}
        executado={{ itens: conquistados.length, valor: totalDaLista(conquistados) }}
      />

      <TrilhaDeMarcos conquistados={totalConquistados} />

      {/* Aviso de armazenamento */}
      {erro && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-bg p-3">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-danger" />
          <p className="flex-1 text-sm text-text-primary">{erro}</p>
          <button onClick={() => setErro(null)} className="text-text-muted hover:text-text-primary">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="mb-5">
        <FitaDeCategorias
          ativo={filtro}
          onEscolher={setFiltro}
          onNova={() => setGerenciarAberto(true)}
          segmentos={[
            { chave: 'todas', rotulo: 'Todas', contagem: pendentes.length },
            ...categorias.map(c => ({
              chave: c.id, rotulo: c.name, cor: c.color, icone: c.icon, contagem: contarEm(c.id),
            })),
            // "Sem categoria" só existe quando existe item sem categoria.
            ...(pendentes.some(i => !i.categoryId)
              ? [{ chave: SEM_CATEGORIA, rotulo: 'Sem categoria', contagem: contarEm(SEM_CATEGORIA) }]
              : []),
            /*
             * "Conquistados" entra na fita como último segmento.
             *
             * Ficou de fora na primeira versão, como pílula redonda, sob o
             * argumento de que não é categoria e sim modo de ver. O argumento
             * é verdadeiro e o resultado foi ruim: ao lado de uma fita
             * quadrada de fonte arcade, a pílula não lia como "outra coisa",
             * lia como sobra.
             *
             * Chegou a ter a cor de sucesso para se distinguir, e o verde
             * destoou de tudo. Fica no roxo da aba: a posição no fim da fita
             * e o número já bastam para separá-lo das categorias.
             */
            { chave: CONQUISTADOS, rotulo: 'Conquistados', contagem: conquistados.length },
          ]}
        />
      </div>

      {proximo && (
        <DetalheDoProximo
          item={proximo}
          cor={categorias.find(c => c.id === proximo.categoryId)?.color ?? 'var(--color-accent)'}
          onAbrir={() => abrirEdicao(proximo)}
          onSoltar={() => eleger(null)}
        />
      )}

      {/* Grade */}
      {visiveis.length === 0 ? (
        <EmptyState
          icon={verConquistados ? <Check size={26} /> : <ShoppingBag size={26} />}
          message={
            verConquistados ? 'Nada conquistado ainda'
            : itens.length === 0 ? 'Nada na lista ainda'
            : 'Nenhum item nesta categoria'
          }
          subtitle={
            verConquistados
              ? 'O que você comprar aparece aqui, com foto, preço e data.'
              : 'Adicione produtos com foto, preço e link para não esquecer.'
          }
          actionLabel={verConquistados ? undefined : 'Adicionar item'}
          onAction={verConquistados ? undefined : abrirNovo}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visiveis.map(item => (
            <CardProduto
              key={item.id}
              item={item}
              categoria={acharCategoria(item.categoryId)}
              onToggle={() => (item.completed ? devolver(item) : conquistar(item))}
              marcando={marcando.has(item.id)}
              saindo={saindo.has(item.id)}
              onEditar={() => abrirEdicao(item)}
              ehProximo={item.id === proximoId}
              onEleger={() => eleger(item.id === proximoId ? null : item.id)}
              onExcluir={() => setExcluirItem(item)}
            />
          ))}
        </div>
      )}

      {/* Uso do armazenamento */}
      {uso.percentual > 1 && (
        <p className="mt-8 text-xs text-text-muted">
          Armazenamento: {formatarBytes(uso.bytes)} de ~5 MB ({uso.percentual.toFixed(0)}%)
        </p>
      )}

      {aviso && (
        <Toast
          chave={aviso.chave}
          mensagem={aviso.mensagem}
          detalhe={aviso.detalhe}
          acaoRotulo={aviso.desfazivel ? 'Desfazer' : undefined}
          onAcao={aviso.desfazivel ? desfazer : undefined}
          onFechar={() => setAviso(null)}
        />
      )}

      {/* ── Modal de item ── */}
      <Modal
        isOpen={formAberto}
        onClose={() => setFormAberto(false)}
        title={form.id ? 'Editar item' : 'Novo item'}
        onPaste={colar}
        rodape={
          <div className="flex gap-3">
            <button onClick={() => setFormAberto(false)} className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary">
              Cancelar
            </button>
            <button onClick={salvarItem} disabled={!form.name.trim()} className="btn-grad flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40">
              {form.id ? 'Salvar' : 'Adicionar'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <Campo rotulo="Nome" obrigatorio>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={enterSalva}
              placeholder="Ex: Fone de ouvido"
              autoFocus
              className="entrada"
            />
          </Campo>

          {/* Categoria em chips: o <select> nativo abria o menu do sistema
              e ignorava a fonte, a cor e os cantos do resto do app. */}
          <Campo rotulo="Categoria">
            <div className="flex flex-wrap items-center gap-2">
              <FitaDeCategorias
                ativo={form.categoryId || SEM_CATEGORIA}
                onEscolher={ch => setForm(f => ({ ...f, categoryId: ch === SEM_CATEGORIA ? '' : ch }))}
                segmentos={[
                  /*
                   * "—", não "Sem categoria" por extenso.
                   *
                   * Aqui a opção é a primeira e vem selecionada por padrão, e
                   * o rótulo inteiro comia quase metade da fita — sobrava
                   * pouco espaço para as categorias, que são o assunto do
                   * campo. O travessão diz "nenhuma" e o `title` continua
                   * escrevendo por extenso para quem passa o mouse ou usa
                   * leitor de tela.
                   *
                   * Na fita do FILTRO ele continua por extenso: lá o segmento
                   * concorre com nomes de categoria e precisa se explicar.
                   */
                  { chave: SEM_CATEGORIA, rotulo: '—', titulo: 'Sem categoria' },
                  ...categorias.map(c => ({ chave: c.id, rotulo: c.name, cor: c.color, icone: c.icon })),
                ]}
              />
              <button
                type="button"
                onClick={() => { setCatForm({ id: '', name: '', icon: 'target', color: CORES[0] }); setCatAberta(true); }}
                aria-label="Nova categoria"
                title="Nova categoria"
                className="font-arcade flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[3px] border-2 border-dashed text-[0.7rem] leading-none transition-colors"
                style={{ borderColor: 'var(--color-border-light)', color: 'var(--color-text-muted)' }}
              >
                +
              </button>
            </div>
          </Campo>

          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Preço">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">R$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                  onKeyDown={enterSalva}
                  placeholder="199,90"
                  className="entrada pl-10 tabular-nums"
                />
              </div>
            </Campo>

            {/* Tolerância: raramente se sabe o preço exato do que ainda não
                se comprou. Sem este campo, o total da lista somava
                estimativas fingindo ser número certo. */}
            <Campo rotulo="Margem do preço">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">±</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.tolerancia}
                  onChange={e => setForm(f => ({ ...f, tolerancia: e.target.value }))}
                  onKeyDown={enterSalva}
                  placeholder="opcional"
                  className="entrada pl-8 tabular-nums"
                />
              </div>
            </Campo>
            <Campo rotulo="Link do produto">
              <input
                type="url"
                value={form.productUrl}
                onChange={e => setForm(f => ({ ...f, productUrl: e.target.value }))}
                onKeyDown={enterSalva}
                placeholder="https://..."
                className="entrada"
              />
            </Campo>
          </div>

          {/* Foto: enviar arquivo, colar com Ctrl+V ou apontar uma URL */}
          <Campo rotulo="Foto">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => arquivoRef.current?.click()}
                title="Escolher uma foto"
                className="group relative flex h-28 w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-bg-input transition-colors hover:border-accent"
              >
                {form.imageData || form.imageUrl ? (
                  <img src={form.imageData || form.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1.5 text-text-muted transition-colors group-hover:text-accent-light">
                    <ImagePlus size={22} />
                    <span className="text-[10px]">Enviar</span>
                  </span>
                )}
              </button>

              <div className="flex-1 space-y-2">
                <input
                  ref={arquivoRef}
                  type="file"
                  accept="image/*"
                  onChange={escolherArquivo}
                  className="hidden"
                />
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value, imageData: '' }))}
                  onKeyDown={enterSalva}
                  placeholder="ou cole o link da imagem"
                  className="entrada text-xs"
                />
                <p className="text-[11px] leading-relaxed text-text-muted">
                  Dá para colar uma imagem copiada com <span className="text-text-secondary">Ctrl+V</span> aqui dentro.
                </p>
                {form.imageData && (
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    A foto foi reduzida para caber no armazenamento do navegador.
                  </p>
                )}
                {(form.imageData || form.imageUrl) && (
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, imageData: '', imageUrl: '' }))}
                    className="text-xs text-text-muted transition-colors hover:text-danger"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </Campo>

          <Campo rotulo="Observação">
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Cor, tamanho, onde vi…"
              rows={2}
              className="entrada resize-none"
            />
          </Campo>
        </div>
      </Modal>

      {/* ── Gerenciar categorias ── */}
      <RelatorioDeCompras
        aberto={relatorioAberto}
        itens={itens}
        hoje={new Date().toISOString().slice(0, 10)}
        onFechar={() => setRelatorioAberto(false)}
      />

      <Modal isOpen={gerenciarAberto} onClose={() => setGerenciarAberto(false)} title="Categorias" maxWidth="max-w-md">
        {/* Lê como gerenciador de CAMADAS, que é o que a fita virou: o
            quadradinho da cor, o nome em micro-caixa-alta e a contagem. Era
            uma lista de pílulas `rounded-xl` de texto normal, na linguagem
            antiga do app — destoava da aba inteira. */}
        <div className="space-y-1.5">
          {categorias.length === 0 && (
            <p className="py-3 text-xs leading-relaxed text-text-muted">
              Nenhuma categoria ainda. Elas agrupam os itens da lista e viram
              camadas na barra de cima, que você liga e desliga para filtrar.
            </p>
          )}
          {categorias.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-md border-solid px-3 py-2.5"
              style={{ borderWidth: 1, borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-input)' }}
            >
              <span
                className="h-[9px] w-[9px] flex-shrink-0 rounded-[1px] border"
                style={{
                  backgroundColor: c.color ?? CORES[0],
                  borderColor: c.color ?? CORES[0],
                  boxShadow: `0 0 5px ${c.color ?? CORES[0]}`,
                }}
                aria-hidden
              />
              <HabitIcon name={c.icon} size={13} color={c.color} />
              <span className="font-arcade min-w-0 flex-1 truncate text-[0.5rem] uppercase leading-none text-text-primary">
                {c.name}
              </span>
              <span className="font-arcade text-[0.55rem] leading-none text-text-muted">{contarEm(c.id)}</span>
              <button
                onClick={() => { setCatForm({ id: c.id, name: c.name, icon: c.icon ?? 'target', color: c.color ?? CORES[0] }); setCatAberta(true); }}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-accent-light"
                title="Editar"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => setExcluirCat(c)}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-danger"
                title="Excluir"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            onClick={() => { setCatForm({ id: '', name: '', icon: 'target', color: CORES[0] }); setCatAberta(true); }}
            className="font-arcade mt-3 flex w-full items-center justify-center gap-2 rounded-md border-solid py-3 text-[0.5rem] uppercase leading-none transition-colors duration-200"
            style={{
              borderWidth: 1,
              borderColor: 'color-mix(in oklab, var(--color-accent) 40%, transparent)',
              backgroundColor: 'color-mix(in oklab, var(--color-accent) 12%, transparent)',
              color: 'var(--color-accent-light)',
            }}
          >
            <Plus size={13} />
            Nova categoria
          </button>
        </div>
      </Modal>

      {/* ── Modal de categoria ── */}
      <Modal isOpen={catAberta} onClose={() => setCatAberta(false)} title={catForm.id ? 'Editar categoria' : 'Nova categoria'} maxWidth="max-w-md">
        <div className="space-y-4">
          <Campo rotulo="Nome" obrigatorio>
            <input
              type="text"
              value={catForm.name}
              onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarCategoria(); } }}
              placeholder="Ex: Roupas, Eletrônicos"
              autoFocus
              className="entrada"
            />
          </Campo>

          <Campo rotulo="Cor">
            <div className="flex flex-wrap gap-2">
              {CORES.map(cor => (
                <button
                  key={cor}
                  type="button"
                  onClick={() => setCatForm(f => ({ ...f, color: cor }))}
                  className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                  style={{
                    backgroundColor: cor,
                    boxShadow: catForm.color === cor ? `0 0 0 2px var(--color-bg-card), 0 0 0 4px ${cor}` : 'none',
                  }}
                />
              ))}
            </div>
          </Campo>

          <Campo rotulo="Ícone">
            <div className="flex flex-wrap gap-2">
              {HABIT_ICON_KEYS.map(k => {
                const ativo = catForm.icon === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCatForm(f => ({ ...f, icon: k }))}
                    title={HABIT_ICONS[k].label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border transition-transform hover:scale-110"
                    style={{
                      backgroundColor: ativo ? `color-mix(in oklab, ${catForm.color} 22%, transparent)` : 'var(--color-bg-input)',
                      borderColor: ativo ? catForm.color : 'var(--color-border)',
                    }}
                  >
                    <HabitIcon name={k} size={16} color={ativo ? catForm.color : 'var(--color-text-muted)'} />
                  </button>
                );
              })}
            </div>
          </Campo>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setCatAberta(false)} className="flex-1 rounded-xl bg-bg-card-hover py-3 text-sm font-semibold text-text-secondary hover:text-text-primary">
              Cancelar
            </button>
            <button onClick={salvarCategoria} disabled={!catForm.name.trim()} className="btn-grad flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40">
              Salvar
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!excluirItem}
        onClose={() => setExcluirItem(null)}
        onConfirm={() => { if (excluirItem) { deleteShoppingItem(excluirItem.id); setExcluirItem(null); recarregar(); } }}
        title="Remover item"
        message={`Remover "${excluirItem?.name}" da lista?`}
        confirmLabel="Remover"
        danger
      />

      <ConfirmDialog
        isOpen={!!excluirCat}
        onClose={() => setExcluirCat(null)}
        onConfirm={() => {
          if (excluirCat) {
            deleteShoppingCategory(excluirCat.id);
            if (filtro === excluirCat.id) setFiltro('todas');
            setExcluirCat(null);
            recarregar();
          }
        }}
        title="Excluir categoria"
        message={`Excluir "${excluirCat?.name}"? Os itens dela não são apagados — voltam para "Sem categoria".`}
        confirmLabel="Excluir"
        danger
      />
      </div>
    </div>
  );
}

// ── Subcomponentes ──

function Campo({ rotulo, obrigatorio, children }: { rotulo: string; obrigatorio?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {rotulo} {obrigatorio && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function CardProduto({
  item, categoria, onToggle, onEditar, onExcluir, onEleger, ehProximo, marcando, saindo,
}: {
  item: ShoppingItem;
  categoria?: ShoppingCategory;
  ehProximo?: boolean;
  onEleger: () => void;
  onToggle: () => void;
  onEditar: () => void;
  onExcluir: () => void;
  marcando?: boolean;
  saindo?: boolean;
}) {
  const cor = categoria?.color ?? 'var(--color-accent)';
  const foto = item.imageData || item.imageUrl;
  const marcado = item.completed || marcando;
  const quando = item.completed ? dataConquista(item) : null;

  return (
    // O card inteiro é o alvo de edição; o check e os botões da barra de
    // baixo param a propagação para não editar sem querer.
    <div
      onClick={onEditar}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onEditar(); }}
      title="Editar item"
      /*
       * Em desenho técnico, o que ainda não foi construído se desenha
       * TRACEJADO; o que existe, contínuo. É a regra que dá o estado do item
       * sem selo, sem check e sem borda colorida — três mecanismos que antes
       * faziam o mesmo trabalho ao mesmo tempo.
       */
      className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-bg-card transition-[opacity,border-color,transform] duration-[260ms] ease-out ${
        marcado ? 'border-solid' : 'border-dashed'
      } ${saindo ? 'scale-95 opacity-0' : ''}`}
      style={{ borderColor: marcado ? cor : 'var(--color-border-light)' }}
    >
      {/* Foto — ou, sem foto, um painel na cor da categoria em vez de um
          buraco vazio com um saco esmaecido no meio. */}
      <div className="relative flex h-32 items-center justify-center overflow-hidden bg-bg-input">
        {foto ? (
          // object-contain, não cover: o cover cortava as bordas do produto
          // para preencher o quadro. As fotos já vêm reduzidas a 240px.
          <img
            src={foto}
            alt=""
            loading="lazy"
            className={`h-full w-full object-contain p-2 transition-[filter,opacity] duration-300 ${
              item.completed ? 'opacity-70 grayscale-[0.6]' : ''
            }`}
          />
        ) : (
          <>
            <span
              className="absolute inset-0"
              style={{ backgroundImage: `linear-gradient(140deg, color-mix(in oklab, ${cor} 24%, transparent), transparent 72%)` }}
            />
            <span className="relative opacity-35">
              {categoria
                ? <HabitIcon name={categoria.icon} size={40} color={cor} />
                : <ShoppingBag size={38} style={{ color: cor }} />}
            </span>
          </>
        )}

        {/* Hachura de corte: em desenho técnico é assim que se mostra que
            ali tem MATÉRIA. Faz par com a borda tracejada — projetado vira
            executado. */}
        {marcado && <span className="hachura pointer-events-none absolute inset-0" aria-hidden />}

        {/* Véu no topo: mantém o check e o selo legíveis sobre foto clara */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/45 to-transparent" />

        {/*
          * O carimbo diagonal É o estado, não só a comemoração do instante.
          *
          * Havia dois: este no meio, só durante a animação da compra, e um
          * selo pequeno no canto superior esquerdo para o resto do tempo. O
          * do canto era o pior dos dois e ficava o tempo todo. Agora o
          * diagonal fica — a animação e o véu escuro entram apenas no
          * momento da compra, que é quando há o que comemorar.
          */}
        {marcado && (
          <div className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${marcando ? 'bg-black/45' : ''}`}>
            <span
              className={`${marcando ? 'carimbo' : ''} rounded-[3px] border-2 px-2.5 py-2 font-arcade text-[9px] leading-none`}
              style={{
                borderColor: cor,
                color: cor,
                transform: 'rotate(-8deg)',
                textShadow: `0 0 10px ${cor}`,
                boxShadow: `0 0 20px color-mix(in oklab, ${cor} 45%, transparent)`,
                backgroundColor: 'rgba(0,0,0,0.35)',
              }}
            >
              CONQUISTADO
            </span>
          </div>
        )}

        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          title={item.completed ? 'Devolver para a lista' : 'Marcar como conquistado'}
          className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform duration-200 hover:scale-110"
          style={{
            backgroundColor: marcado ? cor : 'rgba(0,0,0,0.5)',
            borderColor: marcado ? cor : 'rgba(255,255,255,0.4)',
            boxShadow: marcado ? `0 0 14px color-mix(in oklab, ${cor} 55%, transparent)` : 'none',
          }}
        >
          {marcado && <Check size={15} strokeWidth={3} className="text-bg-primary" />}
        </button>
      </div>

      {/* Conteúdo */}
      <div className="p-4">
        {categoria && (
          <p className="mb-1 truncate text-[10px] uppercase tracking-wider" style={{ color: cor }}>
            {categoria.name}
          </p>
        )}
        <h3 className="text-sm font-semibold text-text-primary">{item.name}</h3>
        {item.notes && <p className="mt-0.5 truncate text-xs text-text-muted">{item.notes}</p>}
        {quando && (
          <p className="mt-0.5 text-xs text-text-muted">
            {formatDistanceToNow(quando, { addSuffix: true, locale: ptBR })}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between">
          {/* Preço em branco: a cor da categoria fica só no rótulo dela,
              senão os dois disputam o mesmo destaque. */}
          {/* A tolerância vem em corpo menor e apagado: ela qualifica o
              preço, não compete com ele. Prancha cota assim — o valor manda,
              a margem sussurra. */}
          <span className={`text-sm font-semibold tabular-nums ${item.price ? 'text-text-primary' : 'text-text-muted'}`}>
            {item.price ? moeda(item.price) : '—'}
            {item.price && item.tolerancia ? (
              <span className="ml-1 text-[11px] font-normal text-text-muted">±{item.tolerancia}</span>
            ) : null}
          </span>
          {/* Sempre visíveis: no celular não existe hover, e antes estas
              ações ficavam inalcançáveis. Editar saiu daqui — agora é o
              card inteiro. */}
          <div className="flex items-center gap-1 opacity-45 transition-opacity group-hover:opacity-100">
            {item.productUrl && (
              <a
                href={item.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title="Abrir link do produto"
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-accent-light"
              >
                <ExternalLink size={14} />
              </a>
            )}
            {/* Eleger como o próximo. Só para item pendente: eleger o que já
                foi comprado não quer dizer nada. */}
            {!item.completed && (
              <button
                onClick={e => { e.stopPropagation(); onEleger(); }}
                title={ehProximo ? 'Deixar de ser o próximo' : 'Eleger como o próximo'}
                className="rounded-lg p-1.5 transition-colors"
                style={{ color: ehProximo ? 'var(--color-accent)' : undefined }}
              >
                <Crosshair size={14} className={ehProximo ? '' : 'text-text-muted'} />
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onExcluir(); }}
              title="Remover"
              className="rounded-lg p-1.5 text-text-muted transition-colors hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
