# Rufino Clinical — Design

Loja de produtos para fisioterapia dermatofuncional (tapes, bandagens, compressão).
Tom: clínico, moderno, acolhedor. Premium sem ser frio.

Fonte da verdade visual: [Figma — Rufino Clinical Logo](https://www.figma.com/design/cbv2YKOJBclk84X89uz6h6), página **Logo final**.

## Logo

Monograma **R** montado com três tiras de fita de pontas arredondadas (haste, bojo e perna), separadas por pequenos respiros, como fitas de kinesio aplicadas.

| Arquivo | Uso |
|---|---|
| `public/brand/logo-horizontal.svg` | Header do site, e-mails, notas |
| `public/brand/logo-vertical.svg` | Rodapé, embalagem, redes sociais |
| `public/brand/simbolo.svg` | Espaços pequenos, marca d'água, selos |
| `public/brand/icone.svg` | Favicon, app icon, avatar |
| `*-negativo.svg` | Mesmas versões em creme, para fundo vinho |

Regras:
- Área de proteção mínima: a largura da haste do R (24 u) em todos os lados.
- Tamanho mínimo: símbolo com 16 px de altura; logo horizontal com 96 px de largura.
- Não distorcer, girar, aplicar sombra ou trocar as cores fora da paleta.
- Em foto, usar a versão negativa sobre área escura ou um bloco vinho.

Geometria do símbolo (grid 146×200, traço 24, `stroke-linecap: round`):

```
Haste  M20 22 V178
Bojo   M52 22 H74 C106 22 126 43 126 70 C126 97 106 118 74 118 H52
Perna  M95 148 L125 178
```

## Cores

| Token | Hex | Uso |
|---|---|---|
| `wine` | `#6E0B1E` | Cor da marca, botões primários, links, preço |
| `wine-deep` | `#3F0611` | Hover/pressed, fundos escuros, rodapé |
| `nude` | `#E2BBA9` | Cor da fita. Destaques, selos, ilustrações. **Nunca texto.** |
| `blush` | `#F4EAE6` | Fundos de seção, cards |
| `cream` | `#FBF7F4` | Fundo principal da página |
| `ink` | `#1F1A1B` | Texto principal |
| `ink-muted` | `#6F615F` | Texto secundário (contraste AA sobre creme) |
| `line` | `#E8DDD8` | Bordas e divisórias |

Contraste: `wine` sobre `cream` ≈ 11:1; `ink-muted` sobre `cream` ≈ 5.5:1. O tom `#8A7A78` do quadro de conceitos só serve para textos ≥ 18 px.

## Tipografia

- **Marca:** Syncopate (Bold para "RUFINO", Regular para "CLINICAL"). Fica restrita ao logo e a rótulos curtos em caixa alta ("eyebrows"), com tracking ≥ 20%.
- **Interface (proposta, validar na Fase 2):** Manrope. Títulos em SemiBold com tracking levemente negativo; corpo em Regular a 16 px.

## Princípios de interface

- Poucos produtos, por isso páginas de produto ricas: fotos grandes, modo de uso, indicações e medidas.
- Preço sempre com parcelamento e o valor no Pix.
- Cantos arredondados que ecoam as pontas da fita (raio 16–28 px em cards, pill em botões).
- Muito respiro. Fundo creme, blocos blush, vinho como acento, nunca como fundo dominante da página inteira.

## Decisões de interface (Fase 2)

- Tema único claro, por decisão de marca: creme com acento vinho, e fotos de produto funcionam melhor em fundo claro.
- Raios: cards e painéis `rounded-2xl` (16 px), painéis de marca `rounded-[28px]`, todo controle interativo (botão, pill, stepper) totalmente arredondado.
- Tipografia da interface: Manrope. Syncopate só no logotipo.
- Ícones: Phosphor, traço regular.
- Z-index: header 30, overlay 40, gaveta 50.
- Produto sem foto mostra o símbolo R em vinho 10% sobre blush. Não é imagem definitiva.
