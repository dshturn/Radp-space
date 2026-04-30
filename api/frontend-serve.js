const express = require('express');
const path = require('path');
const app = express();

const publicDir = path.join(__dirname, '../public');
const jsDir = path.join(__dirname, '../js');

console.log('Serving public files from:', publicDir);
console.log('Serving JS files from:', jsDir);

app.use(express.static(publicDir, { index: false }));
app.use('/js', express.static(jsDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('*', (req, res) => {
  res.status(404).send('Not found');
});

app.listen(3001, () => {
  console.log('Frontend running on http://localhost:3001');
});
