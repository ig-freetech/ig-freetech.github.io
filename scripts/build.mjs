// Builds the public profile pages from content/*.json.
// `--private` also builds print-ready resume pages under out/, applying the
// gitignored private/overlay.json (real organization names, contact lines).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const siteUrl = "https://ig-freetech.github.io";
const langs = ["ja", "en"];
const siteName = "Genki Ikeda | CV";

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
  const portraitUrl = `${siteUrl}${content.portrait}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: `${siteUrl}/`,
        name: siteName,
        alternateName: ["Genki Ikeda CV", "池田元気の職務経歴"],
        inLanguage: ["ja", "en"],
      },
      {
        "@type": "Person",
        "@id": `${siteUrl}/#person`,
        name: "Genki Ikeda",
        alternateName: ["池田 元気", "池田元気"],
        url: `${siteUrl}/`,
        image: portraitUrl,
        jobTitle: content.role,
        worksFor: {
          "@type": "Organization",
          name: "株式会社0ai",
          url: "https://0ai-inc.com/",
        },
        sameAs: ["https://github.com/ig-freetech"],
      },
      {
        "@type": "ProfilePage",
        "@id": `${canonical}#profile`,
        url: canonical,
        name: content.meta.title,
        description: content.meta.description,
        inLanguage: content.lang,
        mainEntity: { "@id": `${siteUrl}/#person` },
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
    ],
  };

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
            <div class="job-tech" aria-label="${esc(labels.tech)}">${
              item.techGroups
                ? item.techGroups.map((group) => `
              <div class="job-tech-group">
                <h4 class="job-tech-heading">${esc(group.area)}</h4>
                <p>${group.items.map((tech) => `<span class="tag">${esc(tech)}</span>`).join("")}</p>
              </div>`).join("")
                : `<p>${item.tech.map((tech) => `<span class="tag">${esc(tech)}</span>`).join("")}</p>`
            }</div>
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

  const linkIcons = {
    github: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor"><path d="M10.226 17.284c-2.965-.36-5.054-2.493-5.054-5.256 0-1.123.404-2.336 1.078-3.144-.292-.741-.247-2.314.09-2.965.898-.112 2.111.36 2.83 1.01.853-.269 1.752-.404 2.853-.404 1.1 0 1.999.135 2.807.382.696-.629 1.932-1.1 2.83-.988.315.606.36 2.179.067 2.942.72.854 1.101 2 1.101 3.167 0 2.763-2.089 4.852-5.098 5.234.763.494 1.28 1.572 1.28 2.807v2.336c0 .674.561 1.056 1.235.786 4.066-1.55 7.255-5.615 7.255-10.646C23.5 6.188 18.334 1 11.978 1 5.62 1 .5 6.188.5 12.545c0 4.986 3.167 9.12 7.435 10.669.606.225 1.19-.18 1.19-.786V20.63a2.9 2.9 0 0 1-1.078.224c-1.483 0-2.359-.808-2.987-2.313-.247-.607-.517-.966-1.034-1.033-.27-.023-.359-.135-.359-.27 0-.27.45-.471.898-.471.652 0 1.213.404 1.797 1.235.45.651.921.943 1.483.943.561 0 .92-.202 1.437-.719.382-.381.674-.718.944-.943"/></svg>`,
    website: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>`,
  };

  const links = content.links
    .map(
      (link) =>
        `<li><a href="${esc(link.url)}">${linkIcons[link.icon] ?? ""}<span>${esc(link.label)}</span></a></li>`
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
    <link rel="alternate" hreflang="x-default" href="${siteUrl}/">
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png">
    <meta name="robots" content="index,follow,max-image-preview:large">
    <meta name="author" content="Genki Ikeda">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="${esc(siteName)}">
    <meta property="og:title" content="${esc(content.meta.title)}">
    <meta property="og:description" content="${esc(content.meta.description)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:image" content="${esc(portraitUrl)}">
    <meta property="og:image:width" content="720">
    <meta property="og:image:height" content="960">
    <meta property="og:image:alt" content="${esc(content.name)}">
    <meta property="og:locale" content="${content.lang === "ja" ? "ja_JP" : "en_US"}">
    <meta property="og:locale:alternate" content="${content.lang === "ja" ? "en_US" : "ja_JP"}">
    <meta name="twitter:card" content="summary">
    <meta name="twitter:image" content="${esc(portraitUrl)}">
    <script type="application/ld+json">${JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>`
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
        <div class="hero-profile">
        <div class="hero-copy">
        <p class="name-sub" lang="${content.lang === "ja" ? "en" : "ja"}">${esc(
    content.nameSub
  )}</p>
        <h1 class="name">${esc(content.name)}</h1>
        <p class="role">${esc(content.role)}</p>
        <ul class="links">${links}</ul>
        <p class="tagline">${text(content.tagline)}</p>${
    contact ? `\n        <ul class="contact">${contact}</ul>` : ""
  }
        </div>
        ${content.portrait ? `<img class="hero-portrait" src="${esc(isSite ? content.portrait : `..${content.portrait}`)}" alt="${esc(content.name)}" width="720" height="960" fetchpriority="high" decoding="async">` : ""}
        </div>
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

write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`);
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${["/", "/en/"].map((path) => `  <url>
    <loc>${siteUrl}${path}</loc>
    <xhtml:link rel="alternate" hreflang="ja" href="${siteUrl}/" />
    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}/en/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/" />
  </url>`).join("\n")}
</urlset>
`);
