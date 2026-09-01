#!/usr/bin/env node
/**
 * Prompt-repo site generator — reads repo.config.json + prompts.json in the
 * current repo directory and (re)generates:
 *   README.md, README.zh-CN.md, docs/categories/<category>.md
 *
 * Single source of truth: prompts.json. Never hand-edit generated files.
 * Validation failures (dup ids, unknown category, featured entry missing its
 * image file) exit non-zero so CI can catch drift.
 *
 * Usage:  cd github-repos/<repo> && node ../template/scripts/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const repoDir = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(repoDir, 'repo.config.json'), 'utf8'));
const prompts = JSON.parse(fs.readFileSync(path.join(repoDir, 'prompts.json'), 'utf8'));

const catById = new Map(cfg.categories.map((c) => [c.id, c]));
const errors = [];
const warnings = [];

// ---------- validation ----------
const seen = new Set();
for (const p of prompts) {
  if (seen.has(p.id)) errors.push(`duplicate id: ${p.id}`);
  seen.add(p.id);
  if (!catById.has(p.category)) errors.push(`${p.id}: unknown category "${p.category}"`);
  if (!p.title_en || !p.title_zh || !p.prompt) errors.push(`${p.id}: missing title_en/title_zh/prompt`);
  if (p.image && !fs.existsSync(path.join(repoDir, p.image))) {
    errors.push(`${p.id}: image file missing: ${p.image}`);
  }
  if (p.featured && !p.image) {
    warnings.push(`${p.id}: featured but has no image — excluded from grid`);
  }
}
if (errors.length) {
  console.error('BUILD ERRORS:\n' + errors.map((e) => '  - ' + e).join('\n'));
  process.exit(1);
}

// ---------- helpers ----------
const cta = (p) =>
  `${cfg.ctaBase}?prompt=${encodeURIComponent(p.prompt)}` +
  `&utm_source=${cfg.utm.source}&utm_content=${p.id}` +
  (cfg.utm.campaign ? `&utm_campaign=${cfg.utm.campaign}` : '');

const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const fence = (s) => '```text\n' + String(s).replace(/```/g, '‘‘‘') + '\n```';
const title = (p, lang) => (lang === 'zh' ? p.title_zh : p.title_en);

function grid(entries, columns, lang) {
  const rows = [];
  // Grid cells prefer the square crop (images/grid/<id>.webp) so mixed native
  // aspect ratios render as an even table; category pages keep full images.
  const gridSrc = (p) =>
    fs.existsSync(path.join(repoDir, 'images', 'grid', `${p.id}.webp`))
      ? `images/grid/${p.id}.webp`
      : p.image;
  for (let i = 0; i < entries.length; i += columns) {
    const cells = entries.slice(i, i + columns).map((p) =>
      `<td align="center" valign="top" width="${Math.floor(600 / columns)}">
  <a href="${escAttr(cta(p))}" title="${escAttr(title(p, lang))}">
    <img src="${escAttr(gridSrc(p))}" alt="${escAttr(title(p, lang))}" width="${Math.floor(560 / columns)}" />
  </a>
  <br /><sub><b>${escAttr(title(p, lang))}</b></sub>
</td>`
    );
    rows.push('<tr>\n' + cells.join('\n') + '\n</tr>');
  }
  return `<table align="center">\n${rows.join('\n')}\n</table>`;
}

function categoriesTable(lang) {
  const zh = lang === 'zh';
  const rows = [];
  for (const c of cfg.categories) {
    const list = prompts.filter((p) => p.category === c.id);
    if (!list.length) continue;
    const thumb = fs.existsSync(path.join(repoDir, 'images', 'grid', `${list[0].id}.webp`))
      ? `images/grid/${list[0].id}.webp`
      : list[0].image;
    rows.push(`<tr>
<td align="center" width="84"><a href="docs/categories/${c.id}.md"><img src="${escAttr(thumb)}" alt="${escAttr(c.label_en)}" width="72" /></a></td>
<td><a href="docs/categories/${c.id}.md"><b>${c.icon} ${escAttr(zh ? c.label_zh : c.label_en)}</b></a><br /><sub>${zh ? c.label_en : c.label_zh}</sub></td>
<td><sub>${escAttr(zh ? c.desc_zh : c.desc_en)}</sub></td>
<td align="center"><a href="docs/categories/${c.id}.md"><b>${list.length}</b></a></td>
</tr>`);
  }
  const head = zh ? '预览' : 'Preview', cat = zh ? '分类' : 'Category', desc = zh ? '说明' : 'Description', num = zh ? '条数' : 'Prompts';
  return `<table align="center">\n<tr><th width="84">${head}</th><th align="left">${cat}</th><th align="left">${desc}</th><th>${num}</th></tr>\n${rows.join('\n')}\n</table>`;
}

function promptSection(p, index, lang) {
  const cat = catById.get(p.category);
  const tryIt =
    lang === 'zh'
      ? `🎨 [用这个提示词一键生成 →](${cta(p)})`
      : `🎨 [Try this prompt →](${cta(p)})`;
  const img = p.image
    ? `<p align="center"><a href="${escAttr(cta(p))}"><img src="${escAttr(p.image)}" alt="${escAttr(title(p, lang))}" width="640" /></a></p>`
    : `> 🖼 Preview image coming soon.`;
  const catLabel = lang === 'zh' ? cat.label_zh : cat.label_en;
  const enBlock = p.prompt_en
    ? `${lang === 'zh' ? '**英文版 · English**' : '**English version**'}\n\n${fence(p.prompt_en)}\n\n`
    : '';
  const creditBlock = p.credit?.url
    ? `${lang === 'zh'
        ? `👤 来源：[@${p.credit.author}](${p.credit.url}) · 由原作者公开发布`
        : `👤 Credit: [@${p.credit.author}](${p.credit.url}) · shared publicly by the original author`}\n\n`
    : '';
  return `## ${index}. ${title(p, lang)}

${catLabel} · \`${p.aspectRatio || '1:1'}\` · \`${p.id}\`

${img}

${fence(p.prompt)}

${enBlock}${creditBlock}${tryIt}

[⬆ Back to top](#${lang === 'zh' ? '目录' : 'categories'})
`;
}

function readme(lang) {
  const zh = lang === 'zh';
  const L = (en, cn) => (zh ? cn : en);
  const withImage = prompts.filter((p) => p.image);
  const featured = (prompts.filter((p) => p.featured && p.image).length
    ? prompts.filter((p) => p.featured && p.image)
    : withImage
  ).slice(0, cfg.grid.featured);

  const hasBanner = fs.existsSync(path.join(repoDir, 'images', 'banner.webp'));
  const badgeBase = `https://img.shields.io/badge`;
  const badges = [
    `![Prompts](${badgeBase}/prompts-${prompts.length}-blue)`,
    `![Images](${badgeBase}/preview%20images-${withImage.length}-green)`,
    `[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](LICENSE)`,
    `[![GitHub Stars](https://img.shields.io/github/stars/${cfg.org}/${cfg.repo}?style=flat&color=yellow)](https://github.com/${cfg.org}/${cfg.repo}/stargazers)`,
    `[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)`,
  ].join('\n');

  const ctaButtons = [
    `[${L('🎨 Generate at ' + cfg.site_host, '🎨 去 ' + cfg.site_host + ' 生成')}](${cfg.site})`,
    ...(cfg.siblings || []).map((s) => `[${s.label}](${s.url})`),
  ].join(' · ');

  return `${hasBanner ? `<img src="images/banner.webp" alt="${escAttr(cfg.repo_badge_name || cfg.repo)}" width="896" />\n\n` : ''}<div align="center">

# ${cfg.repo_badge_name || cfg.repo}

**${zh ? cfg.tagline_zh : cfg.tagline_en}**

${badges}

${zh ? `[**English**](README.md) | 简体中文` : `English | [**简体中文**](README.zh-CN.md)`}

**${ctaButtons}**

</div>

---

## ${L('✨ Featured', '✨ 精选')}

<div align="center"><sub>${L('Click any image to open the generator with the prompt pre-filled.', '点击任意图片即可打开生成器，提示词已自动填好。')}</sub></div>

<br />

${grid(featured, cfg.grid.columns, lang)}

<br />

## ${L('📚 Categories', '📚 分类目录')}

${categoriesTable(lang)}

<br />

## ${L('🚀 How to use', '🚀 使用方法')}

1. ${L('Browse a category above and copy any prompt.', '在上方分类中浏览并复制任意提示词。')}
2. ${L('Or simply click a preview image — it opens ' + cfg.site_host + ' with that prompt already in the input box.', '或者直接点击示例图——会在 ' + cfg.site_host + ' 打开并自动填入该提示词。')}
3. ${L('Tweak wording, aspect ratio or style to make it yours.', '按需修改措辞、比例或风格，变成你自己的版本。')}

## ${L('🤝 Contributing', '🤝 参与贡献')}

${L('New prompts are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).', '欢迎投稿新提示词！见 [CONTRIBUTING.md](CONTRIBUTING.md)。')}

## ${L('📄 License & attribution', '📄 许可与署名')}

${L(
  'Prompts and preview images are licensed [CC BY 4.0](LICENSE). Preview images are AI-generated. This is an independent community curation — not affiliated with or endorsed by ' + cfg.model.vendor + '. See [NOTICE.md](NOTICE.md).',
  '提示词与示例图采用 [CC BY 4.0](LICENSE) 许可。示例图均为 AI 生成。本仓库为独立社区策展，与 ' + cfg.model.vendor + ' 无官方关联，详见 [NOTICE.md](NOTICE.md)。')}

---

<div align="center">

${L('⭐ Star this repo if it helps you', '⭐ 觉得有用就点个 Star 吧')}

<sub>${L('Curated by', '由')} [${cfg.site_host}](${cfg.site})${cfg.siblings?.length ? ' · ' + cfg.siblings.map((s) => `[${s.label}](${s.url})`).join(' · ') : ''}</sub>

</div>
`;
}

// ---------- write outputs ----------
fs.writeFileSync(path.join(repoDir, 'README.md'), readme('en'));
fs.writeFileSync(path.join(repoDir, 'README.zh-CN.md'), readme('zh'));

fs.mkdirSync(path.join(repoDir, 'docs', 'categories'), { recursive: true });
for (const c of cfg.categories) {
  const list = prompts.filter((p) => p.category === c.id);
  if (!list.length) continue;
  const body = list.map((p, i) => promptSection(p, i + 1, 'en')).join('\n---\n\n');
  const bodyZh = list.map((p, i) => promptSection(p, i + 1, 'zh')).join('\n---\n\n');
  fs.writeFileSync(
    path.join(repoDir, 'docs', 'categories', `${c.id}.md`),
    `# ${c.icon} ${c.label_en} · ${c.label_zh}

${c.desc_en}

${list.length} prompts · [← README](../../README.md)

${body}

---

# ${c.label_zh}

${c.desc_zh}

${bodyZh}
`
  );
}

const readmeBytes = fs.statSync(path.join(repoDir, 'README.md')).size;
if (readmeBytes > 480_000) warnings.push(`README.md is ${readmeBytes} bytes — over the 480KB safety line (GitHub renders only 512KB)`);

console.log(`✔ README.md (${(readmeBytes / 1024).toFixed(1)} KB)`);
console.log(`✔ README.zh-CN.md`);
console.log(`✔ docs/categories/*.md (${cfg.categories.filter((c) => prompts.some((p) => p.category === c.id)).length} pages)`);
console.log(`  prompts: ${prompts.length} total, ${prompts.filter((p) => p.image).length} with images, grid: ${Math.min(cfg.grid.featured, prompts.filter((p) => p.image).length)} cells`);
warnings.forEach((w) => console.log('  ⚠ ' + w));
