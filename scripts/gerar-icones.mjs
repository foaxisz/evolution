import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gerador de ícones PWA de alta definição com antialiasing supersampled.
 * Gera ícones modernos, com gradientes suaves e iluminação neon para iOS/Android/Desktop.
 */

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

// CRC32 para empacotamento PNG puro
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

// Interpolação de cores em HSL / RGB
function lerpColor(c1, c2, t) {
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
  const a = Math.round(c1[3] + (c2[3] - c1[3]) * t);
  return [r, g, b, a];
}

// Cria buffer de imagem em alta definição
function criarBuffer(w, h) {
  return { dados: Buffer.alloc(w * h * 4), w, h };
}

// Blend alpha compositing
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

// Desenha gradiente radial / fundo com brilho
function preencherFundoGradiente(buf) {
  const cx = buf.w / 2;
  const cy = buf.h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  const corCentro = [26, 16, 50, 255]; // #1a1032
  const corBorda = [10, 7, 20, 255];  // #0a0714
  const corBrilho = [139, 92, 246, 75]; // Neon purple aura

  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = Math.min(1, dist / maxR);
      
      const bg = lerpColor(corCentro, corBorda, factor);
      blendPixel(buf, x, y, bg);

      // Adiciona aura brilhante no centro
      const glowFactor = Math.max(0, 1 - dist / (buf.w * 0.45));
      if (glowFactor > 0) {
        const glow = [corBrilho[0], corBrilho[1], corBrilho[2], Math.round(corBrilho[3] * glowFactor * glowFactor)];
        blendPixel(buf, x, y, glow);
      }
    }
  }
}

// Retângulo com cantos arredondados e gradiente vertical
function desenharRetanguloArredondado(buf, x0, y0, x1, y1, raio, corTopo, corBase) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const py = (y - y0) / (y1 - y0);
    const cor = lerpColor(corTopo, corBase, py);

    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      let dx = 0;
      let dy = 0;

      if (x < x0 + raio) dx = (x0 + raio) - x;
      else if (x > x1 - raio) dx = x - (x1 - raio);

      if (y < y0 + raio) dy = (y0 + raio) - y;
      else if (y > y1 - raio) dy = y - (y1 - raio);

      const d2 = dx * dx + dy * dy;
      const r2 = raio * raio;

      if (d2 <= r2) {
        blendPixel(buf, x, y, cor);
      } else if (d2 <= (raio + 1) * (raio + 1)) {
        // Antialiasing nas bordas do canto
        const alphaCov = 1 - (Math.sqrt(d2) - raio);
        if (alphaCov > 0) {
          const corAA = [cor[0], cor[1], cor[2], Math.round(cor[3] * alphaCov)];
          blendPixel(buf, x, y, corAA);
        }
      }
    }
  }
}

// Desenha a logo da Evolution em alta definição
function desenharLogoEvolution(buf, escala = 1.0) {
  const size = buf.w;
  const artSize = size * escala;
  const ox = (size - artSize) / 2;
  const oy = (size - artSize) / 2;

  // 4 barras subindo com gradiente e topo iluminado
  const barras = [
    { h: 0.32, topo: [168, 85, 247, 255], base: [109, 40, 217, 255] },
    { h: 0.52, topo: [192, 132, 252, 255], base: [124, 58, 237, 255] },
    { h: 0.72, topo: [216, 180, 254, 255], base: [139, 92, 246, 255] },
    { h: 0.96, topo: [244, 114, 182, 255], base: [168, 85, 247, 255] }, // Barra final rosa neon acesa
  ];

  const barW = artSize * 0.16;
  const gap = artSize * 0.07;
  const totalW = barras.length * barW + (barras.length - 1) * gap;
  const startX = ox + (artSize - totalW) / 2;
  const baseY = oy + artSize * 0.88;
  const cornerRadius = barW * 0.45;

  // Sombra / brilho suave sob as barras
  barras.forEach((b, i) => {
    const x = startX + i * (barW + gap);
    const topY = baseY - artSize * 0.76 * b.h;
    const glowCor = [b.topo[0], b.topo[1], b.topo[2], 50];
    desenharRetanguloArredondado(
      buf,
      x - barW * 0.15,
      topY - barW * 0.15,
      x + barW * 1.15,
      baseY + barW * 0.1,
      cornerRadius * 1.3,
      glowCor,
      glowCor
    );
  });

  // Barras principais
  barras.forEach((b, i) => {
    const x = startX + i * (barW + gap);
    const topY = baseY - artSize * 0.76 * b.h;
    desenharRetanguloArredondado(
      buf,
      x,
      topY,
      x + barW,
      baseY,
      cornerRadius,
      b.topo,
      b.base
    );
  });

  // Brilho estrela / luz na ponta da 4ª barra
  const peakX = startX + 3 * (barW + gap) + barW / 2;
  const peakY = baseY - artSize * 0.76 * 0.96;
  const starRadius = barW * 0.6;
  
  for (let y = Math.floor(peakY - starRadius); y <= Math.ceil(peakY + starRadius); y++) {
    for (let x = Math.floor(peakX - starRadius); x <= Math.ceil(peakX + starRadius); x++) {
      const dx = Math.abs(x - peakX);
      const dy = Math.abs(y - peakY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < starRadius) {
        const intense = Math.pow(1 - dist / starRadius, 2);
        blendPixel(buf, x, y, [255, 255, 255, Math.round(220 * intense)]);
      }
    }
  }
}

// Corta cantos em formato de ícone de app (squircle)
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

// Downsample com box-filtering 2x2 para Antialiasing perfeito
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
  // Renderiza em 2x de resolução para supersampling perfeito
  const superLado = ladoTarget * 2;
  const superBuf = criarBuffer(superLado, superLado);

  preencherFundoGradiente(superBuf);
  desenharLogoEvolution(superBuf, escalaArte);

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
  gerarIcone({ arquivo: 'icone-maskable-512.png', ladoTarget: 512, escalaArte: 0.52, raioSquircle: 0 }),
  gerarIcone({ arquivo: 'apple-touch-icon.png', ladoTarget: 180, escalaArte: 0.62, raioSquircle: 0 }),
];

console.log('Ícones PWA HD gerados em public/:');
resultados.forEach(r => console.log('  ✓ ' + r));
