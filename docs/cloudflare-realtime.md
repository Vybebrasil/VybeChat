# Arquitetura de sinalização Cloudflare

## Decisão técnica

O Worker `vybechat-realtime` está disponível em `https://vybechat-realtime.gestaovybe.workers.dev`. As salas devem usar um Durable Object por identificador de canal para coordenar presença, chat efêmero e sinalização WebRTC. Cada cliente abre um WebSocket em `/room/<id>`; o Worker encaminha a conexão ao Durable Object da sala.

## Requisitos de configuração

O Worker precisa de uma vinculação de Durable Object chamada `VYBECHAT_ROOM`, associada à classe `VybeChatRoom`, e uma migração inicial que declare a classe. Sem essa vinculação, o Worker padrão responde ao HTTP, mas não mantém ocupação compartilhada por sala.

## Comportamento esperado

O Durable Object deve aceitar WebSockets com a API de hibernação, manter a identidade curta do participante em `serializeAttachment`, transmitir presença e eventos de sinalização apenas para os demais sockets da mesma sala, e avisar a saída ao desconectar. Câmera, microfone e tela continuam peer-to-peer por WebRTC.

## Referências externas

1. [Cloudflare — Use WebSockets with Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/websockets/) descreve o uso recomendado de WebSockets hibernáveis, encaminhamento do Worker e bindings/migrations necessários.
2. [Cloudflare — Make and answer WebRTC calls](https://developers.cloudflare.com/learning-paths/durable-objects-course/series/make-answer-webrtc-calls-6/) apresenta o padrão de sinalização peer-to-peer com Durable Objects.
3. [Vercel — WebSockets](https://vercel.com/docs/functions/websockets) confirma suporte atual a WebSockets e Socket.io, mas recomenda estado compartilhado externo quando reconexões podem chegar a instâncias diferentes.
