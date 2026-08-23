import { useEffect, useRef, useState } from 'react';

/**
 * Número que sobe do zero até o valor, como mostrador de máquina girando.
 *
 * Anima SÓ na primeira montagem. Animar a cada render faria o número tremer
 * toda vez que qualquer estado da página mudasse — passar o mouse num
 * gráfico refaria a contagem do placar, que é ruído puro.
 *
 * Respeita `prefers-reduced-motion`: quem pediu menos movimento vê o valor
 * final direto, não uma versão mais lenta.
 */
export default function NumeroRolante({
  valor, duracao = 700,
}: { valor: number; duracao?: number }) {
  const jaAnimou = useRef(false);
  const [mostrado, setMostrado] = useState(valor);

  useEffect(() => {
    if (jaAnimou.current) { setMostrado(valor); return; }
    jaAnimou.current = true;

    const semMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (semMovimento || valor === 0) { setMostrado(valor); return; }

    let quadro = 0;
    const inicio = performance.now();
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      // Desaceleração cúbica: o mostrador chega devagar no número final,
      // que é como leitor mecânico para.
      const eased = 1 - Math.pow(1 - t, 3);
      setMostrado(Math.round(valor * eased));
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [valor, duracao]);

  return <>{mostrado}</>;
}
