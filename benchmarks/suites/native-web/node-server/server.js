const http = require('http');

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, {
      'Content-Length': '13',
      'Connection': 'keep-alive'
    });
    res.end('Hello, World!');
  } else {
    res.writeHead(404);
    res.end();
  }
});

server.listen(8080, () => {
  console.log('Listening on :8080');
});
