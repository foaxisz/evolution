/** Divide "2h 17min" em número e unidade — número grande, unidade pequena. */
function partes(segundos: number): { n: string; u: string }[] {
  const min = Math.round(segundos / 60);
  if (min < 60) return [{ n: String(min), u: 'min' }];
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto === 0 ? [{ n: String(h), u: 'h' }] : [{ n: String(h), u: 'h' }, { n: String(resto), u: 'min' }];
}

/**
 * Duração em leitura de placar: o valor em corpo cheio e a unidade em
 * corpo pequeno, na mesma linha de base.
 *
 * Fica fora dos gráficos porque também é o número do painel lateral da
 * cabine — importar "Graficos" dentro do cronômetro seria mentira sobre o
 * que a peça é.
 */
export default function Duracao({
  segundos, cor, tamanho = 'md',
}: { segundos: number; cor: string; tamanho?: 'md' | 'sm' }) {
  const grande = tamanho === 'md' ? 'text-[1.15rem]' : 'text-[0.8rem]';
  const pequeno = tamanho === 'md' ? 'text-[0.55rem]' : 'text-[0.45rem]';
  return (
    <span className="font-arcade inline-flex items-baseline leading-[1.45]" style={{ color: cor }}>
      {partes(segundos).map((p, i) => (
        <span key={i} className={i > 0 ? 'ml-1.5' : ''}>
          <span className={grande}>{p.n}</span>
          <span className={`${pequeno} text-text-muted`}>{p.u}</span>
        </span>
      ))}
    </span>
  );
}
