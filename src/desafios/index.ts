/**
 * Registro dos desafios. Cada desafio tem uma página própria em código —
 * não são criados pelo app. Para adicionar um novo: crie o componente da
 * página e registre a definição aqui.
 */
export interface DefinicaoDesafio {
  id: string;
  titulo: string;
  subtitulo: string;
  meta: number;
  unidade: string;
  cor: string;
  /** chave de HABIT_ICONS */
  icone: string;
  inicio: string;
}

export const DESAFIOS: DefinicaoDesafio[] = [
  {
    id: 'mil-interacoes',
    titulo: 'Mil Interações',
    subtitulo: 'Puxar conversa até virar natural',
    meta: 1000,
    unidade: 'interações',
    cor: '#a855f7',
    icone: 'brain',
    inicio: '2026-06-28',
  },
];

export function acharDesafio(id: string): DefinicaoDesafio | undefined {
  return DESAFIOS.find(d => d.id === id);
}
