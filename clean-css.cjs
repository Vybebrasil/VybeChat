const fs = require('fs');
let c = fs.readFileSync('client/src/index.css', 'utf8');

c = c.replace(/@import "\.\/theme-gaming\.css";/g, '');
c = '@import "./theme-gaming.css";\n' + c.trim();

fs.writeFileSync('client/src/index.css', c);
