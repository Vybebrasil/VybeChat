# Status de implantação no Cloudflare

## Camada de tempo real

Em 18 de agosto de 2026, o Worker `vybechat-realtime` foi conectado ao repositório `Vybebrasil/VybeChat` usando o diretório raiz `cloudflare-worker/vybechat-realtime`. A build associada ao commit `76dbfda` concluiu com sucesso e promoveu a versão `2f4560d3` para 100% do tráfego.

As verificações pós-promoção confirmaram `GET /health` com HTTP 200 e uma conexão WebSocket em `/room/<id>`, incluindo o evento `presence:update`. Isso demonstra que o binding `VYBECHAT_ROOM` do Durable Object está ativo na versão publicada.

## Frontend

O projeto Cloudflare Pages está sendo preparado a partir do mesmo repositório, com branch de produção `main`. Os campos necessários no assistente de configuração são:

| Campo | Valor |
|---|---|
| Nome do projeto | `vybechat` |
| Comando da build | `pnpm build:cloudflare` |
| Diretório de saída da build | `dist/public` |
| Diretório raiz | `/` |
| Variável de ambiente | `VITE_REALTIME_WORKER_URL=https://vybechat-realtime.gestaovybe.workers.dev` |

Após a implantação inicial do Pages, será necessário validar a comunicação entre o frontend e o Worker, os recursos de chamada e o controle de acesso da equipe.

## Publicação inicial do frontend

O Cloudflare Pages publicou o frontend com sucesso em `https://vybechat.pages.dev`. A página de entrada e a interface principal foram abertas em produção; uma sessão temporária de validação exibiu o status de presença com `1 online`, comprovando a ligação entre o bundle estático e o Worker publicado.

## Compatibilidade com Safari

Após um relato de tela branca no Safari, a rota Cloudflare deixou de carregar a página interna e seu renderizador avançado de markdown no bundle inicial. O frontend agora usa carregamento sob demanda para páginas internas, texto nativo para mensagens no painel Cloudflare e alvo de build `safari13`. A correção foi enviada no commit `cdc26e0`; a nova implantação de produção está em processamento e deve ser revalidada no navegador afetado após sua promoção.
