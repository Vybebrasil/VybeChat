# Plano reversível de promoção — Música da sala

## Referências congeladas

| Item | Referência | Papel |
|---|---|---|
| Pages em produção | `3e6ca602.vybechat.pages.dev` / `ae22c04` | Versão recuperada que preserva player e chamada usados pela equipe. |
| Código reconstruído | `/home/ubuntu/vybechat-music-recovery` | Cópia isolada; não é a produção atual. |
| Worker de produção | `vybechat-realtime` ativo | Permanece imutável até o aceite em uma chamada real. |

## Escopo isolado da promoção

O diff recuperado contém o painel de música, parser de URLs do YouTube, estado persistente de fila e os eventos `music:get`, `music:enqueue`, `music:claim-dj` e `music:control`. Os eventos de chamada `call:offer`, `call:answer` e `call:ice` não foram alterados: eles continuam no bloco original do Worker e não fazem parte da promoção de música.

> Não promover o Worker atual por inteiro. A promoção deve ser realizada em canário, com uma cópia dedicada do Worker, para que o tráfego de chamada estável não seja alterado durante o teste.

## Sequência de promoção segura

| Etapa | Ação | Critério de saída | Rollback |
|---|---|---|---|
| 1 | Salvar o diff recuperado em uma branch de recuperação. | Typecheck, 37 testes e build passam. | Descartar a branch. |
| 2 | Criar um Pages de preview apontando apenas para a branch de recuperação. | Preview abre, mostra o painel e não afeta `vybechat.pages.dev`. | Apagar o preview. |
| 3 | Publicar um Worker canário com os eventos `music:*`, sem modificar `vybechat-realtime`. | O canário atende apenas o preview. | Desativar o canário. |
| 4 | Em dois navegadores, testar fila, play/pause, posição, troca de DJ e chamada de áudio. | Música sincroniza; áudio/vídeo/chamada não regrediram. | Voltar o preview ao Worker original. |
| 5 | Somente após aceite, promover Pages e Worker canário para a produção. | Equipe aprova player e chamada. | Reverter Pages para `3e6ca602`; manter ou retornar Worker ativo anterior. |

## Critérios obrigatórios de aceite

1. Uma pessoa adiciona vídeo e playlist; ambas veem a mesma fila.
2. Play, pause, avanço e posição chegam ao segundo participante em até dois segundos.
3. Uma pessoa que entra depois recebe a faixa e a posição atuais.
4. O volume do player é individual e não altera o volume da chamada.
5. A chamada mantém áudio nos dois sentidos antes, durante e depois de usar o painel.
6. Encerrar a música, trocar de canal ou sair da sala não deixa tracks, sockets ou controles presos.
