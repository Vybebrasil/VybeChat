const fs = require('fs');
let c = fs.readFileSync('client/src/index.css', 'utf8');

c = c.replace('\n@import "./theme-gaming.css";\n', '');
c = c.replace('@import "./theme-gaming.css";', ''); // in case it was without newlines
c = '@import "./theme-gaming.css";\n' + c;

fs.writeFileSync('client/src/index.css', c);
