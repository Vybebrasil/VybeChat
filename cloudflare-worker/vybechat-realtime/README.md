# VybeChat Realtime Worker

Este Worker substitui Socket.io somente na camada de presença e sinalização WebRTC. Ele não carrega vídeo, áudio ou tela; a mídia permanece peer-to-peer nos navegadores.

## Implantação no painel Cloudflare

Abra o Worker `vybechat-realtime` e escolha **Editar código**. Substitua o conteúdo pelo arquivo [`src/index.js`](./src/index.js). Nas configurações do Worker, adicione uma vinculação de Durable Object chamada `VYBECHAT_ROOM` para a classe `VybeChatRoom`. A migração inicial é descrita em [`wrangler.jsonc`](./wrangler.jsonc); se o painel pedir um nome de classe ou uma migração, use exatamente esses valores.

Depois de salvar e implantar, o endpoint de saúde deve responder em `https://vybechat-realtime.gestaovybe.workers.dev/health`. As conexões do produto usam `wss://vybechat-realtime.gestaovybe.workers.dev/room/vybe-os`.

## Limite do MVP

Esta implementação é pensada para uma equipe pequena. Ela mantém os participantes de uma sala em um Durable Object e distribui apenas eventos de presença, mensagem, digitação e sinalização. Para ambientes de rede restritos, uma futura etapa pode adicionar TURN para ampliar a taxa de conexão das chamadas.
