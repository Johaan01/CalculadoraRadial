/*
 * mostrador.js — desenha o mostrador radial e devolve o que foi escolhido.
 *
 * O mostrador tem duas bandas.
 *
 * A banda principal são os dígitos e o multiplicador: anéis concêntricos de
 * dentro para fora, cada um varrendo os mesmos 240°, divididos pelo número de
 * cores que aquela faixa aceita (10 nos dígitos, 12 no multiplicador — por isso
 * a divisão angular é calculada por anel, e não uma vez só). O multiplicador
 * ganha uma folga extra antes dele: não é mais um dígito do valor, e sim a
 * potência de dez que multiplica os anteriores.
 *
 * A banda externa é só a tolerância, um arco curto abraçando a parte de baixo
 * do multiplicador. Ela precisa estar junto do resto da leitura, mas não
 * justifica uma volta inteira: é escolhida uma vez e depois fica parada. Um
 * arco de 110° centrado embaixo custa uma fração da tela de um anel completo e
 * mantém tudo em um lugar só. O nome dela vai curvado no vão entre as duas
 * bandas, apontando para o arco logo abaixo.
 *
 * O raio externo de cada banda é fixo: mudar o número de faixas afina os anéis
 * em vez de fazer o mostrador crescer para fora da tela.
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

  /* Banda principal: dígitos e multiplicador. */
  var RAIO_INT = 120, RAIO_EXT = 330;
  var ANG_INICIO = 60, ANG_TOTAL = 240;

  /*
   * Banda externa: o arco da tolerância, embaixo. O vão entre ela e o
   * mostrador tem 26 unidades porque é ali que o nome dela é escrito, curvado
   * junto com o arco. Encostar as duas bandas economizaria espaço e deixaria o
   * arco sem se apresentar.
   */
  var RAIO_TOL_INT = 356, RAIO_TOL_EXT = 404;
  var ANG_TOL_INICIO = 125, ANG_TOL_TOTAL = 110;
  var RAIO_GUIA_TOL = 350;   /* linha de base do nome, dentro do vão */

  var SEPARACAO = 2;   /* fresta entre um anel e o seguinte */
  var FOLGA = 10;      /* respiro maior antes do multiplicador */

  var CORPO_MAX = 22, CORPO_MIN = 9;
  var LARGURA_POR_CARACTERE = 0.62;   /* fração do corpo, fonte sem serifa */

  var ORDINAIS = ['1º', '2º', '3º'];
  var MENOS = '−';  /* sinal de menos tipográfico, não hífen */

  function polar(raio, graus) {
    var rad = (graus - 90) * Math.PI / 180;
    return { x: CX + raio * Math.cos(rad), y: CY + raio * Math.sin(rad) };
  }

  /* Uma linha de arco simples, sem preenchimento: serve de trilho para texto. */
  function caminhoGuia(raio, angDe, angAte) {
    var inicio = polar(raio, angDe);
    var fim = polar(raio, angAte);
    var arcoGrande = Math.abs(angAte - angDe) > 180 ? '1' : '0';
    var sentido = angAte > angDe ? '1' : '0';
    return ['M', inicio.x, inicio.y,
            'A', raio, raio, 0, arcoGrande, sentido, fim.x, fim.y].join(' ');
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
   * Com o texto em pé, quem limita o corpo da fonte não é só a espessura do
   * anel. Uma etiqueta de quatro caracteres deitada sobre a ponta do arco
   * avança também na direção radial, e o quanto ela avança depende do ângulo.
   * Aqui a caixa do texto é projetada nas duas direções — radial e tangencial —
   * em cada segmento do anel, e vale o maior corpo que cabe em todos.
   */
  function corpoQueCabe(caracteres, espessuraUtil, raioMeio, angPorCor, quantos, angIni) {
    var largura = caracteres * LARGURA_POR_CARACTERE;   /* em corpos de fonte */
    var arcoUtil = 2 * Math.PI * raioMeio * angPorCor / 360;
    var limite = CORPO_MAX;

    for (var i = 0; i < quantos; i++) {
      var rad = (angIni + (i + 0.5) * angPorCor) * Math.PI / 180;
      var sen = Math.abs(Math.sin(rad));
      var cos = Math.abs(Math.cos(rad));
      limite = Math.min(limite,
        espessuraUtil / (largura * sen + cos),
        arcoUtil / (largura * cos + sen));
    }
    return Math.max(CORPO_MIN, limite);
  }

  /*
   * A descrição de cada anel: a banda em que vive, as cores que ele aceita, o
   * texto curto que vai dentro do arco e a legenda por extenso que vira `title`
   * e leitura de tela. Quem diz qual anel é qual são os rótulos sob o desenho
   * do resistor e a tabela de leitura.
   *
   * A ordem da lista é a ordem das faixas do componente, então o índice de um
   * anel aqui é o mesmo índice em `estado.selecoes` no app.
   */
  function aneisDe(modo) {
    var nDig = Resistor.digitosDe(modo);
    var lista = [];

    for (var i = 0; i < nDig; i++) {
      lista.push({
        banda: 'principal',
        titulo: ORDINAIS[i] + ' dígito',
        cores: Cores.digitos,
        texto: function (c) { return String(c.digito); },
        legenda: function (c) { return 'dígito ' + c.digito; }
      });
    }

    lista.push({
      banda: 'principal',
      titulo: 'Multiplicador',
      cores: Cores.multiplicadores,
      texto: expoenteDe,
      legenda: function (c) {
        return 'multiplicador ' + Resistor.formatarMultiplicador(c.mult);
      }
    });

    lista.push({
      banda: 'tolerancia',
      titulo: 'Tolerância',
      /* Este arco é o único que não fica encostado nos outros, então precisa
         se apresentar: sem o nome embaixo, nada diz que ele é a tolerância. */
      nomeVisivel: 'Tolerância',
      cores: Cores.tolerancias,
      texto: function (c) { return Resistor.numero(c.tol); },
      legenda: function (c) { return 'tolerância de ±' + Resistor.numero(c.tol) + '%'; }
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
      var principais = defs.filter(function (d) {
        return d.banda === 'principal';
      }).length;
      var espessura = (RAIO_EXT - RAIO_INT - FOLGA) / principais;
      var indiceMultiplicador = principais - 1;

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
        var raioInterno, raioExterno, anguloInicial, anguloTotal;

        if (def.banda === 'principal') {
          raioInterno = RAIO_INT + iAnel * espessura
                      + (iAnel === indiceMultiplicador ? FOLGA : 0);
          raioExterno = raioInterno + espessura - SEPARACAO;
          anguloInicial = ANG_INICIO;
          anguloTotal = ANG_TOTAL;
        } else {
          raioInterno = RAIO_TOL_INT;
          raioExterno = RAIO_TOL_EXT;
          anguloInicial = ANG_TOL_INICIO;
          anguloTotal = ANG_TOL_TOTAL;
        }

        var raioMeio = (raioInterno + raioExterno) / 2;
        var anguloPorCor = anguloTotal / def.cores.length;

        var maiorRotulo = def.cores.reduce(function (maior, c) {
          return Math.max(maior, def.texto(c).length);
        }, 1);
        var tamanhoFonte = corpoQueCabe(maiorRotulo, raioExterno - raioInterno,
          raioMeio, anguloPorCor, def.cores.length, anguloInicial);

        var grupo = elemento('g', {
          role: 'radiogroup',
          'aria-label': 'Faixa ' + (iAnel + 1) + ': ' + def.titulo
        });

        var anel = { def: def, segmentos: [], realce: null };

        def.cores.forEach(function (cor, iCor) {
          var angIni = anguloInicial + iCor * anguloPorCor;
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
           * cabeça para baixo.
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

        /*
         * O nome da banda acompanha a curva do arco, escrito no vão logo acima
         * dele. O trilho vai da ponta esquerda para a direita passando por
         * baixo: nesse sentido as letras ficam em pé, e crescem para dentro,
         * na direção do centro do mostrador.
         */
        if (def.nomeVisivel) {
          var idGuia = 'guia-' + def.banda;
          var defsSvg = elemento('defs', {});
          defsSvg.appendChild(elemento('path', {
            id: idGuia,
            fill: 'none',
            d: caminhoGuia(RAIO_GUIA_TOL,
                           anguloInicial + anguloTotal, anguloInicial)
          }));
          grupo.appendChild(defsSvg);

          var nome = elemento('text', { 'class': 'rotulo-banda' });
          var trilho = elemento('textPath', { startOffset: '50%' });
          trilho.setAttribute('href', '#' + idGuia);
          trilho.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href',
                                '#' + idGuia);
          trilho.textContent = def.nomeVisivel;
          nome.appendChild(trilho);
          grupo.appendChild(nome);
        }

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
