# VybeChat Realtime Worker

Este Worker cuida de presença, chat e metadados das salas. A mídia principal usa
Cloudflare RealtimeKit/SFU: o Worker cria ou reutiliza uma reunião por canal e
emite um token novo para cada entrada. O motor WebRTC peer-to-peer permanece como
rollback automático enquanto o RealtimeKit não estiver configurado.

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

## Entrada pelo Monday

A tela de entrada pergunta quem esta chegando e mostra a equipe com a foto do
Monday, em vez de a pessoa digitar o proprio nome. O id do perfil passa a ser
`monday-<id>`: estavel, igual em qualquer aparelho, e e ele que define quem e
administrador.

```bash
npx wrangler secret put MONDAY_API_TOKEN
npx wrangler secret put VYBECHAT_TEAM_MONDAY_IDS
npx wrangler secret put VYBECHAT_ADMIN_MONDAY_IDS
```

- `MONDAY_API_TOKEN`: token pessoal da API do Monday (Perfil > Desenvolvedor >
  My Access Token). O cliente nunca fala com o Monday; so o Worker.
- `VYBECHAT_TEAM_MONDAY_IDS`: ids separados por virgula, na ordem em que devem
  aparecer na tela. Vazio significa "todo mundo ativo na conta".
- `VYBECHAT_ADMIN_MONDAY_IDS`: ids de quem e administrador.

O `POST /roster` exige o codigo de acesso: sem ele a lista com nomes e fotos
ficaria aberta para qualquer um com a URL. A resposta traz apenas id, nome e
foto — e-mail e telefone nunca saem do Worker.

A lista fica em cache por 6 horas no Durable Object. Se o Monday cair, vale o
cache mesmo vencido; sem cache nenhum, a tela cai no campo de nome livre em vez
de barrar quem tem acesso legitimo.

`VYBECHAT_ADMIN_SLUGS` segue funcionando para quem entrar por esse caminho.

## RealtimeKit / chamada em SFU

Crie um App em **Cloudflare Dashboard > Realtime > RealtimeKit**. O App criado
pelo painel já inclui presets padrão; confirme que existe o preset
`group-call-host` ou defina o nome usado pela equipe em
`REALTIMEKIT_PRESET_NAME`.

Configure o Worker sem colocar o token no frontend:

```bash
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID
npx wrangler secret put REALTIMEKIT_APP_ID
npx wrangler secret put CLOUDFLARE_REALTIME_API_TOKEN
npx wrangler secret put REALTIMEKIT_PRESET_NAME
```

O token da API precisa da permissão **Realtime Admin**. Depois do deploy,
`GET /health` informa `"callEngine":"realtimekit"`. O endpoint
`POST /calls/session` valida o mesmo código interno da equipe, reutiliza a
reunião associada ao canal e devolve um token de participante de uso único.

No projeto Pages, mantenha `VITE_CALL_ENGINE=auto` durante a transição. Para
exigir SFU sem fallback, use `VITE_CALL_ENGINE=realtimekit`. Para rollback
emergencial, use `VITE_CALL_ENGINE=legacy` e gere um novo build.

## O que o Worker garante

- Nenhum evento e aceito antes de um `presence:join` valido: sem o codigo correto
  a conexao nao le historico, presenca, decisoes nem sinalizacao de chamada.
- O codigo e comparado em tempo constante.
- Ids de canal fora da lista canonica sao recusados na escrita e na leitura.

## Limite conhecido

O codigo e compartilhado por toda a equipe: ele barra quem esta de fora, mas nao
impede que um integrante entre com o nome de outro. Uma sessao por pessoa exige
token individual emitido no login, o que ainda nao existe.

## Divisão de responsabilidades

- Durable Object: presença, chat, canais, convites, mão levantada e o vínculo
  persistente entre canal e reunião.
- RealtimeKit: sessão, reconexão e roteamento de áudio, vídeo e tela pelo SFU.
- Motor legado: somente rollback; usa TURN quando `VITE_TURN_*` estiver definido.

Credenciais TURN estáticas no build antigo continuam aceitas apenas para o
rollback. O caminho RealtimeKit obtém conectividade e relay pela própria sessão
gerenciada e não expõe segredo TURN no bundle.
