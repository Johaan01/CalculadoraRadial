/*
 * faixas.js — o desenho do resistor visto de lado, com o nome de cada faixa
 * logo abaixo dela.
 *
 * Esses rótulos ficam aqui, e não no mostrador radial, de propósito: no
 * resistor a ordem das faixas é horizontal e da esquerda para a direita, que é
 * como a pessoa lê o componente na mão. No mostrador eles viravam um leque
 * diagonal ilegível em tela de celular.
 *
 * As faixas são criadas conforme o modo, e não fixas no HTML. O protótipo
 * tinha cinco retângulos declarados no markup e uma tabela de posições com um
 * buraco no meio para dar conta do modo de 4 faixas; com 6 faixas isso não
 * fecharia mais.
 *
 * A folga entre o multiplicador e a tolerância é a mesma convenção do
 * componente real: ela é o que diz de que ponta se começa a ler.
 */
(function (raiz) {
  'use strict';

  var Cores = raiz.Cores;
  var NS = 'http://www.w3.org/2000/svg';
  var LARGURA = 13;
  var Y_ROTULO = 103;

  /* Coordenadas no sistema do viewBox "0 0 340 110" declarado no HTML. */
  var POSICOES = {
    4: [54, 96, 138, 256],
    5: [54, 92, 130, 168, 256],
    6: [50, 84, 118, 152, 224, 262]
  };

  var ROTULOS = {
    4: ['1º', '2º', '×', '±'],
    5: ['1º', '2º', '3º', '×', '±'],
    6: ['1º', '2º', '3º', '×', '±', 'ppm']
  };

  function criarDesenho(grupoFaixas, grupoRotulos) {
    function montar(modo) {
      while (grupoFaixas.firstChild) { grupoFaixas.removeChild(grupoFaixas.firstChild); }
      while (grupoRotulos.firstChild) { grupoRotulos.removeChild(grupoRotulos.firstChild); }

      POSICOES[modo].forEach(function (x, i) {
        var faixa = document.createElementNS(NS, 'rect');
        faixa.setAttribute('x', x);
        faixa.setAttribute('y', 0);
        faixa.setAttribute('width', LARGURA);
        faixa.setAttribute('height', 90);
        faixa.setAttribute('class', 'faixa-resistor');
        grupoFaixas.appendChild(faixa);

        /* Fora do grupo recortado: o clipPath do corpo cortaria o texto. */
        var rotulo = document.createElementNS(NS, 'text');
        rotulo.setAttribute('x', x + LARGURA / 2);
        rotulo.setAttribute('y', Y_ROTULO);
        rotulo.setAttribute('class', 'rotulo-faixa');
        rotulo.textContent = ROTULOS[modo][i];
        grupoRotulos.appendChild(rotulo);
      });
    }

    function atualizar(selecoes) {
      Array.prototype.forEach.call(grupoFaixas.children, function (faixa, i) {
        var cor = Cores.por(selecoes[i]);
        /* Faixa ainda não escolhida vira um vinco no corpo, não um buraco. */
        faixa.setAttribute('fill', cor ? cor.fill : 'rgba(0, 0, 0, 0.18)');
      });
    }

    return { montar: montar, atualizar: atualizar };
  }

  raiz.criarDesenho = criarDesenho;
}(window));
