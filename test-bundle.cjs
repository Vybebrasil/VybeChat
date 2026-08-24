const { JSDOM } = require('jsdom');
const fs = require('fs');

const distPath = './dist/public/assets';
const files = fs.readdirSync(distPath);
const cloudflareMain = files.find(f => f.startsWith('cloudflare-main-') && f.endsWith('.js'));
if (!cloudflareMain) {
  console.error("cloudflare-main bundle not found");
  process.exit(1);
}

const jsCode = fs.readFileSync(`${distPath}/${cloudflareMain}`, 'utf8');

const html = `
<!DOCTYPE html>
<html>
<head></head>
<body>
  <div id="root"></div>
  <script>${jsCode}</script>
</body>
</html>
`;

const dom = new JSDOM(html, { 
  runScripts: 'dangerously',
  url: 'http://localhost' 
});

dom.window.addEventListener('error', e => {
  console.error('Window Error:', e.error || e.message);
});
dom.window.addEventListener('unhandledrejection', e => {
  console.error('Unhandled Rejection:', e.reason);
});

setTimeout(() => {
  console.log("Root HTML:", dom.window.document.getElementById('root').innerHTML);
}, 2000);
