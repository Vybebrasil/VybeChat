const fs = require('fs');
let c = fs.readFileSync('client/src/index.css', 'utf8');
c += '\n@import "./theme-gaming.css";\n';
fs.writeFileSync('client/src/index.css', c);
