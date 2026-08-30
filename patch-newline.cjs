const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

c = c.replace(
  '{channelMessages.map((message, index) => (\\n                      <Fragment key={message.id}>',
  '{channelMessages.map((message, index) => (\\n                      <Fragment key={message.id}>'
);

c = c.replace(
  '{channelMessages.map((message, index) => (\\n                      <Fragment',
  '{channelMessages.map((message, index) => (\\n                      <Fragment'
);

// Actually, let's just find the index of `{channelMessages.map((message, index) => (`
// and replace the "\\n" literal there!
const badStr = '{channelMessages.map((message, index) => (\\n                      <Fragment key={message.id}>';
const goodStr = '{channelMessages.map((message, index) => (\n                      <Fragment key={message.id}>';

c = c.split(badStr).join(goodStr);

fs.writeFileSync('client/src/pages/CloudflareHome.tsx', c);
