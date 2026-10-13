// Responsive check: screenshots plus automatic layout audits.
//
//   npm run check:responsive
//
// Needs a running site (default http://localhost:3000; override with BASE_URL).
// Admin pages are included only when E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD are set
// (in the shell or in .env.local). Without them the admin part is skipped.
//
// For every page and width it checks:
//   - horizontal overflow (page wider than the viewport), and names the widest offenders
//   - on phone widths: tap targets under 44px and form controls with text under 16px
// Screenshots are written to ./screenshots/<width>/ for 390px and 1440px.
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Minimal .env.local loader so the script works without extra dependencies.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve("screenshots");
const WIDTHS = [360, 390, 414, 768, 1024, 1440];
const SHOT_WIDTHS = new Set([390, 1440]);
const PHONE_MAX = 414;
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;

const results = [];
let failures = 0;

/** Runs in the page. Returns overflow, small tap targets and small input text. */
function audit(isPhone) {
  const vw = document.documentElement.clientWidth;
  const overflow = Math.max(0, document.documentElement.scrollWidth - vw);

  const visible = (el) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
  };
  const clipped = (el) => {
    // Inside a container that scrolls or clips horizontally: not page overflow.
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") return true;
    }
    return false;
  };
  const describe = (el) => {
    const cls = typeof el.className === "string" ? el.className.split(/\s+/).slice(0, 4).join(".") : "";
    const text = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""} "${text}"`;
  };

  const offenders = [];
  if (overflow > 1) {
    for (const el of document.querySelectorAll("body *")) {
      if (!visible(el) || clipped(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) offenders.push({ el: describe(el), right: Math.round(r.right), width: Math.round(r.width) });
    }
    offenders.sort((a, b) => b.right - a.right);
  }

  const smallTargets = [];
  const smallText = [];
  if (isPhone) {
    const inlineTextLink = (el) =>
      el.tagName === "A" && getComputedStyle(el).display === "inline" && el.closest("p, address, dd, figcaption, h1, h2, h3, li");
    const selector = 'a[href], button, [role="button"], [role="radio"], [role="checkbox"], [role="combobox"], [role="switch"], input:not([type="hidden"]), select, textarea, summary';
    for (const el of document.querySelectorAll(selector)) {
      if (!visible(el) || el.closest('[aria-hidden="true"]') || el.disabled) continue;
      if (el.classList.contains("sr-only") || el.closest(".sr-only") || inlineTextLink(el)) continue;
      const r = el.getBoundingClientRect();
      // A small control is fine when a larger ::before / ::after hit area extends it.
      let h = r.height, w = r.width;
      for (const pseudo of ["::before", "::after"]) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content !== "none" && ps.position === "absolute") {
          const grow = (side) => Math.max(0, -parseFloat(ps[side]) || 0);
          h = Math.max(h, r.height + grow("top") + grow("bottom"));
          w = Math.max(w, r.width + grow("left") + grow("right"));
        }
      }
      if (h < 43.5 || w < 43.5) smallTargets.push({ el: describe(el), size: `${Math.round(w)}x${Math.round(h)}` });
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !/checkbox|radio|file|range/.test(el.type ?? "")) {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) smallText.push({ el: describe(el), fontSize: fs });
      }
    }
  }
  return { viewport: vw, overflow, offenders: offenders.slice(0, 6), smallTargets, smallText };
}

async function check(page, name, width, { shot = true, fullPage = true } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(350); // let entrance animations settle
  const report = await page.evaluate(audit, width <= PHONE_MAX);
  // Uncaught errors (hydration mismatches included) collected since the last check.
  report.errors = [...new Set(page.__errors ?? [])];
  if (page.__errors) page.__errors.length = 0;
  const ok = report.overflow <= 1 && report.errors.length === 0;
  if (!ok) failures += 1;
  results.push({ name, width, ...report });
  const flags = [
    report.overflow > 1 ? `OVERFLOW +${report.overflow}px` : report.errors.length ? "" : "ok",
    report.errors.length ? `${report.errors.length} PAGE ERROR(S)` : "",
    report.smallTargets.length ? `${report.smallTargets.length} small targets` : "",
    report.smallText.length ? `${report.smallText.length} small inputs` : "",
  ].filter(Boolean).join(", ");
  console.log(`${String(width).padStart(5)}  ${name.padEnd(34)} ${flags}`);
  for (const o of report.offenders) console.log(`         -> ${o.el}  right=${o.right} width=${o.width}`);
  for (const e of report.errors) console.log(`         !! ${e}`);
  if (shot && SHOT_WIDTHS.has(width)) {
    const dir = path.join(OUT, String(width));
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage });
  }
}

/** Collects uncaught exceptions, which is how React reports a hydration mismatch. */
function watch(page) {
  page.__errors = [];
  page.on("pageerror", (err) => page.__errors.push(String(err.message ?? err).split("\n")[0].slice(0, 160)));
  return page;
}

// The dev server compiles a route on first visit, which can be slow: wait longer and retry once.
const goto = async (page, url) => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 90000 });
    } catch (err) {
      if (attempt >= 1) throw err;
    }
  }
};

/** Clicks a control until its dialog appears. The first click can land before hydration. */
async function openDialog(page, locator) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await locator.click({ timeout: 10000 }).catch(() => {});
    const shown = await page.getByRole("dialog").first().waitFor({ timeout: 2500 }).then(() => true).catch(() => false);
    if (shown) return true;
  }
  console.log("         !! dialog did not open");
  return false;
}

async function publicPages(context, width, vehicleId) {
  const page = await watch(await context.newPage());
  const phone = width < 768;
  const pages = [
    ["home", "/"],
    ["inventory", "/cars"],
    ["inventory-filtered", "/cars?body=SUV&condition=Used&minPrice=10000&maxPrice=40000&sort=price-asc"],
    ["inventory-empty", "/cars?q=zzzznotacar"],
    ["car-details", `/cars/${vehicleId}`],
    ["book", `/book?vehicle=${vehicleId}`],
    ["book-empty", "/book"],
    ["about", "/about"],
    ["contact", "/contact"],
    ["not-found", "/this-page-does-not-exist"],
    ["admin-login", "/admin/login"],
  ];
  for (const [name, url] of pages) {
    await goto(page, url);
    await check(page, name, width);
  }

  // Interactive states.
  if (phone) {
    await goto(page, "/");
    await openDialog(page, page.getByRole("button", { name: "Open menu" }));
    await check(page, "home-menu-open", width, { fullPage: false });

    await goto(page, "/cars?body=SUV");
    await openDialog(page, page.getByRole("button", { name: /^Filters/ }));
    await check(page, "inventory-filters-open", width, { fullPage: false });
  }
  await goto(page, "/");
  await openDialog(page, page.getByRole("button", { name: "Talk to our AI assistant" }));
  await page.getByText(/Start call|not available right now/).first().waitFor({ timeout: 15000 }).catch(() => {});
  await check(page, "home-voice-panel", width, { fullPage: false });

  if (SHOT_WIDTHS.has(width)) {
    await goto(page, "/");
    await page.waitForTimeout(600);
    const dir = path.join(OUT, String(width));
    await page.screenshot({ path: path.join(dir, "home-hero-viewport.png"), fullPage: false });
    await goto(page, `/cars/${vehicleId}`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(dir, "car-details-viewport.png"), fullPage: false });
  }
  await page.close();
}

async function adminPages(context, width) {
  const page = await watch(await context.newPage());
  for (const [name, url] of [
    ["admin-dashboard", "/admin/dashboard"],
    ["admin-bookings", "/admin/bookings"],
    ["admin-cars", "/admin/cars"],
    ["admin-customers", "/admin/customers"],
    ["admin-settings", "/admin/settings"],
  ]) {
    await goto(page, url);
    await check(page, name, width);
  }
  if (width < 1024) {
    await goto(page, "/admin/dashboard");
    await openDialog(page, page.getByRole("button", { name: "Open admin menu" }));
    await check(page, "admin-menu-open", width, { fullPage: false });
  }
  await goto(page, "/admin/bookings");
  await openDialog(page, page.getByRole("button", { name: "New booking" }));
  await check(page, "admin-booking-dialog", width, { fullPage: false });
  await goto(page, "/admin/cars");
  await openDialog(page, page.getByRole("button", { name: "Add vehicle" }));
  await check(page, "admin-vehicle-dialog", width, { fullPage: false });
  await page.close();
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`No site answering at ${BASE}. Start it first (npm run dev), or set BASE_URL.`);
    process.exit(2);
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  // A real vehicle ID for the details and booking pages.
  const probe = await browser.newPage();
  await goto(probe, "/cars");
  const href = await probe.locator('a[href^="/cars/VEH-"]').first().getAttribute("href").catch(() => null);
  await probe.close();
  const vehicleId = href?.split("/").pop() ?? "VEH-000001";

  // Sign in once and reuse the session for every width.
  let adminState = null;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await watch(await context.newPage());
    await goto(page, "/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    const signedIn = await page.waitForURL(/\/admin\/dashboard/, { timeout: 20000 }).then(() => true).catch(() => false);
    if (signedIn) adminState = await context.storageState();
    else console.log("Admin sign-in failed with the E2E credentials. Admin pages are skipped.");
    await context.close();
  } else {
    console.log("E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set. Admin pages are skipped.\n");
  }

  for (const width of WIDTHS) {
    const options = {
      viewport: { width, height: width < 768 ? 800 : 900 },
      deviceScaleFactor: SHOT_WIDTHS.has(width) && width < 768 ? 2 : 1,
      isMobile: width < 768,
      hasTouch: width < 1024,
      reducedMotion: "reduce",
    };
    const context = await browser.newContext(options);
    await publicPages(context, width, vehicleId);
    await context.close();
    if (adminState) {
      const admin = await browser.newContext({ ...options, storageState: adminState });
      await adminPages(admin, width);
      await admin.close();
    }
  }
  await browser.close();

  writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
  const phoneRows = results.filter((r) => r.width <= PHONE_MAX);
  const targets = new Map();
  for (const r of phoneRows) for (const t of r.smallTargets) targets.set(`${t.el} [${t.size}]`, (targets.get(`${t.el} [${t.size}]`) ?? 0) + 1);
  const texts = new Set(phoneRows.flatMap((r) => r.smallText.map((t) => `${t.el} (${t.fontSize}px)`)));
  console.log(`\nPages checked: ${results.length}. Failures (horizontal overflow or page errors): ${failures}.`);
  console.log(`Distinct tap targets under 44px on phones: ${targets.size}`);
  for (const [k, n] of [...targets].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`   ${String(n).padStart(3)}x  ${k}`);
  console.log(`Form controls with text under 16px on phones: ${texts.size}`);
  for (const t of [...texts].slice(0, 20)) console.log(`   ${t}`);
  console.log(`\nScreenshots and report.json: ${OUT}`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
