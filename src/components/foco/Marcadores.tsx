import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

/** Altura da caixa de linha do texto: 16px × 1,5. O marcador se centra
 *  nela, então nunca depende de um deslocamento chutado à mão. */
const ALTURA_DA_LINHA = 'h-6';

export interface AcaoDeCabecalho {
  icone: React.ReactNode;
  rotulo: string;
  aoClicar: () => void;
}

/**
 * Botão de ícone que acende na cor da frente ao apontar.
 *
 * A cor vem por estado do React e não por `:hover` no CSS porque ela é de
 * cada frente, não do tema. Antes estes botões usavam `hover:text-primary`,
 * que é quase branco — ao lado dos ícones da barra de sistema, que acendem
 * em roxo, um deles virava um quadrado claro fora do padrão.
 *
 * Sem fundo no hover: quem sinaliza é a cor do traço, como no resto do app.
 */
export function BotaoDeIcone({
  rotulo, cor, aoClicar, corAoApontar, className = '', children,
}: {
  rotulo: string;
  cor: string;
  aoClicar: () => void;
  /** Padrão: a cor da frente. O botão de remover usa a de perigo. */
  corAoApontar?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [apontando, setApontando] = useState(false);
  return (
    <button
      onClick={aoClicar}
      onMouseEnter={() => setApontando(true)}
      onMouseLeave={() => setApontando(false)}
      onFocus={() => setApontando(true)}
      onBlur={() => setApontando(false)}
      aria-label={rotulo}
      title={rotulo}
      className={`botao-icone transition-colors ${className}`}
      style={{ color: apontando ? (corAoApontar ?? cor) : 'var(--color-text-muted)' }}
    >
      {children}
    </button>
  );
}

/**
 * Bloco de metas escritas: cabeçalho e lista, editável linha a linha.
 *
 * O `+` mora no cabeçalho, não embaixo da lista. Solto no fim ele era
 * mais um item da coluna — ficava na altura do olhar, competindo com o
 * conteúdo. No cabeçalho é sempre o mesmo lugar, some do caminho e
 * funciona igual com a lista vazia ou com dez itens.
 *
 * Sem caixa de marcar: isto é o que o período precisa entregar, não a
 * fila de trabalho. A fila é a lista de tarefas.
 */
export default function Marcadores({
  titulo, apoio, iniciais, cor, acoes = [], onGravar, topo, children,
}: {
  titulo: string;
  apoio?: string;
  /**
   * Lido só na montagem, de propósito.
   *
   * Enquanto se edita, quem manda na lista é este componente. Se ele
   * também aceitasse a lista de fora a cada render, a gravação de uma
   * linha voltaria como propriedade e apagaria a linha em branco que o
   * Enter tinha acabado de abrir.
   */
  iniciais: string[];
  cor: string;
  acoes?: AcaoDeCabecalho[];
  onGravar: (marcadores: string[]) => void;
  /** Conteúdo entre o cabeçalho e a lista — o seletor de período do
   *  trimestre, por exemplo. Fica ACIMA porque é o que define o que a
   *  lista abaixo significa. */
  topo?: React.ReactNode;
  /** Conteúdo extra depois da lista — a semana passada, por exemplo. */
  children?: React.ReactNode;
}) {
  const [itens, setItens] = useState(iniciais);
  const [editando, setEditando] = useState<number | null>(null);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editando === null) return;
    campo.current?.focus();
    campo.current?.select();
  }, [editando]);

  function gravar(lista: string[]) {
    const limpos = lista.map(m => m.trim()).filter(Boolean);
    setItens(limpos);
    onGravar(limpos);
    return limpos;
  }

  function acrescentar() {
    setItens(atual => [...atual, '']);
    setEditando(itens.length);
  }

  /** Enter: grava o que está aberto e já abre a próxima linha. */
  function seguir(i: number) {
    const limpos = gravar(itens);
    // Linha vazia: gravar já a removeu — não abre outra em cima de um
    // vazio que acabou de sumir.
    if (itens[i]?.trim()) {
      setItens([...limpos, '']);
      setEditando(limpos.length);
    } else {
      setEditando(null);
    }
  }

  return (
    <section>
      {/* `gap-1` e botões de área real: com a expansão invisível de 44px do
          `.alvo-toque`, duas ações vizinhas disputavam o mesmo espaço e o
          clique caía sempre na última do DOM. */}
      <div className="mb-2 flex h-4 items-center gap-1">
        <h2 className="font-arcade flex-shrink-0 text-[0.45rem] uppercase leading-[1.4]" style={{ color: cor }}>
          {titulo}
        </h2>
        <span className="h-px flex-1" style={{ backgroundColor: 'var(--color-border)' }} />
        {apoio && <span className="flex-shrink-0 text-[10px] leading-none text-text-muted">{apoio}</span>}

        {acoes.map(a => (
          <BotaoDeIcone key={a.rotulo} rotulo={a.rotulo} cor={cor} aoClicar={a.aoClicar}>
            {a.icone}
          </BotaoDeIcone>
        ))}

        <BotaoDeIcone rotulo={`Acrescentar em ${titulo}`} cor={cor} aoClicar={acrescentar}>
          <Plus size={12} />
        </BotaoDeIcone>
      </div>

      {topo}

      <ul>
        {itens.map((m, i) => (
          <li key={i} className="group flex gap-2.5">
            <span className={`flex ${ALTURA_DA_LINHA} w-1 flex-shrink-0 items-center`} aria-hidden>
              <span className="h-1 w-1 rounded-[1px]" style={{ backgroundColor: cor }} />
            </span>

            {editando === i ? (
              <input
                ref={campo}
                value={m}
                onChange={e => setItens(atual => atual.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={() => { gravar(itens); setEditando(null); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); seguir(i); }
                  if (e.key === 'Escape') { e.preventDefault(); setItens(iniciais); setEditando(null); }
                }}
                className={`font-terminal min-w-0 flex-1 ${ALTURA_DA_LINHA} border-b bg-transparent text-[16px] leading-6 text-text-primary focus:outline-none`}
                style={{ borderColor: cor }}
              />
            ) : (
              <>
                <button
                  onClick={() => setEditando(i)}
                  className="font-terminal min-w-0 flex-1 cursor-text break-words text-left text-[16px] leading-6 text-text-primary"
                >
                  {m}
                </button>
                <BotaoDeIcone
                  rotulo={`Remover ${m}`}
                  cor={cor}
                  corAoApontar="var(--color-danger)"
                  aoClicar={() => { gravar(itens.filter((_, j) => j !== i)); setEditando(null); }}
                  className="opacity-0 group-hover:opacity-100"
                >
                  <X size={11} />
                </BotaoDeIcone>
              </>
            )}
          </li>
        ))}
      </ul>

      {children}
    </section>
  );
}

/** A mesma linha, só para leitura — usada no histórico. */
export function ItemDeMeta({ texto, cor }: { texto: string; cor: string }) {
  return (
    <li className="flex gap-2.5">
      <span className={`flex ${ALTURA_DA_LINHA} w-1 flex-shrink-0 items-center`} aria-hidden>
        <span className="h-1 w-1 rounded-[1px]" style={{ backgroundColor: cor }} />
      </span>
      <span className="font-terminal min-w-0 flex-1 break-words text-[16px] leading-6 text-text-primary">
        {texto}
      </span>
    </li>
  );
}
