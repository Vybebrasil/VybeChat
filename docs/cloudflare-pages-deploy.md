# Publicação do VybeChat no Cloudflare Pages

O frontend externo usa o mesmo tema e os mesmos componentes visuais do projeto Manus, mas troca o acesso e o backend por uma camada compatível com Cloudflare. O build é gerado pelo comando `pnpm build:cloudflare` e fica em `dist/public`.

No Cloudflare Pages, configure o comando de build como `pnpm build:cloudflare` e o diretório de saída como `dist/public`. Cadastre a variável `VITE_REALTIME_WORKER_URL` com a URL pública do Worker. Antes de liberar o endereço, proteja o projeto com Cloudflare Access e permita somente os e-mails da equipe.

A implantação do Worker deve usar o diretório `cloudflare-worker/vybechat-realtime`, onde estão o script, a vinculação `VYBECHAT_ROOM` e a migração inicial da classe `VybeChatRoom`.
