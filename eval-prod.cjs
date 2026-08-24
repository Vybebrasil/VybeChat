const { JSDOM } = require('jsdom');
const fs = require('fs');
const js = fs.readFileSync('prod.js', 'utf8');

// We have imports, so eval won't work natively in Node without experimental modules or transforming it.
// Let's strip the imports and mock them!
let mockedJs = js.replace(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]+['"]/g, (match, imports) => {
  const vars = imports.split(',').map(s => {
    const parts = s.trim().split(/\s+as\s+/);
    if (parts.length === 2) return `const ${parts[1]} = {};`;
    return `const ${parts[0]} = {};`;
  }).join('\n');
  return vars;
});

// Mock browser globals
const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body><div id="root"></div></body></html>', {
  url: 'https://vybechat.pages.dev/',
  pretendToBeVisual: true
});
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.localStorage = { getItem: () => null, setItem: () => {} };
global.location = dom.window.location;
global.confirm = () => true;
global.console.log = (...args) => console.log('LOG:', ...args);
global.console.error = (...args) => console.error('ERR:', ...args);
global.console.warn = (...args) => console.warn('WARN:', ...args);
global.__vybechatBootstrap = {};

try {
  eval(mockedJs);
  console.log("Evaluation completed without top-level throw.");
} catch (e) {
  console.error("Evaluation threw:", e);
}
