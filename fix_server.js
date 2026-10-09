const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync('server.js', content);
