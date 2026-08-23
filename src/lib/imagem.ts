/**
 * Reduz uma imagem escolhida pelo usuário para uma miniatura pequena antes
 * de guardar no localStorage.
 *
 * Sem isto o app quebra rápido: o localStorage tem teto de ~5MB no total, e
 * uma única foto de celular passa de 3MB. Reduzindo para 240px em JPEG 0.72
 * cada miniatura fica em ~15–25KB.
 */
export const LADO_MAXIMO = 240;
export const QUALIDADE = 0.72;

export function reduzirImagem(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!arquivo.type.startsWith('image/')) {
      reject(new Error('O arquivo selecionado não é uma imagem.'));
      return;
    }

    const leitor = new FileReader();
    leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    leitor.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Não foi possível abrir a imagem.'));
      img.onload = () => {
        const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
        const largura = Math.round(img.width * escala);
        const altura = Math.round(img.height * escala);

        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível neste navegador.'));
          return;
        }
        ctx.drawImage(img, 0, 0, largura, altura);
        resolve(canvas.toDataURL('image/jpeg', QUALIDADE));
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arquivo);
  });
}

/** Formata bytes para exibição curta. */
export function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
