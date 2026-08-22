# Canário isolado — Player de música recuperado

## Limites de segurança

O canário deve usar o Worker `vybechat-realtime-music-canary` e um projeto Pages distinto do domínio principal. **Não** alterar `vybechat-realtime`, `vybechat.pages.dev` ou a implantação Pages recuperada `3e6ca602` durante esta etapa.

## Variáveis do Pages canário

| Variável | Valor |
|---|---|
| `VITE_DEPLOY_TARGET` | `cloudflare` |
| `VITE_REALTIME_WORKER_URL` | `https://vybechat-realtime-music-canary.gestaovybe.workers.dev` |

## Ordem de implantação

1. Publicar o Worker canário com `wrangler.canary.jsonc` e confirmar a rota `/health`.
2. Criar Pages de preview apontando para a branch `recovery/music-player-source`.
3. Configurar as variáveis acima no Pages canário e confirmar que o preview usa somente o Worker canário.
4. Testar música e chamada em dois navegadores.

## Rollback

Desativar o preview e o Worker canário. Nenhuma ação de rollback é necessária em produção, porque esta configuração não reutiliza o Worker ou o Pages principal.
