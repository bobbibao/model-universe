/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- Deploy helper outside the app. */
// TCP proxy 127.0.0.1:<listen> -> 127.0.0.1:<target> that holds a connection (retrying every 200 ms, up to 90 s) while
// nothing listens on the target, so a web restart behind it delays requests instead of failing them.
// Used only during scripts/deploy-zero-downtime.ps1. Usage: node scripts/hold-proxy.cjs <listen> <target> <logFile>
const net = require('node:net');
const fs = require('node:fs');
const [listen, target] = process.argv.slice(2, 4).map(Number);
const logFile = process.argv[4];
const log = (message) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
let held = 0;

net
  .createServer((client) => {
    client.pause();
    const started = Date.now();
    let attempts = 0;
    const connect = () => {
      const upstream = net.connect(target, '127.0.0.1');
      upstream.once('connect', () => {
        if (attempts) log(`connected after ${attempts} retries, held ${Date.now() - started} ms`);
        client.pipe(upstream).pipe(client);
        client.resume();
        upstream.on('error', () => client.destroy());
        client.on('error', () => upstream.destroy());
      });
      upstream.once('error', () => {
        upstream.destroy();
        if (Date.now() - started > 90_000 || client.destroyed) return client.destroy();
        if (!attempts++) held++;
        setTimeout(connect, 200);
      });
    };
    connect();
  })
  .listen(listen, '127.0.0.1', () => log(`listening ${listen} -> ${target}`));
setInterval(() => held && log(`connections that waited so far: ${held}`), 10_000).unref();
