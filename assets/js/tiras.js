/*
 * tiras.js — as faixas que se escolhe uma vez e não se mexe mais: tolerância e
 * coeficiente térmico.
 *
 * Elas saíram do mostrador radial de propósito. Cada uma ocupava um anel
 * inteiro — a mesma área dos anéis de dígito, que mudam a toda hora — para uma
 * informação que na prática é escolhida no começo e fica parada. Tirando as
 * duas de lá, o mostrador passou de 4–6 anéis para 3–4, e cada anel restante
 * ficou grosso o bastante para ser lido e tocado num celular.
 *
 * Aqui embaixo elas viram uma tira horizontal de pastilhas coloridas, que é a
 * forma mais barata em espaço de mostrar 8 ou 9 opções de uma vez.
 */
(function (raiz) {
  'use strict';

  /*
   * `aoEscolher(idDaCor)` é chamado a cada clique ou tecla. Como no mostrador,
   * a tira não guarda estado: quem decide é o app.
   */
  function criarTira(container, aoEscolher) {
    var pastilhas = [];

    function montar(cores, texto, descricao) {
      container.textContent = '';
      pastilhas = [];
      container.style.gridTemplateColumns = 'repeat(' + cores.length + ', 1fr)';

      cores.forEach(function (cor, indice) {
        var botao = document.createElement('button');
        var legenda = cor.nome + ' — ' + descricao(cor);

        botao.type = 'button';
        botao.className = 'pastilha';
        botao.setAttribute('role', 'radio');
        botao.setAttribute('aria-checked', 'false');
        botao.setAttribute('aria-label', legenda);
        botao.setAttribute('tabindex', '-1');
        botao.title = legenda;
        botao.textContent = texto(cor);

        /* Ouro e prata são gradientes; os demais, cor chapada. */
        if (cor.fill.charAt(0) === '#') {
          botao.style.background = cor.fill;
        } else {
          botao.classList.add('pastilha--' + cor.id);
        }
        botao.style.color = cor.texto;

        botao.addEventListener('click', function () { aoEscolher(cor.id); });

        botao.addEventListener('keydown', function (evento) {
          var total = pastilhas.length;
          var destino = null;
          switch (evento.key) {
            case 'ArrowRight':
            case 'ArrowDown':  destino = (indice + 1) % total; break;
            case 'ArrowLeft':
            case 'ArrowUp':    destino = (indice - 1 + total) % total; break;
            case 'Home':       destino = 0; break;
            case 'End':        destino = total - 1; break;
            default: return;
          }
          evento.preventDefault();
          aoEscolher(pastilhas[destino].cor.id);
          pastilhas[destino].botao.focus();
        });

        container.appendChild(botao);
        pastilhas.push({ botao: botao, cor: cor });
      });
    }

    function atualizar(idEscolhido) {
      var escolhido = -1;

      pastilhas.forEach(function (item, indice) {
        var marcado = item.cor.id === idEscolhido;
        if (marcado) { escolhido = indice; }
        item.botao.setAttribute('aria-checked', marcado ? 'true' : 'false');
        item.botao.classList.toggle('ativo', marcado);
      });

      /* Tabindex itinerante: a tira inteira é uma parada só de tabulação. */
      var parada = escolhido >= 0 ? escolhido : 0;
      pastilhas.forEach(function (item, indice) {
        item.botao.setAttribute('tabindex', indice === parada ? '0' : '-1');
      });
    }

    return { montar: montar, atualizar: atualizar };
  }

  raiz.criarTira = criarTira;
}(window));
