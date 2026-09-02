/*
 * mostrador.js — desenha o mostrador radial e devolve o que foi escolhido.
 *
 * O mostrador tem apenas as faixas que se mexem o tempo todo: os dígitos e o
 * multiplicador. Tolerância e coeficiente térmico ficam nas tiras abaixo da
 * página, porque são escolhidos uma vez e depois não se toca mais neles —
 * ocupavam um anel inteiro para uma informação quase estática. Com isso sobram
 * 3 anéis (4 faixas) ou 4 anéis (5 e 6 faixas) em vez de 4 a 6, e cada um fica
 * grosso o bastante para ser lido num celular.
 *
 * Um anel por faixa, de dentro para fora, cada um varrendo os mesmos 240° e
 * dividido pelo número de cores que aquela faixa aceita: 10 nos dígitos, 12 no
 * multiplicador (inclui ouro e prata). Por isso a divisão angular é calculada
 * por anel, e não uma vez só.
 *
 * O raio externo é fixo: mudar o número de faixas afina os anéis em vez de
 * fazer o mostrador crescer para fora da tela.
 *
 * Os 120° livres no topo e o disco central não são sobra: é ali que o app
 * encaixa a leitura do valor e o seletor de faixas, em HTML por cima do SVG.
 * Nada deve ser desenhado nessa região.
 */
(function (raiz) {
  'use strict';

  var Cores = raiz.Cores;
  var Resistor = raiz.Resistor;
  var NS = 'http://www.w3.org/2000/svg';

  var CX = 400, CY = 250;
  var RAIO_EXT = 330, RAIO_INT = 120;
  var ANG_INICIO = 60, ANG_TOTAL = 240;
  var SEPARACAO = 2;   /* fresta entre um anel e o seguinte */
  var FOLGA = 10;      /* respiro antes do multiplicador */

  var ORDINAIS = ['1º', '2º', '3º'];
  var MENOS = '−';  /* sinal de menos tipográfico, não hífen */

  function polar(raio, graus) {
    var rad = (graus - 90) * Math.PI / 180;
    return { x: CX + raio * Math.cos(rad), y: CY + raio * Math.sin(rad) };
  }

  function caminhoArco(raioInterno, raioExterno, angIni, angFim) {
    var iniExt = polar(raioExterno, angFim);
    var fimExt = polar(raioExterno, angIni);
    var iniInt = polar(raioInterno, angFim);
    var fimInt = polar(raioInterno, angIni);
    var arcoGrande = (angFim - angIni) <= 180 ? '0' : '1';
    return ['M', iniExt.x, iniExt.y,
            'A', raioExterno, raioExterno, 0, arcoGrande, 0, fimExt.x, fimExt.y,
            'L', fimInt.x, fimInt.y,
            'A', raioInterno, raioInterno, 0, arcoGrande, 1, iniInt.x, iniInt.y,
            'Z'].join(' ');
  }

  function elemento(nome, atributos) {
    var el = document.createElementNS(NS, nome);
    Object.keys(atributos || {}).forEach(function (chave) {
      el.setAttribute(chave, atributos[chave]);
    });
    return el;
  }

  function expoenteDe(cor) {
    return String(Math.round(Math.log10(cor.mult))).replace('-', MENOS);
  }

  /*
   * A descrição de cada anel: as cores que ele aceita, o texto curto que vai
   * dentro do arco e a legenda por extenso que vira `title` e leitura de tela.
   * Quem diz qual anel é qual são os rótulos sob o desenho do resistor e a
   * tabela de leitura.
   *
   * A lista cobre só os dígitos e o multiplicador — as faixas do mostrador.
   * Ela tem, portanto, `digitosDe(modo) + 1` itens, e não `modo` itens.
   */
  function aneisDe(modo) {
    var nDig = Resistor.digitosDe(modo);
    var lista = [];

    for (var i = 0; i < nDig; i++) {
      lista.push({
        titulo: ORDINAIS[i] + ' dígito',
        cores: Cores.digitos,
        texto: function (c) { return String(c.digito); },
        legenda: function (c) { return 'dígito ' + c.digito; }
      });
    }

    lista.push({
      titulo: 'Multiplicador',
      cores: Cores.multiplicadores,
      texto: expoenteDe,
      legenda: function (c) {
        return 'multiplicador ' + Resistor.formatarMultiplicador(c.mult);
      }
    });

    return lista;
  }

  /*
   * `aoEscolher(indiceDoAnel, idDaCor, forcar)` é chamado a cada clique ou
   * tecla. Quem decide o que fazer com isso é o app; o mostrador não guarda
   * estado nenhum além do DOM que desenhou.
   */
  function criarMostrador(svg, aoEscolher) {
    var aneis = [];

    function montar(modo) {
      while (svg.firstChild) { svg.removeChild(svg.firstChild); }
      aneis = [];

      var defs = aneisDe(modo);
      var espessura = (RAIO_EXT - RAIO_INT - FOLGA) / defs.length;
      /* O multiplicador é sempre o último anel. */
      var indiceMultiplicador = defs.length - 1;

      /*
       * Os contornos de seleção vivem numa camada única, desenhada depois de
       * todos os anéis. Dentro do próprio anel bastaria pô-los no fim do
       * grupo, mas aí o anel seguinte ainda comeria a borda externa deles —
       * SVG pinta na ordem do documento e não tem z-index.
       *
       * Só duas cores aparecem aqui: branco para a faixa escolhida, vermelho
       * para a escolhida que não pode existir. O foco de teclado se anuncia
       * pelo brilho do próprio arco, sem introduzir uma terceira cor.
       */
      var camadaContornos = elemento('g', { 'aria-hidden': 'true' });

      defs.forEach(function (def, iAnel) {
        /*
         * O multiplicador ganha uma folga extra antes dele. Ele não é mais um
         * dígito do valor: é a potência de dez que multiplica os anteriores, e
         * a fresta maior diz isso sem precisar de legenda.
         */
        var raioInterno = RAIO_INT + iAnel * espessura
                        + (iAnel === indiceMultiplicador ? FOLGA : 0);
        var raioExterno = raioInterno + espessura - SEPARACAO;
        var raioMeio = (raioInterno + raioExterno) / 2;
        var anguloPorCor = ANG_TOTAL / def.cores.length;

        /* O texto tem que caber na espessura do anel, que varia com o modo. */
        var maiorRotulo = def.cores.reduce(function (maior, c) {
          return Math.max(maior, def.texto(c).length);
        }, 1);
        var tamanhoFonte = Math.max(9, Math.min(22,
          (espessura - 14) / (maiorRotulo * 0.62)));

        var grupo = elemento('g', {
          role: 'radiogroup',
          'aria-label': 'Faixa ' + (iAnel + 1) + ': ' + def.titulo
        });

        var anel = { def: def, segmentos: [], realce: null };

        def.cores.forEach(function (cor, iCor) {
          var angIni = ANG_INICIO + iCor * anguloPorCor;
          var d = caminhoArco(raioInterno, raioExterno, angIni, angIni + anguloPorCor);

          var arco = elemento('path', {
            d: d,
            fill: cor.fill,
            'class': 'segmento',
            role: 'radio',
            'aria-checked': 'false',
            tabindex: '-1'
          });
          var dica = elemento('title', {});
          dica.textContent = cor.nome + ' — ' + def.legenda(cor);
          arco.appendChild(dica);

          arco.addEventListener('click', function () {
            aoEscolher(iAnel, cor.id, false);
          });

          arco.addEventListener('keydown', function (evento) {
            var total = anel.segmentos.length;
            var destino = null;
            switch (evento.key) {
              case 'ArrowRight':
              case 'ArrowDown':  destino = (iCor + 1) % total; break;
              case 'ArrowLeft':
              case 'ArrowUp':    destino = (iCor - 1 + total) % total; break;
              case 'Home':       destino = 0; break;
              case 'End':        destino = total - 1; break;
              case ' ':
              case 'Enter':
                evento.preventDefault();
                aoEscolher(iAnel, cor.id, false);
                return;
              default: return;
            }
            evento.preventDefault();
            aoEscolher(iAnel, anel.segmentos[destino].cor.id, true);
            anel.segmentos[destino].arco.focus();
          });

          grupo.appendChild(arco);
          anel.segmentos.push({ arco: arco, cor: cor });

          /*
           * Os rótulos ficam de pé, sem giro nenhum. Girados junto com o arco,
           * os números da metade de baixo do mostrador apareciam deitados ou de
           * cabeça para baixo. Como são de um ou dois caracteres, cabem em pé
           * na largura de qualquer arco, em qualquer ângulo.
           */
          var posicao = polar(raioMeio, angIni + anguloPorCor / 2);
          var texto = elemento('text', {
            x: posicao.x,
            y: posicao.y,
            'class': 'rotulo-arco',
            fill: cor.texto,
            'font-size': tamanhoFonte.toFixed(1)
          });
          texto.textContent = def.texto(cor);
          grupo.appendChild(texto);
        });

        anel.realce = elemento('path', { 'class': 'realce' });
        anel.realce.style.display = 'none';
        camadaContornos.appendChild(anel.realce);

        svg.appendChild(grupo);
        aneis.push(anel);
      });

      svg.appendChild(camadaContornos);
    }

    /*
     * Só mexe em atributos dos elementos que já existem. Trocar de cor não
     * redesenha o mostrador, o que preserva o foco do teclado e evita o
     * desperdício que o protótipo fazia ao remontar tudo a cada clique.
     */
    function atualizar(selecoes, impossiveis) {
      var proibidas = impossiveis || [];

      aneis.forEach(function (anel, iAnel) {
        var escolhido = -1;

        anel.segmentos.forEach(function (segmento, iCor) {
          var marcado = segmento.cor.id === selecoes[iAnel];
          if (marcado) { escolhido = iCor; }
          segmento.arco.setAttribute('aria-checked', marcado ? 'true' : 'false');
        });

        if (escolhido >= 0) {
          anel.realce.setAttribute('d', anel.segmentos[escolhido].arco.getAttribute('d'));
          anel.realce.style.display = '';
          /* Contorno vermelho quando a faixa escolhida não pode existir num
             componente real — hoje, só preto no primeiro dígito. */
          anel.realce.setAttribute('class',
            proibidas.indexOf(iAnel) === -1 ? 'realce' : 'realce realce--erro');
        } else {
          anel.realce.style.display = 'none';
        }

        /* Tabindex itinerante: um único ponto de parada por anel. */
        var paradaDoTab = escolhido >= 0 ? escolhido : 0;
        anel.segmentos.forEach(function (segmento, iCor) {
          segmento.arco.setAttribute('tabindex', iCor === paradaDoTab ? '0' : '-1');
        });
      });
    }

    return { montar: montar, atualizar: atualizar };
  }

  raiz.criarMostrador = criarMostrador;
}(window));
