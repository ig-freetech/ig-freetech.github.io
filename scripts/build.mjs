// Builds the public profile pages from content/*.json.
// `--private` also builds print-ready resume pages under out/, applying the
// gitignored private/overlay.json (real organization names, contact lines).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://ig-freetech.github.io";
const langs = ["ja", "en"];

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));

// Keeps numbers with their units, dates, and short Latin-Japanese phrases on
// one line so that line breaks do not split them.
const nowrap = (match) => `<span class="nowrap">${match}</span>`;
const glueRules = {
  ja: [
    /\d{4}年\d{1,2}(?:〜\d{1,2})?月(?:\d{1,2}日)?/g,
    /約?\d+(?:\.\d+)?万?(?:本|件|倍|回|週間|日間|分の\d+)/g,
    /AI (?:エンジニア|エージェント|アシスタント|アバター|サービス|ワークパートナー)|新 NISA/g,
    /[A-Za-z0-9][A-Za-z0-9.+#-]* [ぁ-ん]+/g,
  ],
  en: [
    /\(\d+ days\)/g,
    /(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g,
  ],
};

function typeset(value, lang) {
  let html = esc(value);
  for (const rule of glueRules[lang] ?? []) {
    html = html
      .split(/(<span class="nowrap">.*?<\/span>)/)
      .map((part) => (part.startsWith("<span") ? part : part.replace(rule, nowrap)))
      .join("");
  }
  return html;
}

function applyOverlay(content, overlay) {
  const local = overlay?.[content.lang] ?? {};
  const orgs = local.organizations ?? {};
  return {
    ...content,
    contact: local.contact ?? [],
    experience: content.experience.map((item) =>
      orgs[item.id] ? { ...item, org: orgs[item.id] } : item
    ),
  };
}

function page(content, { mode }) {
  const { labels } = content;
  const text = (value) => typeset(value, content.lang);
  const isSite = mode === "site";
  const canonical = `${siteUrl}${content.path}`;
  const alternate = `${siteUrl}${content.alternate.path}`;

  const highlights = (content.system.highlights ?? [])
    .map(
      (item) => `
          <li>
            <h3>${esc(item.title)}</h3>
            <p>${text(item.body)}</p>
          </li>`
    )
    .join("");

  const systemLink = content.system.link
    ? `
        <p class="more"><a href="${esc(content.system.link.url)}">${text(
          content.system.link.label
        )}</a></p>`
    : "";

  const stats = content.system.stats
    .map(
      (stat) => `
          <div class="stat">
            <p class="stat-value">${esc(stat.value)}</p>
            <p class="stat-label">${text(stat.label)}</p>
          </div>`
    )
    .join("");

  const steps = content.system.steps
    .map(
      (step) => `
          <li class="step">
            <h3>${esc(step.title)}</h3>
            <p>${text(step.body)}</p>
          </li>`
    )
    .join("");

  const experience = content.experience
    .map(
      (item) => `
        <li class="job">
          <p class="job-period">${esc(item.period)}</p>
          <div class="job-body">
            <h3 class="job-org">${esc(item.org)}</h3>
            <p class="job-position">${text(item.position)}</p>
            <ul class="job-points">${item.points
              .map((point) => `<li>${text(point)}</li>`)
              .join("")}</ul>
            <p class="job-tech"><span class="visually-hidden">${esc(
              labels.tech
            )}: </span>${item.tech
              .map((tech) => `<span class="tag">${esc(tech)}</span>`)
              .join("")}</p>
          </div>
        </li>`
    )
    .join("");

  const skills = content.skills
    .map(
      (group) => `
        <div class="skill-group">
          <h3>${esc(group.area)}</h3>
          <p>${group.items
            .map((item) => `<span class="tag">${esc(item)}</span>`)
            .join("")}</p>
        </div>`
    )
    .join("");

  const links = content.links
    .map(
      (link) =>
        `<li><a href="${esc(link.url)}">${esc(link.label)}</a></li>`
    )
    .join("");

  const contact = (content.contact ?? [])
    .map((line) => `<li>${esc(line)}</li>`)
    .join("");

  const head = isSite
    ? `
    <link rel="canonical" href="${esc(canonical)}">
    <link rel="alternate" hreflang="${esc(content.lang)}" href="${esc(canonical)}">
    <link rel="alternate" hreflang="${esc(content.alternate.lang)}" href="${esc(alternate)}">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${esc(content.meta.title)}">
    <meta property="og:description" content="${esc(content.meta.description)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta name="twitter:card" content="summary">`
    : `
    <meta name="robots" content="noindex">`;

  const cssHref = isSite ? "/assets/style.css" : "../assets/style.css";
  const languageSwitch = isSite
    ? `<a class="lang-switch" href="${esc(content.alternate.path)}" hreflang="${esc(
        content.alternate.lang
      )}" lang="${esc(content.alternate.lang)}">${esc(content.alternate.label)}</a>`
    : "";

  return `<!doctype html>
<html lang="${esc(content.lang)}" class="${isSite ? "site" : "resume"}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(content.meta.title)}</title>
    <meta name="description" content="${esc(content.meta.description)}">${head}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap">
    <link rel="stylesheet" href="${cssHref}">
  </head>
  <body>
    <header class="hero">
      <div class="container">
        <nav class="topbar" aria-label="Language">${languageSwitch}</nav>
        <p class="name-sub" lang="${content.lang === "ja" ? "en" : "ja"}">${esc(
    content.nameSub
  )}</p>
        <h1 class="name">${esc(content.name)}</h1>
        <p class="role">${esc(content.role)}</p>
        <p class="tagline">${text(content.tagline)}</p>${
    contact ? `\n        <ul class="contact">${contact}</ul>` : ""
  }
      </div>
    </header>
    <main class="container">
      <section aria-labelledby="about">
        <h2 id="about">${esc(labels.about)}</h2>
        ${content.about.map((para) => `<p>${text(para)}</p>`).join("\n        ")}
      </section>
      <section aria-labelledby="system">
        <h2 id="system">${esc(labels.system)}</h2>
        <p class="lead">${text(content.system.lead)}</p>
        <ul class="highlights">${highlights}
        </ul>
        <div class="stats">${stats}
        </div>
        <p class="note">${text(content.system.note)}</p>
        <ol class="steps">${steps}
        </ol>${systemLink}
      </section>
      <section aria-labelledby="experience">
        <h2 id="experience">${esc(labels.experience)}</h2>
        <ol class="jobs">${experience}
        </ol>
      </section>
      <section aria-labelledby="skills">
        <h2 id="skills">${esc(labels.skills)}</h2>
        <div class="skills">${skills}
        </div>
      </section>
      <section aria-labelledby="links">
        <h2 id="links">${esc(labels.links)}</h2>
        <ul class="links">${links}</ul>
      </section>
    </main>
    <footer class="container footer">
      <p>&copy; ${new Date().getFullYear()} ${esc(content.name)}</p>
    </footer>
  </body>
</html>
`;
}

function write(path, html) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, html);
  console.log(`wrote ${path}`);
}

const buildPrivate = process.argv.includes("--private");
const overlayPath = join(root, "private/overlay.json");
const overlay = existsSync(overlayPath)
  ? JSON.parse(readFileSync(overlayPath, "utf8"))
  : null;

for (const lang of langs) {
  const content = readJson(`content/${lang}.json`);
  write(lang === "ja" ? "index.html" : "en/index.html", page(content, { mode: "site" }));
  if (buildPrivate) {
    if (!overlay) throw new Error("private/overlay.json is required for --private");
    write(`out/resume-${lang}.html`, page(applyOverlay(content, overlay), { mode: "resume" }));
  }
}
