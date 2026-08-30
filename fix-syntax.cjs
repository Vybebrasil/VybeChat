const fs = require('fs');
let c = fs.readFileSync('client/src/pages/CloudflareHome.tsx', 'utf8');

const regex = /onOpenMusic=\{\(\) => setMusicOpen\(true\)\}\n\s*gateSensitivity=\{gateSensitivity\}/;
c = c.replace(regex, `onOpenMusic={() => setMusicOpen(true)}
              />
            )}`);

// There is a stray block of props here maybe?
// Let's see what is actually supposed to be here.
