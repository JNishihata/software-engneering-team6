import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { marked } = require('marked');

// Resolve globally-installed playwright
const globalRoot = execSync('npm root -g').toString().trim();
const { chromium } = require(path.join(globalRoot, 'playwright'));

const mermaidJs = readFileSync(require.resolve('mermaid/dist/mermaid.min.js'), 'utf8');

const REPORTS_DIR = process.argv[2];
const OUT_DIR = process.argv[3];

const cssStyle = `
  * { box-sizing: border-box; }
  body {
    font-family: "IPAPGothic", "IPAGothic", sans-serif;
    line-height: 1.7;
    color: #222;
    margin: 0;
    padding: 0;
    font-size: 11pt;
  }
  h1 { font-size: 20pt; border-bottom: 3px solid #2c5f8a; padding-bottom: 6px; margin-top: 0; }
  h2 { font-size: 15pt; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
  h3 { font-size: 13pt; margin-top: 18px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #eef3f8; }
  code { background: #f4f4f4; padding: 1px 4px; border-radius: 3px; font-size: 90%; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
  blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 12px; color: #555; }
  .mermaid { text-align: center; margin: 16px 0; }
  a { color: #2c5f8a; }
`;

// Custom marked renderer: keep mermaid code blocks as <pre class="mermaid">
const renderer = new marked.Renderer();
const origCode = renderer.code.bind(renderer);
renderer.code = function (token) {
  const lang = token.lang || (typeof token === 'object' ? token.lang : '');
  const text = typeof token === 'object' ? token.text : token;
  if ((lang || '').trim() === 'mermaid') {
    return `<pre class="mermaid">${text}</pre>`;
  }
  return origCode(token);
};
marked.setOptions({ renderer });

function buildHtml(title, bodyHtml) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<title>${title}</title><style>${cssStyle}</style></head>
<body><main>${bodyHtml}</main>
<script>${mermaidJs}</script>
<script>
  mermaid.initialize({ startOnLoad: false, theme: 'default', flowchart: { htmlLabels: true }, fontFamily: 'IPAPGothic, IPAGothic, sans-serif' });
  window.__renderMermaid = async () => { await mermaid.run(); return true; };
</script>
</body></html>`;
}

const files = readdirSync(REPORTS_DIR).filter(f => f.endsWith('.md')).sort();

const browser = await chromium.launch();

for (const file of files) {
  const md = readFileSync(path.join(REPORTS_DIR, file), 'utf8');
  const title = file.replace(/\.md$/, '');
  const bodyHtml = marked.parse(md);
  const html = buildHtml(title, bodyHtml);

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle' });
  // Render mermaid diagrams, wait for completion
  try {
    await page.evaluate(() => window.__renderMermaid());
    await page.waitForFunction(() => {
      const pending = document.querySelectorAll('pre.mermaid:not([data-processed="true"])');
      return pending.length === 0;
    }, { timeout: 15000 });
  } catch (e) {
    // no mermaid or already done
  }
  await page.waitForTimeout(300);

  const outPath = path.join(OUT_DIR, `${title}.pdf`);
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  });
  await page.close();
  console.log('generated:', outPath);
}

await browser.close();
console.log('DONE');
