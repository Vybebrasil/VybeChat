# VybeChat Realtime Worker

Este Worker substitui Socket.io somente na camada de presença e sinalização WebRTC. Ele não carrega vídeo, áudio ou tela; a mídia permanece peer-to-peer nos navegadores.

## Implantação no painel Cloudflare

Abra o Worker `vybechat-realtime` e escolha **Editar código**. Substitua o conteúdo pelo arquivo [`src/index.js`](./src/index.js). Nas configurações do Worker, adicione uma vinculação de Durable Object chamada `VYBECHAT_ROOM` para a classe `VybeChatRoom`. A migração inicial é descrita em [`wrangler.jsonc`](./wrangler.jsonc); se o painel pedir um nome de classe ou uma migração, use exatamente esses valores.

Depois de salvar e implantar, o endpoint de saúde deve responder em `https://vybechat-realtime.gestaovybe.workers.dev/health`. As conexões do produto usam `wss://vybechat-realtime.gestaovybe.workers.dev/room/vybe-os`.

## Configuracao obrigatoria de acesso

O Worker agora e *fail-closed*: sem o segredo abaixo ninguem entra, nem consegue
ler historico. Antes de publicar, defina:

```bash
npx wrangler secret put VYBECHAT_WORKSPACE_CODE
npx wrangler secret put VYBECHAT_ADMIN_SLUGS
```

- `VYBECHAT_WORKSPACE_CODE`: o codigo que a equipe digita na tela de entrada.
  Enquanto ele nao existir, o VybeChat responde "ainda nao foi liberado".
- `VYBECHAT_ADMIN_SLUGS`: lista separada por virgula com o *slug* do nome de quem
  e administrador, por exemplo `paulo,mizinho`. O cliente monta o `userId` como
  `slug-timestamp-aleatorio`, entao basta o slug. Sem isso ninguem consegue fixar
  mensagens, mudar permissoes de canal ou promover alguem.

Para desenvolver localmente, crie `.dev.vars` (ja ignorado pelo git) com as duas
variaveis e rode `npx wrangler dev`.

## O que o Worker garante

- Nenhum evento e aceito antes de um `presence:join` valido: sem o codigo correto
  a conexao nao le historico, presenca, decisoes nem sinalizacao de chamada.
- O codigo e comparado em tempo constante.
- Ids de canal fora da lista canonica sao recusados na escrita e na leitura.

## Limite conhecido

O codigo e compartilhado por toda a equipe: ele barra quem esta de fora, mas nao
impede que um integrante entre com o nome de outro. Uma sessao por pessoa exige
token individual emitido no login, o que ainda nao existe.

## Limite do MVP

Esta implementação é pensada para uma equipe pequena. Ela mantém os participantes de uma sala em um Durable Object e distribui apenas eventos de presença, mensagem, digitação e sinalização. Para ambientes de rede restritos, uma futura etapa pode adicionar TURN para ampliar a taxa de conexão das chamadas.
