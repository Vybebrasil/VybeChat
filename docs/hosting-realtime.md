# Hospedagem em tempo real do VybeChat

O VybeChat usa Socket.io para presença, ocupação de salas, estados de áudio e sinalização WebRTC. Esses eventos mantêm o estado das salas em memória no processo do servidor. Por isso, a aplicação precisa de uma única instância persistente para que todas as pessoas conectadas compartilhem a mesma visão de quem está na sala.

## Decisão de implantação

| Opção | Adequação ao VybeChat | Decisão |
|---|---|---|
| Manus Autoscale | Pode iniciar múltiplas instâncias e não preserva o estado de Socket.io entre elas. | Não indicada para uso recorrente das salas. |
| Vercel padrão | Funções serverless não são adequadas para manter o processo Socket.io que o produto usa hoje. Exigiria um serviço separado de sinalização. | Não publicar a arquitetura atual diretamente. |
| Manus Reserved Hosting | Mantém uma única instância Node persistente para o Socket.io e a sinalização WebRTC. | Opção recomendada para a primeira liberação ao time. |

## Condições de operação

As chamadas continuam peer-to-peer: câmera, microfone e tela trafegam diretamente entre os navegadores. O servidor persistente carrega apenas eventos leves de presença e sinalização. Para redes corporativas restritivas, uma etapa futura pode acrescentar um serviço TURN; sem ele, algumas redes podem bloquear conexões diretas entre participantes.

## Custo e ativação

Reserved Hosting é cobrado por uso. No limite de uso contínuo de 1 vCPU e 0,5 GB de RAM, o teto estimado é de até US$ 37,50/mês, antes do crédito mensal de US$ 10, além de tráfego de saída. A ativação deve ser confirmada pelo responsável do projeto antes de publicar o uso do time.
