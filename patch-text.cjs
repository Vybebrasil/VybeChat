const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

c = c.replace(
  'Conversa e contexto da equipe',
  '{appMode === "vybegaming" ? "Lobby do servidor" : "Conversa e contexto da equipe"}'
);

c = c.replace(
  'Este é o início do canal. Envie a primeira mensagem para a equipe, compartilhe atualizações ou inicie uma chamada de voz para alinhar os próximos passos.',
  '{appMode === "vybegaming" ? "Este é o início do lobby. Mande um salve pra galera ou abra call pra jogar." : "Este é o início do canal. Envie a primeira mensagem para a equipe, compartilhe atualizações ou inicie uma chamada de voz para alinhar os próximos passos."}'
);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
