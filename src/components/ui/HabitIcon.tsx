import {
  Droplet, Dumbbell, BookOpen, Brain, Moon, Footprints,
  Pill, Apple, Code, Music, PenLine, Sun, Heart, Target,
  Briefcase, Rocket, GraduationCap, Terminal, Lightbulb, Palette,
  PencilRuler, Camera, Video, Clapperboard, Guitar, Mic, Languages,
  Globe, Sprout, Coins, Wallet, TrendingUp, Microscope, FlaskConical,
  Gamepad2, Flame, Star, Trophy, Compass, Book,
} from 'lucide-react';

/**
 * Ícones disponíveis para hábitos E frentes de foco. A chave é o que fica
 * salvo em `habit.icon` / `categoria.icone`.
 *
 * Um mapa só de propósito: antes o Foco listava `briefcase`, `rocket` e
 * `palette`, mas o mapa não tinha essas chaves — todas caíam no fallback
 * `target`, e o seletor mostrava três alvos idênticos. Chave que não existe
 * aqui não deve existir em lista nenhuma.
 */
export const HABIT_ICONS = {
  target: { label: 'Geral', Icon: Target },
  briefcase: { label: 'Trabalho', Icon: Briefcase },
  rocket: { label: 'Projeto', Icon: Rocket },
  book: { label: 'Leitura', Icon: BookOpen },
  bookClosed: { label: 'Livro', Icon: Book },
  graduation: { label: 'Estudo', Icon: GraduationCap },
  code: { label: 'Código', Icon: Code },
  terminal: { label: 'Terminal', Icon: Terminal },
  pen: { label: 'Escrita', Icon: PenLine },
  brain: { label: 'Mente', Icon: Brain },
  lightbulb: { label: 'Ideias', Icon: Lightbulb },
  palette: { label: 'Design', Icon: Palette },
  ruler: { label: 'Projeto técnico', Icon: PencilRuler },
  camera: { label: 'Foto', Icon: Camera },
  video: { label: 'Vídeo', Icon: Video },
  clapper: { label: 'Edição', Icon: Clapperboard },
  music: { label: 'Música', Icon: Music },
  guitar: { label: 'Instrumento', Icon: Guitar },
  mic: { label: 'Voz / podcast', Icon: Mic },
  languages: { label: 'Idiomas', Icon: Languages },
  globe: { label: 'Mundo', Icon: Globe },
  dumbbell: { label: 'Treino', Icon: Dumbbell },
  footprints: { label: 'Caminhada', Icon: Footprints },
  heart: { label: 'Saúde', Icon: Heart },
  sprout: { label: 'Hábitos', Icon: Sprout },
  apple: { label: 'Alimentação', Icon: Apple },
  droplet: { label: 'Água', Icon: Droplet },
  pill: { label: 'Remédio', Icon: Pill },
  moon: { label: 'Sono', Icon: Moon },
  sun: { label: 'Manhã', Icon: Sun },
  coins: { label: 'Finanças', Icon: Coins },
  wallet: { label: 'Carteira', Icon: Wallet },
  trending: { label: 'Negócio', Icon: TrendingUp },
  science: { label: 'Ciência', Icon: Microscope },
  flask: { label: 'Experimento', Icon: FlaskConical },
  game: { label: 'Jogo', Icon: Gamepad2 },
  flame: { label: 'Foco', Icon: Flame },
  star: { label: 'Destaque', Icon: Star },
  trophy: { label: 'Meta', Icon: Trophy },
  compass: { label: 'Rumo', Icon: Compass },
} as const;

export type HabitIconKey = keyof typeof HABIT_ICONS;

export const HABIT_ICON_KEYS = Object.keys(HABIT_ICONS) as HabitIconKey[];

interface HabitIconProps {
  name?: string;
  size?: number;
  color?: string;
  fill?: boolean;
}

export default function HabitIcon({ name, size = 15, color, fill }: HabitIconProps) {
  const entry = HABIT_ICONS[(name as HabitIconKey) ?? 'target'] ?? HABIT_ICONS.target;
  const { Icon } = entry;
  return (
    <Icon
      size={size}
      style={{ color: color ?? 'currentColor' }}
      fill={fill ? (color ?? 'currentColor') : 'none'}
    />
  );
}
