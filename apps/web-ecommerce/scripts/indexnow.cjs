/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires -- Deploy helper outside the app. */
// Tells IndexNow (Bing, Yandex, Seznam, Naver and the answer engines built on them) which pages exist or changed:
// every URL of the live sitemap, in one request. The key is public by design: search engines read it from
// /<key>.txt (public/) to check that the request comes from the site.
// Usage: node scripts/indexnow.cjs [https://modeluniverse.vn]
const fs = require('node:fs');
const path = require('node:path');

const base = (process.argv[2] || process.env.SHOP_PUBLIC_URL || 'https://modeluniverse.vn').replace(/\/+$/, '');
const keyFile = fs.readdirSync(path.join(__dirname, '../public')).find((name) => /^[a-f0-9]{32}\.txt$/.test(name));
if (!keyFile) throw new Error('No IndexNow key file (public/<32 hex>.txt).');
const key = keyFile.replace('.txt', '');

(async () => {
  const xml = await (await fetch(`${base}/sitemap.xml`)).text();
  const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((url) => url.startsWith(base));
  if (!urlList.length) throw new Error('The sitemap lists no URL.');
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(base).host, key, keyLocation: `${base}/${keyFile}`, urlList }),
  });
  console.log(`IndexNow: ${urlList.length} URLs submitted, HTTP ${response.status}`);
  if (!response.ok && response.status !== 202) process.exitCode = 1;
})();
