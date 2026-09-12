import { textoDaSelecao, SEPARADOR } from '../src/lib/quadroLivre.ts';

/**
 * Testes do copiar do quadro livre.
 *
 * A regra é estreita e o preço de errar é nos dois sentidos: largar demais
 * e o copiar-e-colar de formas entre quadros para de funcionar; apertar
 * demais e volta o JSON gigante colado no lugar do texto.
 *
 * Rodar com: npm run testar
 */

let falhas = 0;

function ok(nome, real, esperado) {
  const bate = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bate) falhas++;
  console.log((bate ? '  ok    ' : '  FALHA ') + nome);
  if (!bate) {
    console.log('          obtido:   ' + JSON.stringify(real));
    console.log('          esperado: ' + JSON.stringify(esperado));
  }
}

const texto = (id, t, original) => ({
  id, type: 'text', text: t, originalText: original ?? t,
});
const forma = id => ({ id, type: 'rectangle' });
const sel = (...ids) => Object.fromEntries(ids.map(i => [i, true]));

console.log('Quando é texto:');
ok('um texto só vem o texto',
  textoDaSelecao([texto('a', 'Oi')], sel('a')), 'Oi');
ok('dois textos vêm separados',
  textoDaSelecao([texto('a', 'Um'), texto('b', 'Dois')], sel('a', 'b')),
  'Um' + SEPARADOR + 'Dois');
ok('só o que está selecionado',
  textoDaSelecao([texto('a', 'Um'), texto('b', 'Dois')], sel('b')), 'Dois');
ok('vem na ordem da cena, não da seleção',
  textoDaSelecao([texto('a', 'Um'), texto('b', 'Dois')], sel('b', 'a')),
  'Um' + SEPARADOR + 'Dois');

console.log('\nAs quebras são de quem escreveu:');
ok('devolve originalText, não o text desenhado',
  textoDaSelecao([texto('a', 'uma frase\nquebrada na caixa', 'uma frase quebrada na caixa')], sel('a')),
  'uma frase quebrada na caixa');
ok('sem originalText, usa o text',
  textoDaSelecao([{ id: 'a', type: 'text', text: 'sozinho' }], sel('a')), 'sozinho');

console.log('\nQuando NÃO é caso de texto (segue o nativo):');
ok('nada selecionado', textoDaSelecao([texto('a', 'Oi')], {}), null);
ok('cena vazia', textoDaSelecao([], sel('a')), null);
ok('uma forma só', textoDaSelecao([forma('r')], sel('r')), null);
ok('texto MAIS forma vai como elemento',
  textoDaSelecao([texto('a', 'Oi'), forma('r')], sel('a', 'r')), null);
ok('texto vazio não intervém',
  textoDaSelecao([texto('a', '   ')], sel('a')), null);
ok('elemento apagado não conta',
  textoDaSelecao([{ ...texto('a', 'Oi'), isDeleted: true }], sel('a')), null);
ok('id selecionado que não existe na cena',
  textoDaSelecao([texto('a', 'Oi')], sel('fantasma')), null);
ok('seleção com valor falso não conta',
  textoDaSelecao([texto('a', 'Oi')], { a: false }), null);

console.log(falhas === 0 ? '\nTodos passaram.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
