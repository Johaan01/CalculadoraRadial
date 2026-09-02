# Calculadora Radial de Resistores

Um mostrador radial para o código de cores de resistores. Cada anel é uma faixa
do componente; clicar nas cores mostra o valor, e digitar o valor acende as
cores. Funciona em 4, 5 e 6 faixas, e funciona sem internet depois da primeira
visita.

## Estrutura

```
index.html                  marcação e nada mais
manifest.webmanifest        identidade do app instalável
sw.js                       cache offline (subir a VERSAO a cada publicação)
.nojekyll                   desliga o Jekyll no GitHub Pages
assets/css/estilo.css
assets/js/cores.js          a tabela IEC 60062 — única fonte de cores
assets/js/resistor.js       regra de negócio pura: cores <-> ohms
assets/js/mostrador.js      desenho e interação do mostrador radial
assets/js/faixas.js         desenho do resistor visto de lado
assets/js/tiras.js          tiras de tolerância e coeficiente térmico
assets/js/app.js            estado da aplicação e ligação entre as peças
teste/logica.js             testes da conversão cores <-> ohms
ferramentas/gerar-icones.py regenera os PNGs do manifest (precisa de Pillow)
prototipo/calculadora-v11.html   o arquivo original, preservado
```

`cores.js`, `resistor.js`, `mostrador.js` e `faixas.js` não guardam estado.
Todo o estado vive em `app.js`, num único objeto `{ modo, selecoes, potencia }`.

## Uma decisão de layout que explica o resto

A leitura do valor fica **dentro** do mostrador, não acima dele. Num celular,
ter o valor no topo da página e os anéis embaixo obriga a rolar a tela a cada
toque para descobrir o que mudou — o que torna a ferramenta inútil justamente
onde ela mais serve. Os 120° livres no topo do mostrador e o disco central não
são sobra de desenho: são a área reservada para o valor, a tolerância e o
seletor de faixas, posicionados em HTML por cima do SVG.

Por isso `mostrador.js` não desenha nada nessa região, e o CSS usa
`container-type: inline-size` no mostrador: as medidas em `cqw` fazem a leitura
escalar junto com o diâmetro, de um telefone de 320px a um monitor.

Os nomes das faixas (`1º`, `2º`, `×`, `±`, `ppm`) ficam sob o desenho do
resistor, onde a ordem é horizontal, e não em volta dos anéis, onde viravam um
leque diagonal ilegível.

**O mostrador só tem as faixas que se mexem o tempo todo:** os dígitos e o
multiplicador. Tolerância e coeficiente térmico são escolhidos uma vez e depois
ficam parados — não justificam um anel inteiro, do mesmo tamanho dos anéis que
mudam a cada toque. Eles viraram tiras de pastilhas coloridas empilhadas logo
abaixo do mostrador. Com isso o mostrador passou de 4–6 anéis para 3–4.

O anel do multiplicador tem uma folga extra antes dele. Ele não é mais um
dígito do valor, e sim a potência de dez que multiplica os anteriores; a fresta
maior diz isso sem precisar de legenda, do mesmo jeito que a folga no
componente real diz de que ponta se começa a ler.

Os números dentro dos arcos ficam **de pé**, sem giro. Acompanhando o arco, os
da metade de baixo do mostrador apareciam deitados ou de cabeça para baixo. Como
são de um ou dois caracteres, cabem em pé em qualquer ângulo — o que o script
de conferência de geometria verifica projetando a caixa do texto nas direções
radial e tangencial de cada segmento.

Uma consequência dessa escolha atravessa o código: `estado.selecoes` continua
tendo uma entrada por faixa do componente, mas o mostrador só desenha
`digitosDe(modo) + 1` anéis. Os índices são compartilhados — o anel `i` do
mostrador é a faixa `i`, a tira de tolerância é a faixa `nDig + 1` e a de
coeficiente é a `nDig + 2`.

Combinações que não podem existir num resistor real — hoje, preto no primeiro
dígito — recebem contorno vermelho no mostrador, linha vermelha na tabela e uma
explicação por extenso no painel de avisos.

Os scripts são carregados como scripts clássicos, não como módulos ES, de
propósito: assim o `index.html` continua funcionando ao ser aberto com dois
cliques. Só a instalação e o modo offline exigem um servidor.

## Rodar localmente

Abrir o `index.html` direto no navegador já exercita a calculadora inteira. Para
testar a instalação e o funcionamento offline é preciso um servidor, porque
service workers não existem em `file://`:

```
cd "Calculadora Radial Eletronica"
python -m http.server 8080
```

E abrir `http://localhost:8080`. O `localhost` conta como contexto seguro, então
o service worker registra normalmente sem HTTPS.

## Testes

A lógica de conversão tem uma bateria de testes que roda sem instalar nada,
usando o motor JScript que já vem no Windows:

```
cscript //Nologo teste/logica.js
```

E uma conferência da publicação, que roda em qualquer sistema e é a mesma que o
GitHub Actions executa antes de publicar:

```
python ferramentas/conferir-publicacao.py
```

Ela existe por causa de um erro que não aparece no navegador: `sw.js` faz
`cache.addAll(ARQUIVOS)` na instalação, e se **um** item dessa lista responder
404 a promessa inteira falha, o service worker nunca instala e o app deixa de
ser instalável e de funcionar offline — sem nenhuma mensagem na tela. Renomear
um arquivo e esquecer da lista basta para isso acontecer.

## Publicar no GitHub Pages

A publicação é automática: `.github/workflows/publicar.yml` confere e publica a
cada push na `main`.

Falta um passo manual, feito uma vez só: em **Settings → Pages**, escolher
**GitHub Actions** como *Source*. Se ficar em *Deploy from a branch*, o workflow
roda mas o Pages continua servindo o branch, ignorando o resultado.

O site sai em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

Todos os caminhos do projeto são relativos (`./sw.js`, `"start_url": "./"`).
Isso não é detalhe de estilo: um site de projeto no GitHub Pages não fica na
raiz do domínio, e um caminho absoluto como `/sw.js` apontaria para
`github.io/sw.js`, fora do escopo permitido — o service worker não registraria.

**A cada publicação, subir o `VERSAO` no topo do `sw.js`.** É esse número que
diz ao navegador para baixar os arquivos novos. Sem trocá-lo, quem já abriu o
app continua vendo a versão antiga, porque ela está em cache.

## Instalar como app

Com o site no ar em HTTPS (o GitHub Pages já é HTTPS), o navegador reconhece o
app como instalável: há manifest com ícones de 192 e 512 px, `start_url`,
`display: standalone` e um service worker com tratamento de `fetch`.

- **Chrome, Edge, Android:** aparece o botão *Instalar app* no topo da página,
  além do ícone de instalação na barra de endereços.
- **iOS/Safari:** não existe convite automático; a instalação é pelo menu
  *Compartilhar → Adicionar à Tela de Início*. O cache offline funciona.

Depois de instalado, o app abre em janela própria e funciona sem rede.

## Referências

- IEC 60062 — marcação de resistores e capacitores por código de cores.
- IEC 60063 — séries de valores preferenciais (E24, E96).
