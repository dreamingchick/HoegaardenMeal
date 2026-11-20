import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const build = new URL('./dist/', root);
const staticFiles = ['index.html', 'style.css', 'game.mjs', 'paint.mjs', 'play.mjs'];
const images = await readdir(new URL('./assets/', root));
staticFiles.push(...images.filter((name) => name.endsWith('.webp')).sort().map((name) => 'assets/' + name));
const mime = {html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', mjs: 'text/javascript; charset=utf-8', webp: 'image/webp'};
const entries = await Promise.all(staticFiles.map(async (name) => {
  const bytes = await readFile(new URL(name, root));
  return ['/' + name, [mime[name.split('.').at(-1)], bytes.toString('base64')]];
}));

await mkdir(build, { recursive: true });
await Promise.all([
  ...['worker.mjs', 'game.mjs', 'ranking.mjs'].map((name) => copyFile(new URL(name, root), new URL(name, build))),
  writeFile(new URL('public-assets.mjs', build), 'export default ' + JSON.stringify(Object.fromEntries(entries)) + ';\n'),
]);
