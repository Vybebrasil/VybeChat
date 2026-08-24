const fs=require('fs');const p=require('path');function walk(d){let ls=[];fs.readdirSync(d).forEach(f=>{const pf=p.join(d,f);if(fs.statSync(pf).isDirectory())ls.push(...walk(pf));else if(pf.endsWith('.tsx')||pf.endsWith('.ts'))ls.push(pf);});return ls;}const files=walk('client/src');let icons=new Set();files.forEach(f=>{const c=fs.readFileSync(f,'utf8');const m=c.match(/import\s+\{([^}]+)\}\s+from\s+[\"']lucide-react[\"']/g);if(m)m.forEach(i=>{const ex=i.match(/\{([^}]+)\}/)[1];ex.split(',').forEach(x=>icons.add(x.trim()));});});
const lucide = require('lucide-react');
let missing = [];
for (const icon of icons) {
  if (icon && !lucide[icon]) missing.push(icon);
}
console.log("Missing icons:", missing);
