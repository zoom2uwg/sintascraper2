const fs = require('fs');
const path = require('path');
const { parseSessionInfo } = require('./parsers');
const cheerio = require('cheerio');

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Inspect current Puppeteer page DOM for SINTA authentication state.
 */
async function checkPageSession(page) {
  const html = await page.content();
  const currentUrl = page.url();
  const $ = cheerio.load(html);
  return parseSessionInfo($, currentUrl);
}

/**
 * Poll the browser every 2 seconds until login succeeds or timeout expires.
 */
async function waitForAuthenticatedSession(page, timeoutMs = 120000, logDir = null) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const session = await checkPageSession(page).catch(() => ({ isLoggedIn: false }));
    if (session.isLoggedIn) {
      return session;
    }
    await delay(2000);
  }

  if (logDir) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      const shotPath = path.join(logDir, `err_login_timeout_${Date.now()}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      console.error(`[AUTH] Screenshot timeout disimpan ke: ${shotPath}`);
    } catch (_) {
      // ignore screenshot failure
    }
  }
  const err = new Error('LOGIN_TIMEOUT: Batas waktu tunggu autentikasi SINTA terlampaui.');
  err.code = 'LOGIN_TIMEOUT';
  throw err;
}

/**
 * Authenticate to SINTA using `.env` credentials, `--manual-login` interactive mode,
 * or graceful guest fallback when no credentials are configured.
 */
async function authenticateSinta(page, cfg) {
  const loginUrl = `${cfg.sintaBase}/logins`;
  const logDir = path.join(cfg.outputDir, 'logs');

  console.log(`[AUTH] Membuka halaman login: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: cfg.pageTimeoutMs });

  // Check if already logged in from existing browser profile
  const initialSession = await checkPageSession(page);
  if (initialSession.isLoggedIn) {
    console.log(`[AUTH] Sesi sudah aktif sebagai: ${initialSession.accountName || 'Authenticated User'}`);
    return { authenticated: true, session: initialSession };
  }

  if (cfg.manualLogin) {
    console.log(
      '[AUTH] Mode --manual-login aktif. Silakan login di jendela browser Chrome (batas waktu 120 detik)...'
    );
    const session = await waitForAuthenticatedSession(page, cfg.loginTimeoutMs, logDir);
    console.log(`[AUTH] Login manual berhasil! Akun: ${session.accountName || 'Terautentikasi'}`);
    return { authenticated: true, session };
  }

  if (cfg.username && cfg.password) {
    console.log(`[AUTH] Mengisi kredensial login untuk akun: ${cfg.username} (password: ***)`);
    await page
      .waitForSelector('input[name="username"], input[name="email"]', { timeout: 15000 })
      .catch(() => null);

    const userSel = (await page.$('input[name="username"]'))
      ? 'input[name="username"]'
      : 'input[name="email"]';

    if (await page.$(userSel)) {
      // Clear inputs before typing in case of re-login
      await page.$eval(userSel, (el) => {
        el.value = '';
      });
      await page.$eval('input[name="password"]', (el) => {
        el.value = '';
      });

      await page.type(userSel, cfg.username);
      await page.type('input[name="password"]', cfg.password);

      await Promise.all([
        page.click('button[type="submit"], input[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => null),
      ]);
      await delay(2000);

      const postSession = await checkPageSession(page);
      if (postSession.isLoggedIn) {
        console.log(
          `[AUTH] Login berhasil! Akun aktif: ${postSession.accountName || cfg.username}`
        );
        return { authenticated: true, session: postSession };
      }

      console.warn(
        `[AUTH] Form login telah dikirim tetapi indikator logout belum ditemukan (URL: ${page.url()}). Melanjutkan...`
      );
      return { authenticated: false, session: postSession };
    }
  }

  console.log(
    '[AUTH] Kredensial .env kosong — berjalan dalam mode Publik / Guest (beberapa halaman pagination mungkin dibatasi SINTA).'
  );
  return { authenticated: false, session: initialSession };
}

/**
 * Session Guard: checks if a previously authenticated session expired / redirected to `/logins`,
 * and automatically performs 1x re-authentication before retrying the target URL.
 */
async function ensureActiveSession(page, cfg, authState) {
  if (!authState || !authState.authenticated) return false;
  const session = await checkPageSession(page);
  if (session.isLoggedIn) return true;

  console.warn('[AUTH] Sesi terdeteksi berakhir / dialihkan ke login! Mencoba re-login otomatis 1x...');
  const relogin = await authenticateSinta(page, cfg);
  authState.authenticated = relogin.authenticated;
  authState.session = relogin.session;
  return relogin.authenticated;
}

module.exports = {
  checkPageSession,
  waitForAuthenticatedSession,
  authenticateSinta,
  ensureActiveSession,
};
