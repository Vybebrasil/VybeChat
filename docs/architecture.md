# VybeChat — Direção de Produto e Arquitetura

## Referência visual observada

O Vybe Painel usa uma linguagem de central operacional: fundo quase preto com textura e brilho suave, alto contraste para títulos, micro-rótulos em caixa alta, contornos finos e módulos organizados por uma grade rigorosa. A interface do VybeChat traduz essa linguagem em um produto de comunicação: um canvas escuro, painéis de baixa elevação, roxo/violeta como acento primário, âmbar reservado para estados de atenção e badges compactos para presença.

| Elemento | Direção para o VybeChat |
|---|---|
| Base visual | Superfícies carvão em camadas, com ruído/grãos discretos e halos violetas controlados. |
| Hierarquia | Títulos fortes, labels técnicas em caixa alta e numerais/indicadores curtos. |
| Navegação | Sidebar estreita, categorias expansíveis e navegação por canais com estados nítidos. |
| Presença | Pontos de status e avatares compactos, próximos dos nomes e membros conectados. |
| Chamadas | Área de mídia em mosaico, controles arredondados e borda violeta para transmissões ativas. |

## Arquitetura do MVP

O frontend usa React e o backend Express/tRPC já disponíveis no projeto. O banco de dados persiste categorias, canais, membros e mensagens; as consultas e mutações protegidas são feitas por tRPC. Um servidor Socket.io no mesmo processo do backend distribui eventos transitórios: presença, indicador de digitação, mensagens novas e a sinalização de oferta, resposta e ICE do WebRTC.

As chamadas são diretamente entre navegadores por WebRTC. A câmera e o microfone vêm de `navigator.mediaDevices.getUserMedia()` e o compartilhamento de tela vem de `navigator.mediaDevices.getDisplayMedia()`. Socket.io não carrega mídia; ele apenas apresenta os pares para negociação. Para uso fora de uma rede simples, conexões WebRTC podem exigir servidores STUN/TURN para atravessar NATs restritivos; este MVP não terá servidor de mídia nem servidor TURN próprio, conforme a restrição definida.

## Condição de hospedagem

O estado de presença e a sinalização mantidos em memória exigem uma única instância de processo contínua. O preview local suporta essa experiência. Antes de publicar para uso recorrente do time, o projeto deve operar em hospedagem reservada de instância única, ou então mover presença/sinalização para uma infraestrutura compartilhada compatível com múltiplas réplicas.
