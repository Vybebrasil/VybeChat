const fs = require('fs');
const js = fs.readFileSync('prod.js', 'utf8');

const { JSDOM } = require('jsdom');
const dom = new JSDOM(`
  <!DOCTYPE html><html><body><div id="root"></div></body></html>
`, { url: 'http://localhost' });

// We need to patch require for ESM chunks...
// Actually, since prod.js has imports, we CANNOT evaluate it easily with eval.
// Instead, let's just parse it using acorn to ensure no syntax errors.
const acorn = require('acorn');
try {
  acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module' });
  console.log("No syntax errors found by acorn.");
} catch (e) {
  console.error("Syntax Error:", e);
}
