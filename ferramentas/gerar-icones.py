# -*- coding: utf-8 -*-
"""Gera os icones PWA: uma miniatura do proprio mostrador radial."""
import os
from PIL import Image, ImageDraw

DESTINO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "icons")
FUNDO = (16, 18, 20, 255)
SEPARADOR = (69, 75, 82, 255)

PALETA = ["#1f1f1f", "#7a4b2a", "#c62828", "#ef6c00", "#fdd835",
          "#2e7d32", "#1565c0", "#8e24aa", "#8a8a8a", "#f0f0f0"]

SUPER = 4          # supersampling para antialiasing
ANG_INICIO = -30   # 60 graus a partir das 12h, no sistema do PIL (0 = 3h)
ANG_TOTAL = 240


def hex_rgba(c):
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16), 255)


def desenhar(tamanho, fracao_raio_externo):
    lado = tamanho * SUPER
    img = Image.new("RGBA", (lado, lado), FUNDO)
    d = ImageDraw.Draw(img)

    cx = cy = lado / 2.0
    r_ext = lado * fracao_raio_externo
    r_int = r_ext * 0.34
    n_aneis = 3
    espessura = (r_ext - r_int) / n_aneis
    segmentos = 6
    passo = ANG_TOTAL / float(segmentos)
    folga = 2.4  # graus de fresta entre segmentos

    for anel in range(n_aneis):
        r_dentro = r_int + anel * espessura
        r_meio = r_dentro + espessura / 2.0
        largura = espessura * 0.80
        caixa = [cx - r_meio, cy - r_meio, cx + r_meio, cy + r_meio]

        for s in range(segmentos):
            cor = PALETA[(s * 2 + anel * 3) % len(PALETA)]
            ini = ANG_INICIO + s * passo + folga / 2.0
            fim = ini + passo - folga
            d.arc(caixa, ini, fim, fill=hex_rgba(cor), width=int(round(largura)))

    return img.resize((tamanho, tamanho), Image.LANCZOS)


def main():
    if not os.path.isdir(DESTINO):
        os.makedirs(DESTINO)

    saidas = [
        ("icone-32.png", 32, 0.44),
        ("icone-192.png", 192, 0.44),
        ("icone-512.png", 512, 0.44),
        # maskable: tudo dentro do circulo de raio 40% do lado
        ("icone-maskable-512.png", 512, 0.36),
    ]
    for nome, tamanho, fracao in saidas:
        img = desenhar(tamanho, fracao)
        caminho = os.path.join(DESTINO, nome)
        img.save(caminho, "PNG", optimize=True)
        print("%-26s %4dpx  %6d bytes" % (nome, tamanho, os.path.getsize(caminho)))


if __name__ == "__main__":
    main()
