import type { SessaoDeFoco, Action, CategoriaDeFoco } from '../types';
import { diaLocal, horaLocal, formatarData } from './data';
import { DIAS_CURTOS } from './metricas';

/** Planilha do mês, bloco a bloco. */

/**
 * Ponto e vírgula, não vírgula.
 *
 * O Excel em português decide o separador pela configuração regional, e
 * aqui ela é `;`. Um CSV com vírgula abre com tudo espremido na coluna A.
 */
const SEPARADOR = ';';

function campo(valor: string | number): string {
  const texto = String(valor);
  // Aspas duplicadas é como CSV escapa aspas — RFC 4180.
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function nomeDoAlvo(s: SessaoDeFoco, acoes: Action[]): string {
  if (s.actionId) return acoes.find(a => a.id === s.actionId)?.name ?? 'Tarefa removida';
  return s.rotulo || 'Foco livre';
}

export function montarCSV(
  sessoes: SessaoDeFoco[],
  acoes: Action[],
  categoria: CategoriaDeFoco,
  mes: string
): string {
  const doMes = sessoes
    .filter(s => s.tipo === 'foco' && s.categoriaId === categoria.id && diaLocal(s.inicio).startsWith(mes))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));

  const cabecalho = [
    'Data', 'Dia da semana', 'Início', 'Fim', 'Tarefa',
    'Minutos planejados', 'Minutos focados', 'Concluiu o bloco',
  ];

  const linhas = doMes.map(s => {
    const dia = diaLocal(s.inicio);
    const dow = new Date(`${dia}T12:00:00`).getDay();
    return [
      formatarData(dia, 'dd/MM/yyyy', dia),
      DIAS_CURTOS[dow],
      horaLocal(s.inicio),
      horaLocal(s.fim),
      nomeDoAlvo(s, acoes),
      s.minutosPlanejados,
      // Vírgula decimal: é o que o Excel em português espera.
      (s.segundosFocados / 60).toFixed(1).replace('.', ','),
      s.completa ? 'sim' : 'não',
    ];
  });

  const corpo = [cabecalho, ...linhas]
    .map(l => l.map(campo).join(SEPARADOR))
    .join('\r\n');

  // BOM na frente: sem ele o Excel lê o arquivo como Latin-1 e "Sessão"
  // vira "SessÃ£o".
  return `﻿${corpo}`;
}

// ── Download ──────────────────────────────────────────────────────────

/** Sem acento, sem espaço, sem barra — nome de arquivo que sobrevive a
 *  qualquer sistema. */
function sanear(nome: string): string {
  return nome
    // NFD separa a letra do acento; aí o acento sozinho é removido pela
    // faixa de marcas combinantes. Sem esse passo "Ação" viraria "a-o" em
    // vez de "acao", porque o filtro seguinte só deixa passar ASCII.
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'frente';
}

export function baixarArquivo(conteudo: string, nomeArquivo: string, tipo: string): void {
  const blob = new Blob([conteudo], { type: `${tipo};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Sem revogar, o blob fica na memória até a aba fechar. O atraso existe
  // porque revogar na mesma volta do laço cancela o download no Safari.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function nomeDoArquivo(categoria: CategoriaDeFoco, mes: string): string {
  return `evolution-${sanear(categoria.nome)}-${mes}.csv`;
}
