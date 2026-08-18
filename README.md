# VybeChat

O VybeChat é a central interna de comunicação da Vybe, criada para organizar conversas por canais, alinhar o time em chamadas de voz e vídeo e compartilhar telas diretamente no navegador.

## Arquitetura de tempo real

O projeto usa Manus OAuth para autenticação, React no cliente, Express/tRPC para operações persistentes e MySQL para categorias, canais e histórico de mensagens. Um servidor Socket.io integrado ao processo do backend transmite presença, digitação, atualização de mensagens e sinalização WebRTC. A mídia nunca passa pelo Socket.io: câmera, microfone e tela são trocados diretamente entre os navegadores.

As chamadas usam `getUserMedia()` e o compartilhamento usa `getDisplayMedia()`. O servidor apenas conduz a troca de ofertas, respostas e candidatos ICE entre pares. O MVP inclui STUN público de desenvolvimento para descoberta de rede; em redes corporativas restritivas, é esperado que uma futura etapa adicione TURN para confiabilidade de conexão.

## Condições de hospedagem

Como a presença e a sinalização são mantidas na memória do processo, a experiência em produção requer uma instância única e contínua ou uma camada compartilhada de eventos para múltiplas instâncias. O preview local suporta o fluxo do MVP. Antes de liberar o uso recorrente ao time, configure hospedagem reservada de instância única ou evolua a infraestrutura de eventos.

## Desenvolvimento

Use `pnpm dev` para iniciar o projeto, `pnpm test` para a suíte de testes e `pnpm check` para validar os tipos. A documentação de identidade visual e decisões de produto está em [`docs/architecture.md`](./docs/architecture.md).
