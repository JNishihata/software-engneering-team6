# md-to-pdf

`reports/` 内の Markdown ファイルを PDF に変換するツール。

- 日本語フォント（IPAGothic 等）に対応
- ` ```mermaid ` コードブロックを図としてレンダリング（DFD図・UMLクラス図など）
- A4・余白付きで整形

## 必要なもの

- Node.js
- 依存パッケージ: `marked`, `mermaid`
- ブラウザ: Playwright の Chromium

```bash
npm install marked mermaid
# Playwright の Chromium が未導入の場合
npx playwright install chromium
```

## 使い方

```bash
# node convert.mjs <入力ディレクトリ> <出力ディレクトリ>
node tools/md-to-pdf/convert.mjs reports reports_pdf
```

`reports/*.md` を変換し、同名の `reports_pdf/*.pdf` を生成する。
