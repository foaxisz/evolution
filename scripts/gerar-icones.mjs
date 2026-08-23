import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gera os PNG do ícone do app sem depender de nenhuma biblioteca.
 *
 * A máquina não tem ImageMagick, sharp nem resvg — e o `convert` do PATH
 * no Windows é o utilitário que converte FAT em NTFS, não o do ImageMagick.
 * Como o desenho é pixel art, escrever o PNG à mão sai mais barato do que
 * arrastar uma dependência de imagem só para isto: PNG sem entrelaçamento
 * é assinatura + IHDR + IDAT (linhas cruas em zlib) + IEND.
 *
 * Rodar com: node scripts/gerar-icones.mjs
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── Paleta, a mesma do app ────────────────────────────────────────────
const FUNDO = [18, 14, 34, 255];        // #120e22 — um degrau acima do bg
const ROXO = [168, 85, 247, 255];       // --color-accent
const ROXO_CLARO = [200, 140, 255, 255];// --color-accent-light
const BASE = [63, 49, 99, 255];         // --color-border-light

// ══════════════════════════════════════════════════════════════════════
// Escrita de PNG
// ══════════════════════════════════════════════════════════════════════

const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pedaco(tipo, dados) {
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tam, corpo, crc]);
}

function paraPNG(pixels, largura, altura) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;   // 8 bits por canal
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // filtro adaptativo
  ihdr[12] = 0;  // sem entrelaçamento

  // Cada linha leva um byte de filtro na frente; 0 = sem filtro, que é o
  // suficiente para arte chapada e mantém o código legível.
  const cru = Buffer.alloc(altura * (largura * 4 + 1));
  for (let y = 0; y < altura; y++) {
    const destino = y * (largura * 4 + 1);
    cru[destino] = 0;
    pixels.copy(cru, destino + 1, y * largura * 4, (y + 1) * largura * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', ihdr),
    pedaco('IDAT', deflateSync(cru, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

// ══════════════════════════════════════════════════════════════════════
// Desenho
// ══════════════════════════════════════════════════════════════════════

function tela(largura, altura) {
  return { dados: Buffer.alloc(largura * altura * 4), largura, altura };
}

/** Composição normal (source-over) de um retângulo. */
function retangulo(t, x0, y0, x1, y1, [r, g, b, a]) {
  const ax0 = Math.max(0, Math.round(x0));
  const ay0 = Math.max(0, Math.round(y0));
  const ax1 = Math.min(t.largura, Math.round(x1));
  const ay1 = Math.min(t.altura, Math.round(y1));
  const alfa = a / 255;

  for (let y = ay0; y < ay1; y++) {
    for (let x = ax0; x < ax1; x++) {
      const i = (y * t.largura + x) * 4;
      const aDestino = t.dados[i + 3] / 255;
      const aSaida = alfa + aDestino * (1 - alfa);
      if (aSaida === 0) continue;
      t.dados[i] = (r * alfa + t.dados[i] * aDestino * (1 - alfa)) / aSaida;
      t.dados[i + 1] = (g * alfa + t.dados[i + 1] * aDestino * (1 - alfa)) / aSaida;
      t.dados[i + 2] = (b * alfa + t.dados[i + 2] * aDestino * (1 - alfa)) / aSaida;
      t.dados[i + 3] = aSaida * 255;
    }
  }
}

/** Zera o alfa fora de um quadrado de cantos arredondados. */
function arredondar(t, raio) {
  const { largura: L, altura: A } = t;
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      const dx = x < raio ? raio - x - 0.5 : x >= L - raio ? x - (L - raio) + 0.5 : 0;
      const dy = y < raio ? raio - y - 0.5 : y >= A - raio ? y - (A - raio) + 0.5 : 0;
      if (dx * dx + dy * dy > raio * raio) t.dados[(y * L + x) * 4 + 3] = 0;
    }
  }
}

/**
 * A marca: quatro barras subindo, com a ponta acesa.
 *
 * É a mesma leitura do bloco "Sua evolução" — acúmulo que só cresce — e do
 * favicon, que já era uma linha ascendente. Em barra e não em curva porque
 * curva de 3px some num ícone de 48px na gaveta do celular.
 *
 * `escala` é a fração do lado ocupada pela arte: no ícone mascarável ela
 * encolhe para caber na zona segura que o Android recorta.
 */
function desenharMarca(t, escala) {
  const lado = t.largura;
  const arte = lado * escala;
  const ox = (lado - arte) / 2;
  const oy = (lado - arte) / 2;

  const alturas = [0.34, 0.54, 0.74, 1.0];
  const larguraBarra = arte * 0.165;
  const vao = arte * 0.078;
  const totalBarras = alturas.length * larguraBarra + (alturas.length - 1) * vao;
  const inicioX = ox + (arte - totalBarras) / 2;
  const baseY = oy + arte * 0.9;
  const ponta = Math.max(2, arte * 0.055);

  // Linha de base, apagada — dá chão às barras.
  retangulo(t, inicioX - vao, baseY, inicioX + totalBarras + vao, baseY + Math.max(2, arte * 0.028), BASE);

  alturas.forEach((h, i) => {
    const x = inicioX + i * (larguraBarra + vao);
    const topo = baseY - arte * 0.78 * h;

    // Halo: a mesma barra, mais larga e translúcida. Substitui o desfoque,
    // que exigiria convolução à mão sem ganho visível neste tamanho.
    retangulo(t, x - arte * 0.02, topo - arte * 0.02, x + larguraBarra + arte * 0.02, baseY, [...ROXO.slice(0, 3), 46]);

    retangulo(t, x, topo, x + larguraBarra, baseY, ROXO);
    retangulo(t, x, topo, x + larguraBarra, topo + ponta, ROXO_CLARO);
  });
}

function gerar({ arquivo, lado, escala, raio }) {
  const t = tela(lado, lado);
  retangulo(t, 0, 0, lado, lado, FUNDO);
  desenharMarca(t, escala);
  if (raio) arredondar(t, raio);

  const destino = join(RAIZ, 'public', arquivo);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, paraPNG(t.dados, lado, lado));
  return `${arquivo} (${lado}x${lado})`;
}

const feitos = [
  // `any`: cantos arredondados, arte folgada.
  gerar({ arquivo: 'icone-192.png', lado: 192, escala: 0.72, raio: 42 }),
  gerar({ arquivo: 'icone-512.png', lado: 512, escala: 0.72, raio: 112 }),
  // `maskable`: sangra até a borda e a arte cabe na zona segura de 80%,
  // porque o Android recorta o ícone no formato do sistema.
  gerar({ arquivo: 'icone-maskable-512.png', lado: 512, escala: 0.52, raio: 0 }),
  // iOS arredonda sozinho — mandar já arredondado deixaria borda dupla.
  gerar({ arquivo: 'apple-touch-icon.png', lado: 180, escala: 0.66, raio: 0 }),
];

console.log('Ícones gerados em public/:');
feitos.forEach(f => console.log('  ' + f));
