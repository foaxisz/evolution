import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gerador do ícone PWA da Evolution - Versão Limpa e Básica.
 * Desenha a seta ascendente limpa (linha com cantos arredondados, sem nós ou esferas),
 * centralizada sobre um fundo roxo vibrante elegante.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

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
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

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

function lerpColor(c1, c2, t) {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  const a = Math.round(c1[3] + (c2[3] - c1[3]) * t);
  return [r, g, b, a];
}

function criarBuffer(w, h) {
  return { dados: Buffer.alloc(w * h * 4), w, h };
}

function blendPixel(buf, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h || a <= 0) return;
  const i = (Math.floor(y) * buf.w + Math.floor(x)) * 4;
  const alpha = a / 255;
  const curA = buf.dados[i + 3] / 255;
  const outA = alpha + curA * (1 - alpha);
  if (outA <= 0) return;

  buf.dados[i] = Math.round((r * alpha + buf.dados[i] * curA * (1 - alpha)) / outA);
  buf.dados[i + 1] = Math.round((g * alpha + buf.dados[i + 1] * curA * (1 - alpha)) / outA);
  buf.dados[i + 2] = Math.round((b * alpha + buf.dados[i + 2] * curA * (1 - alpha)) / outA);
  buf.dados[i + 3] = Math.round(outA * 255);
}

// Distância de um ponto P a um segmento A-B
function distPontoSegmento(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * vx + (py - ay) * vy) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * vx;
  const projY = ay + t * vy;
  return Math.hypot(px - projX, py - projY);
}

// Distância a uma polilinha
function distPontoPolilinha(px, py, pontos) {
  let minDist = Infinity;
  for (let i = 0; i < pontos.length - 1; i++) {
    const d = distPontoSegmento(
      px,
      py,
      pontos[i][0],
      pontos[i][1],
      pontos[i + 1][0],
      pontos[i + 1][1]
    );
    if (d < minDist) minDist = d;
  }
  return minDist;
}

// Fundo roxo limpo, elegante e moderno
function desenharFundoRoxo(buf) {
  const corTopo = [124, 58, 237, 255]; // #7c3aed
  const corBase = [76, 29, 149, 255];  // #4c1d95

  for (let y = 0; y < buf.h; y++) {
    const t = y / buf.h;
    const bg = lerpColor(corTopo, corBase, t);
    for (let x = 0; x < buf.w; x++) {
      blendPixel(buf, x, y, bg);
    }
  }
}

// Desenha a seta limpa (linha branca pura com terminações arredondadas)
function desenharSetaLimpa(buf, escala = 0.65) {
  const size = buf.w;
  const artSize = size * escala;
  const ox = (size - artSize) / 2;
  const oy = (size - artSize) / 2;

  // Pontos da seta (gráfico ascendente limpo)
  const svgPoints = [
    [5, 25],
    [12, 15],
    [18, 19],
    [26, 7],
  ];

  const pontos = svgPoints.map(([sx, sy]) => [
    ox + (sx / 32) * artSize,
    oy + (sy / 32) * artSize,
  ]);

  const espessura = artSize * 0.13;
  const raioStroke = espessura / 2;

  const boundMinX = Math.floor(ox - espessura * 2);
  const boundMaxX = Math.ceil(ox + artSize + espessura * 2);
  const boundMinY = Math.floor(oy - espessura * 2);
  const boundMaxY = Math.ceil(oy + artSize + espessura * 2);

  // Seta em branco puro (#ffffff) com antialiasing perfeito
  const corLinha = [255, 255, 255, 255];

  for (let y = boundMinY; y <= boundMaxY; y++) {
    for (let x = boundMinX; x <= boundMaxX; x++) {
      const d = distPontoPolilinha(x, y, pontos);
      if (d <= raioStroke + 1) {
        let alpha = 1;
        if (d > raioStroke) {
          alpha = 1 - (d - raioStroke);
        }

        const corFinal = [corLinha[0], corLinha[1], corLinha[2], Math.round(255 * alpha)];
        blendPixel(buf, x, y, corFinal);
      }
    }
  }
}

function aplicarSquircle(buf, raioFracao = 0.22) {
  const r = buf.w * raioFracao;
  const w = buf.w;
  const h = buf.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx = 0;
      let dy = 0;

      if (x < r) dx = r - x - 0.5;
      else if (x > w - r) dx = x - (w - r) + 0.5;

      if (y < r) dy = r - y - 0.5;
      else if (y > h - r) dy = y - (h - r) + 0.5;

      const distSq = dx * dx + dy * dy;
      if (distSq > r * r) {
        const i = (y * w + x) * 4;
        buf.dados[i + 3] = 0;
      }
    }
  }
}

function downsample2x(hiresBuf) {
  const targetW = hiresBuf.w / 2;
  const targetH = hiresBuf.h / 2;
  const outBuf = criarBuffer(targetW, targetH);

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const hiX = x * 2 + dx;
          const hiY = y * 2 + dy;
          const i = (hiY * hiresBuf.w + hiX) * 4;
          r += hiresBuf.dados[i];
          g += hiresBuf.dados[i + 1];
          b += hiresBuf.dados[i + 2];
          a += hiresBuf.dados[i + 3];
        }
      }
      const outI = (y * targetW + x) * 4;
      outBuf.dados[outI] = Math.round(r / 4);
      outBuf.dados[outI + 1] = Math.round(g / 4);
      outBuf.dados[outI + 2] = Math.round(b / 4);
      outBuf.dados[outI + 3] = Math.round(a / 4);
    }
  }
  return outBuf;
}

function gerarIcone({ arquivo, ladoTarget, escalaArte, raioSquircle }) {
  const superLado = ladoTarget * 2;
  const superBuf = criarBuffer(superLado, superLado);

  desenharFundoRoxo(superBuf);
  desenharSetaLimpa(superBuf, escalaArte);

  if (raioSquircle > 0) {
    aplicarSquircle(superBuf, raioSquircle);
  }

  const finalBuf = downsample2x(superBuf);

  const destino = join(RAIZ, 'public', arquivo);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, paraPNG(finalBuf.dados, ladoTarget, ladoTarget));
  return `${arquivo} (${ladoTarget}x${ladoTarget})`;
}

const resultados = [
  gerarIcone({ arquivo: 'icone-192.png', ladoTarget: 192, escalaArte: 0.65, raioSquircle: 0.22 }),
  gerarIcone({ arquivo: 'icone-512.png', ladoTarget: 512, escalaArte: 0.65, raioSquircle: 0.22 }),
  gerarIcone({ arquivo: 'icone-maskable-512.png', ladoTarget: 512, escalaArte: 0.55, raioSquircle: 0 }),
  gerarIcone({ arquivo: 'apple-touch-icon.png', ladoTarget: 180, escalaArte: 0.62, raioSquircle: 0 }),
];

console.log('Ícones PWA Seta Limpa gerados em public/:');
resultados.forEach(r => console.log('  ✓ ' + r));
