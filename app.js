/* ============================================================
   CyberGuard AI — app.js
   All analysis runs locally in the browser.
   No passwords or messages are ever stored or transmitted.
   No URLs are visited or fetched automatically.
   ============================================================ */

'use strict';

// ─── Input error helpers ──────────────────────────────────────────────────────

function showInputError(inputEl, message) {
  var existing = inputEl.parentElement.querySelector('.input-error');
  if (existing) existing.remove();
  var err = document.createElement('p');
  err.className = 'input-error';
  err.textContent = message;
  inputEl.parentElement.insertBefore(err, inputEl.nextSibling);
  inputEl.classList.add('input-error-border');
  inputEl.focus();
  setTimeout(function () {
    if (err.parentElement) err.remove();
    inputEl.classList.remove('input-error-border');
  }, 4000);
}

function clearInputError(inputEl) {
  var existing = inputEl.parentElement.querySelector('.input-error');
  if (existing) existing.remove();
  inputEl.classList.remove('input-error-border');
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function initNavigation() {
  var navLinks   = document.querySelectorAll('.nav-link');
  var sections   = document.querySelectorAll('.section');
  var sidebar    = document.getElementById('sidebar');
  var menuToggle = document.getElementById('menuToggle');

  var overlay = document.createElement('div');
  overlay.className = 'overlay';
  document.body.appendChild(overlay);

  function showSection(id) {
    sections.forEach(function (s) { s.classList.remove('active'); });
    navLinks.forEach(function (l) { l.classList.remove('active'); });
    var target = document.getElementById(id);
    if (target) target.classList.add('active');
    var link = document.querySelector('.nav-link[data-section="' + id + '"]');
    if (link) link.classList.add('active');
    var mc = document.getElementById('mainContent');
    if (mc) mc.scrollTo(0, 0);
  }

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      showSection(link.dataset.section);
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  });

  document.querySelectorAll('[data-goto]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showSection(btn.dataset.goto);
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  });

  menuToggle.addEventListener('click', function () {
    var isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
  });

  overlay.addEventListener('click', function () {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// MESSAGE ANALYZER ENGINE
// Multi-signal, context-aware analysis.
// All logic is client-side. No network requests are made.
// ═════════════════════════════════════════════════════════════════════════════

// ── Known brands → official domain map ───────────────────────────────────────

var KNOWN_BRANDS = [
  { names: ['sbi', 'state bank', 'state bank of india'], domain: 'sbi.co.in',        display: 'SBI (State Bank of India)' },
  { names: ['hdfc', 'hdfc bank'],                        domain: 'hdfcbank.com',      display: 'HDFC Bank' },
  { names: ['icici', 'icici bank'],                      domain: 'icicibank.com',     display: 'ICICI Bank' },
  { names: ['axis bank', 'axis'],                        domain: 'axisbank.com',      display: 'Axis Bank' },
  { names: ['kotak', 'kotak mahindra'],                  domain: 'kotak.com',         display: 'Kotak Bank' },
  { names: ['paytm'],                                    domain: 'paytm.com',         display: 'Paytm' },
  { names: ['phonepe', 'phone pe'],                      domain: 'phonepe.com',       display: 'PhonePe' },
  { names: ['amazon'],                                   domain: 'amazon.com',        display: 'Amazon' },
  { names: ['flipkart'],                                 domain: 'flipkart.com',      display: 'Flipkart' },
  { names: ['paypal'],                                   domain: 'paypal.com',        display: 'PayPal' },
  { names: ['google', 'gmail'],                          domain: 'google.com',        display: 'Google' },
  { names: ['microsoft', 'outlook', 'hotmail'],          domain: 'microsoft.com',     display: 'Microsoft' },
  { names: ['apple', 'icloud', 'itunes'],                domain: 'apple.com',         display: 'Apple' },
  { names: ['netflix'],                                  domain: 'netflix.com',       display: 'Netflix' },
  { names: ['facebook', 'meta'],                         domain: 'facebook.com',      display: 'Facebook/Meta' },
  { names: ['whatsapp'],                                 domain: 'whatsapp.com',      display: 'WhatsApp' },
  { names: ['instagram'],                                domain: 'instagram.com',     display: 'Instagram' },
  { names: ['twitter', 'x.com'],                         domain: 'twitter.com',       display: 'Twitter/X' },
  { names: ['linkedin'],                                 domain: 'linkedin.com',      display: 'LinkedIn' },
  { names: ['irs', 'internal revenue'],                  domain: 'irs.gov',           display: 'IRS (US Tax Authority)' },
  { names: ['hmrc', 'inland revenue'],                   domain: 'hmrc.gov.uk',       display: 'HMRC (UK Tax Authority)' },
  { names: ['income tax', 'income tax department'],      domain: 'incometax.gov.in',  display: 'Income Tax Dept (India)' },
  { names: ['rbi', 'reserve bank'],                      domain: 'rbi.org.in',        display: 'Reserve Bank of India' },
  { names: ['dhl'],                                      domain: 'dhl.com',           display: 'DHL' },
  { names: ['fedex'],                                    domain: 'fedex.com',         display: 'FedEx' },
  { names: ['ups'],                                      domain: 'ups.com',           display: 'UPS' },
  { names: ['uidai', 'aadhaar', 'aadhar'],               domain: 'uidai.gov.in',      display: 'UIDAI / Aadhaar' },
];

var URL_SHORTENERS = [
  'bit.ly','goo.gl','tinyurl.com','t.co','ow.ly','rb.gy','cutt.ly',
  'is.gd','tiny.cc','buff.ly','surl.li','clck.ru','tr.im','v.gd',
  'shorturl.at','short.io','bl.ink','rebrand.ly','s.id','mcaf.ee'
];

// ── URL extraction ─────────────────────────────────────────────────────────────

function extractURLs(text) {
  var urls = [];
  var re = /https?:\/\/[^\s<>"')\]]+/gi;
  var m;
  while ((m = re.exec(text)) !== null) {
    urls.push(m[0].replace(/[.,;:!?)]+$/, ''));
  }
  var bare = /(?:^|[\s(])www\.[^\s<>"')\]]+/gi;
  while ((m = bare.exec(text)) !== null) {
    var b = m[0].trim();
    if (urls.indexOf('http://' + b) === -1) urls.push('http://' + b);
  }
  return urls;
}

// ── URL parsing (pure string, zero network) ────────────────────────────────────

function parseURL(rawUrl) {
  var r = {
    raw: rawUrl, domain: '', subdomain: '', tld: '', path: '', query: '',
    isIP: false, isHTTPS: false, isShortener: false,
    suspicious: []   // array of {text, weight} objects
  };
  try {
    var url = rawUrl.trim();
    r.isHTTPS = /^https:\/\//i.test(url);
    var withoutProto = url.replace(/^https?:\/\//i, '');
    var parts = withoutProto.split('/');
    var host = parts[0].toLowerCase().split('?')[0].split('#')[0];
    r.path  = parts.slice(1).join('/');
    r.query = url.indexOf('?') !== -1 ? url.split('?').slice(1).join('?') : '';
    r.domain = host;

    // IP address link
    if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) {
      r.isIP = true;
      r.suspicious.push({ text: 'URL uses a raw IP address instead of a domain name. Legitimate websites always use domain names for user-facing links.', weight: 35 });
    }

    // URL shortener
    var bareHost = host.replace(/^www\./, '');
    URL_SHORTENERS.forEach(function (s) {
      if (bareHost === s || bareHost.endsWith('.' + s)) {
        r.isShortener = true;
        r.suspicious.push({ text: 'URL uses a link shortener (' + bareHost + '). The real destination is hidden and cannot be verified from this message.', weight: 28 });
      }
    });

    // Subdomain analysis
    var hostParts = bareHost.split('.');
    if (hostParts.length > 2) {
      r.subdomain = hostParts.slice(0, hostParts.length - 2).join('.');
      r.tld = hostParts.slice(-2).join('.');
      if (/\b(secure|login|verify|account|update|confirm|banking|support|service|alert|signin|auth|validation|verification)\b/i.test(r.subdomain)) {
        r.suspicious.push({ text: 'The subdomain contains trust-signal keywords such as "secure", "verify", or "login". This is a common technique used to make a fake URL look legitimate — the real domain is what follows the last dot.', weight: 18 });
      }
    } else {
      r.tld = bareHost;
    }

    // Sensitive action keywords in path
    if (/\/(login|verify|update|confirm|secure|account|banking|otp|auth|signin|reset|password|credential|validation|verification)/i.test('/' + r.path)) {
      r.suspicious.push({ text: 'The URL path contains sensitive action keywords (e.g. /login, /verify, /otp). Phishing pages commonly use these to appear legitimate.', weight: 14 });
    }

    // Lookalike / homograph characters in host
    var lookalike = /(\bl[i1]nked[i1]n\b|\bpaypa[l1]\b|\bamaz[o0]n\b|\bg[o0]{2}gle\b|\bm[i1]cr[o0]s[o0]ft\b|\bapp[l1]e\b|\bnetfl[i1]x\b|\bfaceb[o0]{2}k\b|\b[i1]nstagram\b)/i;
    if (lookalike.test(host)) {
      r.suspicious.push({ text: 'The domain contains lookalike characters (e.g. the number "0" replacing the letter "o") to impersonate a trusted brand.', weight: 42 });
    }

    // HTTP only (not HTTPS) — note: HTTPS is not a safety guarantee, but plain HTTP is a risk
    if (!r.isIP && !r.isShortener && !r.isHTTPS) {
      r.suspicious.push({ text: 'The link uses plain HTTP (not HTTPS). Your connection would not be encrypted. Note: HTTPS alone does not guarantee a site is safe, but plain HTTP is a stronger warning sign.', weight: 15 });
    }

    // Excessive hyphens in the first domain segment
    var firstSegment = host.split('.')[0];
    var hyphenCount = (firstSegment.match(/-/g) || []).length;
    if (hyphenCount >= 2) {
      r.suspicious.push({ text: 'The domain name contains multiple hyphens (e.g. "bank-login-secure.com"). This pattern is frequently used in phishing domains to include brand-like words while avoiding the real domain.', weight: 16 });
    }

    // Suspicious TLD
    if (/\.(xyz|top|tk|ml|ga|cf|gq|pw|cc|click|loan|work|party|review|win|date|bid|racing|webcam|science|faith|download|icu|vip|monster)$/i.test(host)) {
      r.suspicious.push({ text: 'The domain uses a TLD (e.g. .xyz, .tk, .top) that is disproportionately associated with spam and phishing sites.', weight: 14 });
    }

    // Unusually long domain
    if (host.length > 50) {
      r.suspicious.push({ text: 'The domain name is unusually long. Phishing URLs are often long to obscure the real destination.', weight: 12 });
    }

  } catch (e) {
    r.suspicious.push({ text: 'This URL could not be fully parsed for analysis.', weight: 0 });
  }
  return r;
}

// ── URL analysis orchestrator ──────────────────────────────────────────────────

function analyzeURLsInMessage(text) {
  var urls = extractURLs(text);
  if (urls.length === 0) return { score: 0, urlResults: [] };

  var topScore = 0;
  var urlResults = urls.map(function (u) {
    var pu = parseURL(u);
    var s = 0;
    pu.suspicious.forEach(function (item) { s += item.weight; });
    if (pu.isHTTPS) s = Math.max(s - 5, s); // HTTPS is not a positive bonus — it's table stakes
    s = Math.min(s, 100);
    topScore = Math.max(topScore, s);
    return { raw: u, parsed: pu, score: s };
  });
  return { score: topScore, urlResults: urlResults };
}

// ── Brand / domain mismatch ────────────────────────────────────────────────────

function detectBrandMismatch(text, parsedURLs) {
  var results = [];
  var lower = text.toLowerCase();
  KNOWN_BRANDS.forEach(function (brand) {
    var mentioned = brand.names.some(function (n) { return lower.indexOf(n) !== -1; });
    if (!mentioned) return;
    parsedURLs.forEach(function (pu) {
      if (!pu.domain) return;
      var dh = pu.domain.replace(/^www\./, '');
      var officialMatch = dh === brand.domain || dh.endsWith('.' + brand.domain);
      if (!officialMatch) {
        var brandInURL = brand.names.some(function (n) {
          return new RegExp(n.replace(/\s+/g, '[-.]?'), 'i').test(dh);
        });
        results.push({ brand: brand.display, officialDomain: brand.domain, claimedDomain: pu.domain, brandInURL: brandInURL });
      }
    });
  });
  var seen = {};
  return results.filter(function (r) {
    var k = r.brand + '|' + r.claimedDomain;
    if (seen[k]) return false;
    seen[k] = true;
    return true;
  });
}

// ── Social Engineering detector ────────────────────────────────────────────────
// Detects contextual manipulation signals, NOT just keywords.
// Each signal has a label, type (for explanation logic), and weight (0-100 scale contribution).

function detectSocialEngineering(text) {
  var score = 0;
  var findings = [];

  var SIGNALS = [
    // ── URGENCY / DEADLINE ──────────────────────────────────────────────────
    // Matches time-limited pressure even when phrased politely
    {
      type: 'urgency',
      label: 'Time-limited pressure — creates urgency to prevent careful thought',
      pattern: /\b(within\s+\d+\s*(hour|hr|minute|min|day|hr)s?|in\s+the\s+next\s+\d+\s*(hour|hr|minute|min|day)s?|by\s+(today|tomorrow|midnight|end\s+of\s+day)|expires?\s+(in|within|today|soon|shortly)|act\s+(now|immediately|fast|quickly)|respond\s+(now|immediately|asap|urgently)|limited\s+time|time\s+(is\s+)?(running\s+out|sensitive|critical)|deadline\s+(is\s+)?(today|tomorrow|tonight|this\s+week)|must\s+(act|respond|verify|complete)\s+(now|immediately|today|within)|please\s+(respond|verify|complete|update).{0,20}(immediately|now|today|urgently|soon|within\s+\d+))\b/i,
      weight: 22
    },
    // ── CONSEQUENCE / THREAT ───────────────────────────────────────────────
    // Threatens negative outcome — account loss, restriction, suspension
    {
      type: 'consequence',
      label: 'Negative consequence threat — warns of account loss, restriction, or suspension',
      pattern: /\b(to\s+avoid\s+(temporary|permanent)?\s*(restriction|suspension|block|closure|deactivation|termination|penalty|action|disruption)|or\s+(your|the)\s+account\s+(will|may|could|might)\s+(be\s+)?(suspended?|blocked?|closed?|terminated?|frozen?|locked?|restricted?|deactivated?)|account\s+(will|may|could)\s+(be\s+)?(suspended?|closed?|restricted?|blocked?|terminated?|deactivated?)|prevent\s+(account\s+)?(suspension|restriction|closure|termination|block)|avoid\s+(account\s+)?(loss|suspension|restriction|block|closure|penalty))\b/i,
      weight: 24
    },
    // ── ACCOUNT SUSPENSION / COMPROMISE (stated fact) ─────────────────────
    {
      type: 'accountThreat',
      label: 'Account suspension or compromise claim — a classic phishing pressure tactic',
      pattern: /\b(your\s+account\s+(has\s+been|is|was|will\s+be)\s*(suspended?|blocked?|restricted?|closed?|terminated?|frozen?|locked?|compromised?|hacked?|deactivated?|flagged?|limited?)|account\s+(has\s+been\s+)?(suspended?|restricted?|blocked?|frozen?|locked?|compromised?|flagged?))\b/i,
      weight: 28
    },
    // ── VERIFICATION / SECURITY CHECK REQUEST ──────────────────────────────
    // Matches "routine security verification", "account review", "validate your account" etc.
    // This is the pattern the test message triggers on.
    {
      type: 'verificationRequest',
      label: 'Account or security verification request — commonly used in phishing to harvest credentials',
      pattern: /\b(security\s+(verification|check|review|update|validation|confirmation)|account\s+(verification|review|validation|confirmation|update|check)|verify\s+(your\s+)?(account|identity|details?|information|email|phone|access)|please\s+(verify|review|validate|confirm|update|complete).{0,30}(account|details?|information|identity|access|security)|complete\s+(the\s+)?(verification|validation|review|update|security)\s+(process|check|step)|review\s+(your\s+)?account)\b/i,
      weight: 20
    },
    // ── AUTHORITY IMPERSONATION ────────────────────────────────────────────
    {
      type: 'authority',
      label: 'Authority claim — message presents itself as coming from a trusted institution',
      pattern: /\b(on\s+behalf\s+of|this\s+is\s+(your\s+bank|the\s+bank|amazon|google|microsoft|apple|rbi|sbi|hdfc|icici|irs|hmrc|police|government|uidai)|from\s+(the\s+)?(team\s+at|department\s+of|office\s+of)|official\s+(notice|communication|alert|message|team|notification)|as\s+per\s+(rbi|government|bank|company)\s+(guidelines?|rules?|policy|regulations?)|our\s+(records?|system|database|security\s+team)\s+(show|indicate|detect|flag|found?|identified?))\b/i,
      weight: 16
    },
    // ── REWARD / PRIZE MANIPULATION ───────────────────────────────────────
    {
      type: 'reward',
      label: 'Reward manipulation — uses a prize or cash offer to exploit greed',
      pattern: /\b(congratulations?.{0,30}(win|won|selected|prize|reward|chosen|eligible)|you\s+(have\s+)?(won|win|been\s+selected|been\s+chosen|are\s+eligible)|claim\s+(your|this)\s+(prize|reward|gift|cash|money)|lucky\s+(winner|draw|selected)|prize\s+(money|amount|of)\s*[\u20b9$\d]|gift\s+(card|voucher)\s+(worth|of)\s*[\u20b9$\d]|free\s+(iphone|laptop|cash|gift|reward))\b/i,
      weight: 24
    },
    // ── SECRECY DEMAND ─────────────────────────────────────────────────────
    {
      type: 'secrecy',
      label: 'Secrecy demand — asks you not to tell anyone, a major fraud red flag',
      pattern: /\b(do\s+not\s+(tell|share|inform|show|mention|discuss|forward)\s+(anyone|anybody|others?)?|don.t\s+(tell|share|inform|show|mention|discuss|forward)|keep\s+(this\s+)?(secret|between\s+us|confidential|private|to\s+yourself)|never\s+(share|mention|tell)\s+(this|the\s+code|the\s+otp))\b/i,
      weight: 32
    },
    // ── CLICK / ACTION REQUEST ─────────────────────────────────────────────
    {
      type: 'cta',
      label: 'Action request — directs you to click a link or take an immediate step',
      pattern: /\b(click\s+(the\s+)?(link|button|here|below)|tap\s+(here|now|to\s+(verify|confirm|update|claim))|visit\s+(this|the)\s+(link|url|website|page)|go\s+to\s+(this|the|our)\s+(link|website|page)|open\s+(the\s+)?(link|attachment|file)|follow\s+(the\s+)?(link|url|instructions)|complete\s+(the\s+process|verification)\s+(here|at|using\s+the\s+link|at\s+this|below))\b/i,
      weight: 14
    },
    // ── EMOTIONAL MANIPULATION ─────────────────────────────────────────────
    {
      type: 'emotional',
      label: 'Emotional manipulation — uses personal distress or sympathy to pressure action',
      pattern: /\b(stranded|emergency\s+(funds?|money|help|transfer)|i\s+(desperately|urgently|really)\s+need\s+your\s+(help|money|assistance)|please\s+help\s+(me|us)\s+(urgently|immediately|now|asap)|your\s+(family|child|loved\s+ones?|mother|father).{0,30}(at\s+risk|need|sick|urgent))\b/i,
      weight: 24
    },
    // ── BYPASS NORMAL CHANNELS ─────────────────────────────────────────────
    {
      type: 'bypass',
      label: 'Bypass request — asks you to skip official processes or channels',
      pattern: /\b(do\s+not\s+(contact|call|use)\s+(the\s+)?(bank|official|helpline|customer\s+care|support)|avoid\s+(official|bank|government)\s+(channels?|contact|process)|this\s+is\s+a\s+one.time\s+(exception|offer|process))\b/i,
      weight: 26
    },
  ];

  SIGNALS.forEach(function (sig) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      findings.push({ label: sig.label, type: sig.type, weight: sig.weight });
    }
  });

  return { score: Math.min(score, 100), findings: findings };
}

// ── Credential theft detector ──────────────────────────────────────────────────

function detectCredentialTheft(text) {
  var score = 0;
  var findings = [];

  var SIGNALS = [
    { label: 'OTP / one-time verification code request',
      pattern: /\b(otp|one[\s-]?time[\s-]?(password|pin|code|passcode)|verification\s+code|auth(entication)?\s+code|2fa\s+code|sms\s+code|mobile\s+(code|otp|pin))\b/i,
      weight: 40 },
    { label: 'Password or login credentials request',
      pattern: /\b(your\s+password|enter\s+(your\s+)?password|provide\s+(your\s+)?password|password\s+(is|required|needed|expired?)|passcode|pin\s+(number)?|login\s+(id|credentials?|details?)|username\s+and\s+password)\b/i,
      weight: 36 },
    { label: 'Bank card details request (card number, CVV, expiry)',
      pattern: /\b(card\s+number|cvv|cvc|card\s+expiry|expir(y|ation)\s+date|credit\s+card\s+(number|details?)|debit\s+card\s+(number|details?))\b/i,
      weight: 40 },
    { label: 'Bank account or net banking credentials request',
      pattern: /\b(bank\s+account\s+number|account\s+number|ifsc(\s+code)?|sort\s+code|routing\s+number|net\s*banking\s+(id|password|login|credentials?)|internet\s+banking)\b/i,
      weight: 36 },
    { label: 'Identity document information request (Aadhaar, PAN, passport, SSN)',
      pattern: /\b(aadhaar\s*(number|card|id)?|aadhar|pan\s+(card|number)|passport\s+number|driving\s+licen[sc]e\s+number|social\s+security\s+(number|no\.?)|ssn\b|national\s+id)\b/i,
      weight: 30 },
    { label: 'KYC verification request — commonly used in financial scams',
      pattern: /\b(kyc\s*(update|verification?|process|pending|required|expired?|complete|incomplete)|know\s+your\s+customer|update\s+(your\s+)?kyc|kyc\s+not\s+(done|complete|verified?))\b/i,
      weight: 32 },
  ];

  SIGNALS.forEach(function (sig) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      findings.push({ label: sig.label, weight: sig.weight });
    }
  });

  return { score: Math.min(score, 100), findings: findings };
}

// ── Financial fraud detector ───────────────────────────────────────────────────

function detectFinancialFraud(text) {
  var score = 0;
  var findings = [];

  var SIGNALS = [
    { label: 'Unexpected money transfer or payment request',
      pattern: /\b(send\s+(money|funds?|transfer|payment)|wire\s+transfer|transfer\s+(funds?|money|amount)|pay\s+(now|immediately|urgently)|payment\s+(required|pending|due|overdue|needed)\s*(now|immediately|urgently|today)?|deposit\s+(now|amount|funds?))\b/i,
      weight: 30 },
    { label: 'Fake prize, lottery, or cash reward',
      pattern: /\b(prize\s+(money|of|amount|won)|lottery\s+(win|result|prize)|lucky\s+(winner|draw)|cash\s+(prize|reward|gift)|[\u20b9$\u00a3\u20ac]\s*\d[\d,]*\s*(won|claim|prize|awarded?|reward)|jackpot|gift\s+(of\s+)?[\u20b9$\u00a3\u20ac]?\d+)\b/i,
      weight: 26 },
    { label: 'Suspicious refund or cashback offer',
      pattern: /\b(refund\s+(of|amount|pending|approved?|credited?|process)|cashback\s+(pending|claim|credited?|process)|reimbursement\s+(pending|approved?|click|link)|your\s+refund\s+(is|has\s+been|will\s+be)\s+(ready|processed?|approved?))\b/i,
      weight: 22 },
    { label: 'Fake bank security or account update scam',
      pattern: /\b(bank\s+(security|verification?|update|alert|notice|confirmation)|verify\s+(your\s+)?(bank\s+)?account|re.?verify|reactivat(e|ion)|update\s+(your\s+)?(bank\s+|payment\s+)?(details?|information|records?))\b/i,
      weight: 24 },
    { label: 'Investment scheme or guaranteed-return offer',
      pattern: /\b(invest(ment)?.{0,10}(return|profit|guaranteed?|scheme)|(\d+\s*%\s*)(guaranteed?\s+)?returns?|double\s+your\s+(money|investment)|risk.?free\s+investment|high\s+(yield|return)\s+investment|get\s+rich\s+quick)\b/i,
      weight: 28 },
  ];

  SIGNALS.forEach(function (sig) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      findings.push({ label: sig.label, weight: sig.weight });
    }
  });

  return { score: Math.min(score, 100), findings: findings };
}

// ── Main analysis function ─────────────────────────────────────────────────────

function analyzeMessage(text) {
  if (!text || text.trim().length < 5) return null;

  var se  = detectSocialEngineering(text);
  var cr  = detectCredentialTheft(text);
  var fin = detectFinancialFraud(text);
  var url = analyzeURLsInMessage(text);

  var parsedURLs = url.urlResults.map(function (r) { return r.parsed; });
  var brands     = detectBrandMismatch(text, parsedURLs);

  // Brand score: mention in text alone = 12; URL mismatch = 28; brand in URL = +20
  var brandScore = 0;
  if (brands.length > 0) {
    brandScore = url.urlResults.length > 0 ? 28 : 12;
    if (brands.some(function (m) { return m.brandInURL; })) brandScore += 20;
  }

  // ── Weighted composite raw score ────────────────────────────────────────────
  // Weights: SE 32%, CR 28%, FIN 20%, URL 20% + brand additive
  var raw = (se.score  * 0.32)
          + (cr.score  * 0.28)
          + (fin.score * 0.20)
          + (url.score * 0.20)
          + brandScore;

  // ── Escalation gates ─────────────────────────────────────────────────────────
  // These ensure the final score reflects real-world risk combinations
  // and prevents obvious under-scoring.

  // G1: Any OTP/password request → at least SUSPICIOUS
  if (cr.score >= 36) raw = Math.max(raw, 42);

  // G2: Credential request + secrecy → HIGH RISK minimum
  var hasSecrecy = se.findings.some(function (f) { return f.type === 'secrecy'; });
  if (cr.score >= 60 && hasSecrecy) raw = Math.max(raw, 65);

  // G3: Financial reward + urgency + URL → HIGH RISK minimum
  var hasReward  = se.findings.some(function (f) { return f.type === 'reward'; });
  var hasUrgency = se.findings.some(function (f) { return f.type === 'urgency'; });
  if (hasReward && hasUrgency && url.urlResults.length > 0) raw = Math.max(raw, 62);

  // G4: Financial fraud signal + any social engineering → at least SUSPICIOUS
  if (fin.score >= 22 && se.score > 0) raw = Math.max(raw, 42);

  // G5: Verification request + URL with suspicious characteristics → SUSPICIOUS
  //     This is the fix for the test case:
  //     "account requires a routine security verification... within 24 hours...
  //      avoid temporary restrictions... https://secure-account-verification.example.com"
  var hasVerifRequest  = se.findings.some(function (f) { return f.type === 'verificationRequest'; });
  var hasConsequence   = se.findings.some(function (f) { return f.type === 'consequence'; });
  var urlHasSuspicious = url.urlResults.some(function (r) { return r.parsed.suspicious.length > 0; });
  if (hasVerifRequest && url.urlResults.length > 0) raw = Math.max(raw, 42);
  if (hasVerifRequest && hasConsequence && url.urlResults.length > 0) raw = Math.max(raw, 55);
  if (hasVerifRequest && hasConsequence && urlHasSuspicious) raw = Math.max(raw, 62);

  // G6: Multiple independent SE signals + URL → SUSPICIOUS minimum
  if (se.findings.length >= 2 && url.urlResults.length > 0) raw = Math.max(raw, 42);
  if (se.findings.length >= 3 && urlHasSuspicious) raw = Math.max(raw, 55);

  // G7: Credential theft + financial fraud + URL → HIGH RISK minimum
  // Covers: "send your OTP to claim a reward" + link shortener = classic scam
  if (cr.score >= 36 && fin.score >= 22 && url.urlResults.length > 0) raw = Math.max(raw, 62);

  // G8: Credential theft + reward manipulation → HIGH RISK minimum
  // Covers: OTP request + prize claim even without a URL
  if (cr.score >= 36 && hasReward) raw = Math.max(raw, 62);

  // G9: Account threat stated as fact + credential theft + URL → HIGH RISK minimum
  // Covers: "Your account will be suspended today. Enter your OTP. [link]"
  var hasAccountThreat = se.findings.some(function (f) { return f.type === 'accountThreat'; });
  if (hasAccountThreat && cr.score >= 36 && url.urlResults.length > 0) raw = Math.max(raw, 65);

  var totalScore = Math.min(Math.round(raw), 100);

  // ── 5-tier verdict ──────────────────────────────────────────────────────────
  var tier, verdictText, verdictClass;
  if      (totalScore <= 20) { tier = 'LOW RISK';   verdictText = '\uD83D\uDFE2 LOW RISK';      verdictClass = 'verdict-safe'; }
  else if (totalScore <= 40) { tier = 'MODERATE';   verdictText = '\uD83D\uDFE1 MODERATE RISK'; verdictClass = 'verdict-moderate'; }
  else if (totalScore <= 60) { tier = 'SUSPICIOUS';  verdictText = '\u26A0\uFE0F SUSPICIOUS';    verdictClass = 'verdict-suspicious'; }
  else if (totalScore <= 80) { tier = 'HIGH RISK';  verdictText = '\uD83D\uDD34 HIGH RISK';      verdictClass = 'verdict-highrisk'; }
  else                       { tier = 'CRITICAL';   verdictText = '\uD83D\uDEA8 CRITICAL RISK';  verdictClass = 'verdict-critical'; }

  // ── Signal breakdown (for visual table) ────────────────────────────────────
  var breakdown = [
    { label: 'Social Engineering', score: se.score,
      findings: se.findings.length ? se.findings.map(function (f) { return f.label; }) : ['No social engineering patterns detected.'] },
    { label: 'Credential Request', score: cr.score,
      findings: cr.findings.length ? cr.findings.map(function (f) { return f.label; }) : ['No credential requests detected.'] },
    { label: 'Financial Risk',     score: fin.score,
      findings: fin.findings.length ? fin.findings.map(function (f) { return f.label; }) : ['No financial fraud patterns detected.'] },
    { label: 'URL / Link Risk',    score: url.score,
      findings: url.urlResults.length === 0
        ? ['No URLs detected in this message.']
        : url.urlResults.reduce(function (acc, r) {
            return acc.concat(r.parsed.suspicious.length
              ? r.parsed.suspicious.map(function (s) { return s.text; })
              : ['URL present — no specific structural risks detected.']);
          }, []) },
    { label: 'Brand Impersonation', score: brandScore,
      findings: brands.length
        ? brands.map(function (m) { return 'Message mentions ' + m.brand + ' but links to "' + m.claimedDomain + '" (official domain: ' + m.officialDomain + ').'; })
        : ['No known brand/domain mismatch detected.'] },
  ];

  // ── Risk factor contribution list ────────────────────────────────────────────
  var factors = buildRiskFactors(totalScore, se, cr, fin, url, brandScore, brands);

  // ── Explanation ──────────────────────────────────────────────────────────────
  var explanation = buildExplanation(totalScore, tier, se, cr, fin, url, brands);

  // ── Recommended actions ──────────────────────────────────────────────────────
  var actions = buildActions(totalScore, se, cr, fin, url, brands);

  return {
    totalScore:  totalScore,
    tier:        tier,
    verdictText: verdictText,
    verdictClass: verdictClass,
    breakdown:   breakdown,
    factors:     factors,
    urlResults:  url.urlResults,
    brands:      brands,
    explanation: explanation,
    actions:     actions
  };
}

// ── Risk factor builder ────────────────────────────────────────────────────────

function buildRiskFactors(totalScore, se, cr, fin, url, brandScore, brands) {
  var items = [];

  // Build from detected signals, grouped
  if (se.score > 0) {
    var seTypes = se.findings.map(function (f) { return f.type; });

    if (seTypes.indexOf('verificationRequest') !== -1) {
      var pts = 15;
      if (seTypes.indexOf('consequence') !== -1) pts += 10;
      items.push({ label: 'Account/security verification request', points: pts });
    }
    if (seTypes.indexOf('consequence') !== -1 && seTypes.indexOf('verificationRequest') === -1) {
      items.push({ label: 'Negative consequence or restriction threat', points: 14 });
    }
    if (seTypes.indexOf('urgency') !== -1) {
      items.push({ label: 'Time-limited urgency / deadline pressure', points: 12 });
    }
    if (seTypes.indexOf('accountThreat') !== -1) {
      items.push({ label: 'Account suspension or compromise claim', points: 18 });
    }
    if (seTypes.indexOf('secrecy') !== -1) {
      items.push({ label: 'Secrecy demand', points: 20 });
    }
    if (seTypes.indexOf('reward') !== -1) {
      items.push({ label: 'Prize or reward manipulation', points: 15 });
    }
    if (seTypes.indexOf('authority') !== -1) {
      items.push({ label: 'Authority or organisation impersonation language', points: 10 });
    }
    if (seTypes.indexOf('cta') !== -1) {
      items.push({ label: 'Action request (click link, complete process)', points: 8 });
    }
    if (seTypes.indexOf('bypass') !== -1) {
      items.push({ label: 'Asks to bypass official channels', points: 16 });
    }
    if (seTypes.indexOf('emotional') !== -1) {
      items.push({ label: 'Emotional manipulation', points: 14 });
    }
  }

  if (cr.score > 0) {
    cr.findings.forEach(function (f) {
      items.push({ label: f.label, points: Math.round(f.weight * 0.6) });
    });
  }

  if (fin.score > 0) {
    fin.findings.forEach(function (f) {
      items.push({ label: f.label, points: Math.round(f.weight * 0.55) });
    });
  }

  if (url.score > 0) {
    items.push({ label: 'Suspicious URL characteristics detected', points: Math.round(url.score * 0.3) });
  } else if (url.urlResults.length > 0) {
    items.push({ label: 'External URL present in message', points: 5 });
  }

  if (brandScore > 0) {
    items.push({ label: 'Possible brand/domain mismatch', points: Math.round(brandScore * 0.5) });
  }

  // Deduplicate and cap
  var seen = {};
  items = items.filter(function (item) {
    if (seen[item.label]) return false;
    seen[item.label] = true;
    return item.points > 0;
  });

  return items;
}

// ── Explanation builder ────────────────────────────────────────────────────────

function buildExplanation(score, tier, se, cr, fin, url, brands) {
  if (score <= 20) {
    return 'No major cybersecurity risk indicators were detected in this message. It appears to be a routine communication. As always, if someone asks you to take an unexpected action, verify it independently through official channels before proceeding.';
  }

  var parts = [];
  var seTypes = se.findings.map(function (f) { return f.type; });

  // Verification request + consequence combo (the key test case)
  if (seTypes.indexOf('verificationRequest') !== -1 && seTypes.indexOf('consequence') !== -1) {
    parts.push('This message uses a time-limited account verification request and warns of negative consequences (such as temporary restrictions) if the user does not act promptly. This combination — create urgency, threaten a loss, provide a link — is a hallmark pattern of phishing and social engineering, even when the wording appears polite or routine.');
  } else if (seTypes.indexOf('verificationRequest') !== -1) {
    parts.push('The message requests a security or account verification step, directing you to an external link to complete the process. Unsolicited verification requests asking you to click external links are a common phishing technique.');
  }

  if (seTypes.indexOf('urgency') !== -1 && seTypes.indexOf('verificationRequest') === -1) {
    parts.push('Artificial urgency is used to prevent you from pausing to verify the request through official channels. This time pressure is a deliberate social engineering tactic.');
  }

  if (seTypes.indexOf('accountThreat') !== -1) {
    parts.push('The message claims your account has been suspended or compromised. Criminals use this fear of account loss to trigger immediate, unthinking action.');
  }

  if (seTypes.indexOf('secrecy') !== -1) {
    parts.push('The message explicitly asks you not to tell anyone. No legitimate organisation ever does this — it is a major indicator of fraud.');
  }

  if (seTypes.indexOf('reward') !== -1) {
    parts.push('The message offers a reward, prize, or financial incentive. Unexpected prize notifications almost always lead to scams that steal your details or money during the claiming process.');
  }

  if (seTypes.indexOf('authority') !== -1 || seTypes.indexOf('impersonation') !== -1) {
    parts.push('The message uses authority language, presenting itself as coming from a trusted institution. This technique — called authority impersonation — is designed to make you trust the message without questioning it.');
  }

  if (cr.score >= 36) {
    parts.push('The message requests highly sensitive information such as an OTP, PIN, password, or banking details. No legitimate bank, company, or government body will ever ask for these over a message or call.');
  } else if (cr.score > 0) {
    parts.push('The message appears to request personal or account information. Any such request should be treated with caution until independently verified through official contact details.');
  }

  if (fin.score >= 22) {
    parts.push('The message contains financial fraud indicators such as a fake prize, unexpected refund, or payment demand. These are common tactics in online financial scams.');
  }

  if (url.score >= 30) {
    parts.push('One or more URLs in this message have characteristics associated with phishing — such as a suspicious domain structure, misleading subdomains, or a link shortener that hides the real destination. Note: HTTPS does not guarantee a site is safe.');
  } else if (url.urlResults.length > 0 && url.score > 0) {
    parts.push('A URL was found in this message with some potentially suspicious characteristics. Do not click it without first verifying the sender through official contact information.');
  } else if (url.urlResults.length > 0) {
    parts.push('This message contains an external link. Always verify who sent the message before clicking any link.');
  }

  if (brands.length > 0) {
    var b = brands[0];
    parts.push('The message claims to represent ' + b.brand + ', but the linked domain ("' + b.claimedDomain + '") does not appear to match the official domain (' + b.officialDomain + '). This domain mismatch is a strong indicator of brand impersonation.');
  }

  if (parts.length === 0) {
    parts.push('Multiple low-level risk indicators were found in this message. While no single indicator is definitive, their combination suggests this message should be independently verified before any action is taken.');
  }

  return parts.join(' ');
}

// ── Action builder ────────────────────────────────────────────────────────────

function buildActions(score, se, cr, fin, url, brands) {
  if (score <= 20) {
    return [
      { type: 'neutral', text: 'If the message asks you to do something unusual, verify the request through the official website or app.' },
      { type: 'neutral', text: 'If a link is included, hover over it to see the full URL before clicking.' },
      { type: 'neutral', text: 'When in doubt, contact the sender using a known, verified phone number or email.' }
    ];
  }

  var actions = [];
  var seTypes = se.findings.map(function (f) { return f.type; });

  if (url.urlResults.length > 0) {
    actions.push({ type: 'dont', text: 'Do NOT click any link in this message until you have independently verified the sender.' });
  }
  if (cr.score >= 28) {
    actions.push({ type: 'dont', text: 'Do NOT share your OTP, PIN, password, CVV, card number, or any account details.' });
  }
  if (fin.score >= 22) {
    actions.push({ type: 'dont', text: 'Do NOT transfer money or make any payment in response to this message.' });
  }
  if (score >= 61) {
    actions.push({ type: 'dont', text: 'Do NOT respond to this message.' });
  }
  if (brands.length > 0 || seTypes.indexOf('authority') !== -1 || seTypes.indexOf('verificationRequest') !== -1) {
    actions.push({ type: 'do', text: 'Verify this request by visiting the official website directly (type the URL yourself) or by calling the official helpline. Do not use the contact details provided in this message.' });
  }
  if (score >= 61) {
    actions.push({ type: 'do', text: 'Report this message as phishing or spam to your email or messaging provider.' });
    actions.push({ type: 'do', text: 'If you have already shared any information, contact your bank or service provider immediately using their official helpline.' });
    actions.push({ type: 'do', text: 'Report to your national cybercrime helpline: cybercrime.gov.in (India) | 0300 123 2040 (UK) | IC3.gov (US).' });
  } else if (score >= 41) {
    actions.push({ type: 'do', text: 'Call the organisation directly using the number from their official website — not a number from this message.' });
  }
  if (actions.length < 2) {
    actions.push({ type: 'neutral', text: 'Contact the organisation using official contact details from their verified website or app.' });
  }

  return actions;
}

// ── Result renderer ────────────────────────────────────────────────────────────

function escapeHTML(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function sigLevelClass(score) {
  if (score <= 15) return 'signal-low';
  if (score <= 50) return 'signal-medium';
  if (score <= 75) return 'signal-high';
  return 'signal-critical';
}

function sigLevelLabel(score) {
  if (score <= 15) return '\uD83D\uDFE2 Low';
  if (score <= 50) return '\uD83D\uDFE0 Medium';
  if (score <= 75) return '\uD83D\uDD34 High';
  return '\u26AB Critical';
}

function tierRangeText(tier) {
  var m = {
    'LOW RISK':   '0\u201320: Low Risk',
    'MODERATE':   '21\u201340: Moderate',
    'SUSPICIOUS': '41\u201360: Suspicious',
    'HIGH RISK':  '61\u201380: High Risk',
    'CRITICAL':   '81\u2013100: Critical'
  };
  return m[tier] || '';
}

function renderMessageResult(result) {
  var card = document.getElementById('analyzerResult');

  // ── Score header ─────────────────────────────────────────────────────────
  var headerEl = document.getElementById('analyzerScoreHeader');
  if (headerEl) {
    headerEl.innerHTML =
      '<div class="score-big-num">' + result.totalScore +
        '<span class="score-big-denom">/100</span></div>' +
      '<div>' +
        '<div class="score-tier-label ' + result.verdictClass + '-text">' + result.verdictText + '</div>' +
        '<div class="score-tier-sub">' + tierRangeText(result.tier) + '</div>' +
      '</div>';
  }

  // ── Score bar ─────────────────────────────────────────────────────────────
  var bar = document.getElementById('analyzerScoreBar');
  var barColor = result.totalScore <= 20 ? '#3fb950'
    : result.totalScore <= 40 ? '#c9ab00'
    : result.totalScore <= 60 ? '#f0883e'
    : result.totalScore <= 80 ? '#f85149'
    : '#d73a3a';
  bar.style.width      = result.totalScore + '%';
  bar.style.background = barColor;

  // ── Signal breakdown ──────────────────────────────────────────────────────
  var bdEl = document.getElementById('analyzerSignalBreakdown');
  if (bdEl) {
    bdEl.innerHTML = '';
    result.breakdown.forEach(function (sig) {
      var row = document.createElement('div');
      row.className = 'signal-row';
      row.innerHTML =
        '<span class="signal-name">' + escapeHTML(sig.label) + '</span>' +
        '<span class="signal-level ' + sigLevelClass(sig.score) + '">' + sigLevelLabel(sig.score) + '</span>';
      bdEl.appendChild(row);

      // Show sub-findings only when the signal actually fired
      if (sig.score > 0 && sig.findings.length && !sig.findings[0].startsWith('No ') && !sig.findings[0].startsWith('No URLs')) {
        sig.findings.forEach(function (f) {
          var sub = document.createElement('div');
          sub.className = 'signal-finding';
          sub.textContent = f;
          bdEl.appendChild(sub);
        });
      }
    });
  }

  // ── Risk factors contributing ─────────────────────────────────────────────
  var rfEl = document.getElementById('analyzerRiskFactors');
  if (rfEl) {
    rfEl.innerHTML = '';
    if (result.factors.length === 0) {
      rfEl.innerHTML = '<div class="brand-ok-block">No significant risk factors detected.</div>';
    } else {
      var list = document.createElement('div');
      list.className = 'risk-factors-list';
      result.factors.forEach(function (f) {
        var row = document.createElement('div');
        row.className = 'risk-factor-row';
        row.innerHTML =
          '<span class="rf-label">' + escapeHTML(f.label) + '</span>' +
          '<span class="rf-points positive">+' + f.points + '</span>';
        list.appendChild(row);
      });
      var total = document.createElement('div');
      total.className = 'rf-total';
      total.innerHTML =
        '<span>Combined risk score</span>' +
        '<span style="color:' + barColor + '">' + result.totalScore + ' / 100</span>';
      list.appendChild(total);
      rfEl.appendChild(list);
    }
  }

  // ── URL analysis panel ────────────────────────────────────────────────────
  var urlEl = document.getElementById('analyzerURLPanel');
  if (urlEl) {
    if (result.urlResults.length === 0) {
      urlEl.innerHTML = '<p class="no-url-note">\uD83D\uDD17 No URLs detected in this message.</p>';
    } else {
      urlEl.innerHTML = '';
      result.urlResults.forEach(function (ur) {
        var pu = ur.parsed;
        var riskClass = ur.score <= 15 ? 'url-safe' : ur.score <= 45 ? 'url-warn' : 'url-risk';
        var block = document.createElement('div');
        block.className = 'url-analysis-block';
        block.innerHTML =
          '<div class="url-raw ' + riskClass + '">\uD83D\uDD17 ' +
            escapeHTML(pu.raw.length > 80 ? pu.raw.substring(0, 80) + '\u2026' : pu.raw) +
          '</div>' +
          '<div class="url-meta">' +
            '<span class="url-meta-item"><strong>Domain:</strong> ' + escapeHTML(pu.domain || 'unknown') + '</span>' +
            (pu.isHTTPS
              ? '<span class="url-badge badge-warn">\uD83D\uDD12 HTTPS (encrypted, not a safety guarantee)</span>'
              : '<span class="url-badge badge-risk">\u26A0\uFE0F HTTP only</span>') +
            (pu.isIP        ? '<span class="url-badge badge-risk">IP Address</span>' : '') +
            (pu.isShortener ? '<span class="url-badge badge-risk">Link Shortener</span>' : '') +
          '</div>';

        if (pu.suspicious.length > 0) {
          var ul = document.createElement('ul');
          ul.className = 'url-issues';
          pu.suspicious.forEach(function (s) {
            var li = document.createElement('li');
            li.textContent = s.text || s; // handle both object and string
            ul.appendChild(li);
          });
          block.appendChild(ul);
        }
        urlEl.appendChild(block);
      });
    }
  }

  // ── Brand panel ───────────────────────────────────────────────────────────
  var brandEl = document.getElementById('analyzerBrandPanel');
  if (brandEl) {
    if (result.brands.length === 0) {
      // Determine whether the message mentions any org at all
      brandEl.innerHTML = '<div class="brand-ok-block">No known brand or domain mismatch detected. If no organisation is explicitly named in the message, brand identity cannot be established.</div>';
    } else {
      brandEl.innerHTML = '';
      result.brands.forEach(function (m) {
        var div = document.createElement('div');
        div.className = 'brand-mismatch-block';
        div.innerHTML =
          '<div class="brand-mismatch-title">\u26A0\uFE0F Possible Brand Impersonation</div>' +
          '<table class="brand-table">' +
            '<tr><td class="bt-label">Claimed organisation:</td><td class="bt-value">' + escapeHTML(m.brand) + '</td></tr>' +
            '<tr><td class="bt-label">Official domain:</td><td class="bt-value bt-safe">' + escapeHTML(m.officialDomain) + '</td></tr>' +
            '<tr><td class="bt-label">Domain in this message:</td><td class="bt-value bt-risk">' + escapeHTML(m.claimedDomain) + '</td></tr>' +
          '</table>' +
          '<p class="brand-mismatch-note">The message claims to represent ' + escapeHTML(m.brand) +
          ', but the linked domain does not appear to match the official domain. This is a potential phishing indicator. Verify directly at ' + escapeHTML(m.officialDomain) + '.</p>';
        brandEl.appendChild(div);
      });
    }
  }

  // ── Explanation ────────────────────────────────────────────────────────────
  var explanEl = document.getElementById('analyzerExplanation');
  if (explanEl) explanEl.textContent = result.explanation;

  // ── Actions ────────────────────────────────────────────────────────────────
  var actionsEl = document.getElementById('analyzerActions');
  if (actionsEl) {
    actionsEl.innerHTML = '';
    result.actions.forEach(function (a) {
      var li = document.createElement('li');
      var text = typeof a === 'string' ? a : a.text;
      var type = typeof a === 'string' ? 'neutral' : a.type;
      li.textContent = (type === 'dont' ? '\u274C ' : type === 'do' ? '\u2705 ' : '\u2192 ') + text;
      li.className = 'action-item ' + (type === 'dont' ? 'action-dont' : type === 'do' ? 'action-do' : 'action-neutral');
      actionsEl.appendChild(li);
    });
  }

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Analyzer wiring ────────────────────────────────────────────────────────────

function initMessageAnalyzer() {
  var analyzeBtn = document.getElementById('analyzeBtn');
  var clearBtn   = document.getElementById('clearMsgBtn');
  var msgInput   = document.getElementById('messageInput');
  var resultCard = document.getElementById('analyzerResult');

  analyzeBtn.addEventListener('click', function () {
    clearInputError(msgInput);
    var text = msgInput.value;
    if (!text || !text.trim()) {
      showInputError(msgInput, 'Please paste a message to analyze.');
      return;
    }
    if (text.trim().length < 5) {
      showInputError(msgInput, 'Message is too short. Please paste the full message.');
      return;
    }
    analyzeBtn.textContent = 'Analyzing\u2026';
    analyzeBtn.disabled = true;

    setTimeout(function () {
      var result = analyzeMessage(text);
      renderMessageResult(result);
      analyzeBtn.textContent = '\uD83D\uDD0D Analyze Message';
      analyzeBtn.disabled = false;
    }, 380);
  });

  clearBtn.addEventListener('click', function () {
    msgInput.value = '';
    clearInputError(msgInput);
    resultCard.classList.add('hidden');
    msgInput.focus();
  });

  msgInput.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.key === 'Enter') analyzeBtn.click();
  });

  msgInput.addEventListener('input', function () {
    clearInputError(msgInput);
  });

  document.querySelectorAll('.sample-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      msgInput.value = btn.dataset.sample;
      clearInputError(msgInput);
      msgInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      setTimeout(function () { analyzeBtn.click(); }, 200);
    });
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// PASSWORD ADVISOR
// ═════════════════════════════════════════════════════════════════════════════

var COMMON_PASSWORDS = {
  'password':1,'password1':1,'123456':1,'12345678':1,'123456789':1,'1234567890':1,
  'qwerty':1,'qwertyuiop':1,'abc123':1,'letmein':1,'monkey':1,'iloveyou':1,
  'admin':1,'welcome':1,'login':1,'master':1,'dragon':1,'pass':1,'test':1,
  'user':1,'secret':1,'111111':1,'000000':1,'superman':1,'batman':1,
  'sunshine':1,'princess':1,'football':1,'shadow':1,'michael':1,'jessica':1,
  'charlie':1,'donald':1,'qazwsx':1,'trustno1':1,'passw0rd':1,'p@ssword':1,
  'admin123':1,'root':1,'changeme':1,'1q2w3e4r':1,'qwerty123':1,'hello':1,'hello123':1
};

function checkPassword(pw) {
  var c = {
    length8:   pw.length >= 8,
    length12:  pw.length >= 12,
    uppercase: /[A-Z]/.test(pw),
    lowercase: /[a-z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[^A-Za-z0-9]/.test(pw),
    notCommon: !COMMON_PASSWORDS[pw.toLowerCase()],
    noRepeat:  !/(.)\1{2,}/.test(pw),
    noSeq:     !/(?:01234|12345|23456|34567|45678|56789|67890|abcde|bcdef|qwerty|asdfg|zxcvb)/i.test(pw),
  };
  var score = 0;
  if (c.length8)    score += 10;
  if (c.length12)   score += 15;
  if (c.uppercase)  score += 10;
  if (c.lowercase)  score += 5;
  if (c.number)     score += 10;
  if (c.special)    score += 20;
  if (c.notCommon)  score += 15;
  if (c.noRepeat)   score += 8;
  if (c.noSeq)      score += 7;
  if (pw.length >= 16) score += 8;
  if (pw.length >= 20) score += 4;
  score = Math.min(score, 100);

  var lbl, col, vc;
  if      (score < 25) { lbl = 'Very Weak';  col = '#f85149'; vc = 'verdict-weak'; }
  else if (score < 45) { lbl = 'Weak';       col = '#f85149'; vc = 'verdict-weak'; }
  else if (score < 65) { lbl = 'Moderate';   col = '#d29922'; vc = 'verdict-moderate'; }
  else if (score < 82) { lbl = 'Strong';     col = '#3fb950'; vc = 'verdict-strong'; }
  else                 { lbl = 'Very Strong'; col = '#3fb950'; vc = 'verdict-strong'; }

  var sug = [];
  if (!c.length8)    sug.push('Use at least 8 characters.');
  if (!c.length12)   sug.push('Aim for 12 or more characters.');
  if (pw.length < 16) sug.push('16+ characters makes it much harder to crack.');
  if (!c.uppercase)  sug.push('Add at least one uppercase letter (A-Z).');
  if (!c.lowercase)  sug.push('Add at least one lowercase letter (a-z).');
  if (!c.number)     sug.push('Include at least one number (0-9).');
  if (!c.special)    sug.push('Add special characters like !, @, #, $, %.');
  if (!c.notCommon)  sug.push('This is a very common password. Change it immediately!');
  if (!c.noRepeat)   sug.push('Avoid repeating the same character three or more times.');
  if (!c.noSeq)      sug.push('Avoid sequential patterns like "12345" or "qwerty".');
  if (sug.length === 0) sug.push('Excellent password! Store it in a password manager.');

  return { checks: c, score: score, strengthLabel: lbl, strengthColor: col, verdictClass: vc, suggestions: sug };
}

function renderPasswordResult(r) {
  var verdict  = document.getElementById('passwordVerdict');
  var scoreD   = document.getElementById('pwScoreDisplay');
  var checksEl = document.getElementById('pwChecks');
  var sugEl    = document.getElementById('passwordSuggestions');
  var card     = document.getElementById('passwordResult');

  var emoji = r.score >= 65 ? '\u2705' : r.score >= 45 ? '\u26A0\uFE0F' : '\uD83D\uDEA8';
  verdict.textContent = emoji + ' ' + r.strengthLabel + ' Password';
  verdict.className   = 'result-verdict ' + r.verdictClass;

  if (scoreD) {
    scoreD.textContent = 'Strength Score: ' + r.score + ' / 100';
    scoreD.className   = 'risk-score-label ' + (r.score >= 65 ? 'score-safe' : r.score >= 45 ? 'score-warn' : 'score-risk');
  }

  var ITEMS = [
    { key: 'length8',    label: '8+ characters' },
    { key: 'length12',   label: '12+ characters' },
    { key: 'uppercase',  label: 'Uppercase letters' },
    { key: 'lowercase',  label: 'Lowercase letters' },
    { key: 'number',     label: 'Numbers included' },
    { key: 'special',    label: 'Special characters' },
    { key: 'notCommon',  label: 'Not a common password' },
    { key: 'noRepeat',   label: 'No repeated characters' },
    { key: 'noSeq',      label: 'No sequential patterns' },
  ];
  checksEl.innerHTML = '';
  ITEMS.forEach(function (item) {
    var div = document.createElement('div');
    div.className   = 'pw-check ' + (r.checks[item.key] ? 'pass' : 'fail');
    div.textContent = (r.checks[item.key] ? '\u2713 ' : '\u2717 ') + item.label;
    checksEl.appendChild(div);
  });

  sugEl.innerHTML = '';
  r.suggestions.forEach(function (s) {
    var li = document.createElement('li');
    li.textContent = '\u2192 ' + s;
    li.className   = 'action-item action-neutral';
    sugEl.appendChild(li);
  });

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function initPasswordAdvisor() {
  var pwInput   = document.getElementById('passwordInput');
  var toggleBtn = document.getElementById('togglePw');
  var checkBtn  = document.getElementById('checkPasswordBtn');
  var clearBtn  = document.getElementById('clearPwBtn');
  var fill      = document.getElementById('strengthFill');
  var label     = document.getElementById('strengthLabel');
  var result    = document.getElementById('passwordResult');

  pwInput.addEventListener('input', function () {
    var pw = pwInput.value;
    clearInputError(pwInput);
    if (!pw) {
      fill.style.width = '0%'; fill.style.background = 'var(--surface2)';
      label.textContent = '\u2013'; label.style.color = 'var(--muted)';
      return;
    }
    var r = checkPassword(pw);
    fill.style.width = r.score + '%'; fill.style.background = r.strengthColor;
    label.textContent = r.strengthLabel; label.style.color = r.strengthColor;
  });

  toggleBtn.addEventListener('click', function () {
    var hidden = pwInput.type === 'password';
    pwInput.type = hidden ? 'text' : 'password';
    toggleBtn.textContent = hidden ? '\uD83D\uDE48' : '\uD83D\uDC41';
  });

  checkBtn.addEventListener('click', function () {
    clearInputError(pwInput);
    if (!pwInput.value.trim()) { showInputError(pwInput, 'Please enter a password to check.'); return; }
    renderPasswordResult(checkPassword(pwInput.value));
  });

  clearBtn.addEventListener('click', function () {
    pwInput.value = ''; fill.style.width = '0%'; fill.style.background = 'var(--surface2)';
    label.textContent = '\u2013'; label.style.color = 'var(--muted)';
    clearInputError(pwInput); result.classList.add('hidden'); pwInput.focus();
  });

  pwInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') checkBtn.click(); });
}

// ═════════════════════════════════════════════════════════════════════════════
// CYBER CHATBOT
// ═════════════════════════════════════════════════════════════════════════════

var CHATBOT_KB = [
  { patterns: [/\bphishing\b/i, /what\s+is\s+phishing/i],
    answer: '<strong>\uD83C\uDFA3 What is Phishing?</strong><br><br>Phishing is when criminals send fake messages pretending to be a trusted company, bank, or government body — to steal your personal details.<br><br><strong>Example:</strong> An SMS that looks like it is from your bank: <em>"Your account will be suspended. Click here to verify."</em><br><br><strong>Red flags:</strong><br>\u2192 Unexpected urgency<br>\u2192 Requests for passwords, OTPs, or banking details<br>\u2192 Shortened or suspicious links<br>\u2192 Generic greetings like "Dear Customer"<br><br><strong>Rule:</strong> Legitimate companies will NEVER ask for your password or OTP over a message or call.' },

  { patterns: [/fake\s+website/i, /identify.{0,20}fake/i, /spot.{0,20}fake/i, /how.{0,15}tell.{0,15}(real|fake|legit)/i],
    answer: '<strong>\uD83C\uDF10 How to Identify a Fake Website</strong><br><br>1. <strong>Check the URL carefully</strong> — look for typos like "paypa<em>1</em>.com".<br>2. <strong>Look for HTTPS</strong> — but note HTTPS alone does not guarantee safety.<br>3. <strong>Poor grammar and spelling</strong> are warning signs.<br>4. <strong>Too-good-to-be-true offers</strong> are a red flag.<br>5. <strong>Hover over links</strong> before clicking to see the real destination.<br>6. <strong>Check the domain age</strong> — newly registered domains are suspicious.' },

  { patterns: [/clicked?.{0,20}(suspicious|phishing|bad|malicious|fake)\s+link/i, /accidentally\s+clicked/i, /i\s+clicked.{0,20}link/i],
    answer: '<strong>\uD83D\uDE31 You Clicked a Suspicious Link — Act Fast!</strong><br><br>1. Do NOT enter any information if a page opened — close it immediately.<br>2. Disconnect from Wi-Fi briefly if you think something downloaded.<br>3. Run a malware scan (Windows Defender, Malwarebytes, or your phone antivirus).<br>4. Change your passwords: email first, then banking, then social media.<br>5. Enable 2FA on all important accounts.<br>6. If you entered banking details, call your bank immediately.' },

  { patterns: [/\botp\b/i, /one[\s-]?time.{0,10}(password|pin|code)/i, /share.{0,15}otp/i, /safe.{0,15}otp/i],
    answer: '<strong>\uD83D\uDD10 Is It Safe to Share an OTP?</strong><br><br><strong>NEVER.</strong> Do not share an OTP with anyone — not bank employees, tech support, friends, or government officials.<br><br>An OTP is a secret code sent only to YOU. If someone asks for it, they are committing fraud.<br><br>\u26A0\uFE0F Hang up immediately if anyone asks for your OTP over the phone. Real banks will never ask for it.' },

  { patterns: [/(strong|good|better|secure).{0,20}password/i, /how.{0,20}creat.{0,20}password/i, /password.{0,15}(tips?|advice|help)/i],
    answer: '<strong>\uD83D\uDD11 How to Create a Strong Password</strong><br><br>\u2192 <strong>12-16+ characters</strong><br>\u2192 Uppercase AND lowercase letters<br>\u2192 At least one number (0-9)<br>\u2192 Special characters like !, @, #, $, %<br>\u2192 Not a dictionary word<br>\u2192 Unique for every account<br><br><strong>Passphrase tip:</strong> <em>Horse!Cloud7River#Moon</em> — long, memorable, hard to crack.<br><br>Use a <strong>password manager</strong> like Bitwarden (free) to generate and store strong passwords.' },

  { patterns: [/\b(2fa|two[\s-]?factor|mfa|authenticat(ion|or))\b/i, /what\s+is\s+2fa/i],
    answer: '<strong>\uD83D\uDD10 What is Two-Factor Authentication (2FA)?</strong><br><br>2FA adds a second security layer. Even if someone steals your password, they cannot log in without the second factor.<br><br>1. Enter your password (something you KNOW).<br>2. Provide a code from your phone or app (something you HAVE).<br><br><strong>Types:</strong><br>\u2192 SMS code (convenient but less secure)<br>\u2192 Authenticator app — Google Authenticator, Authy (more secure)<br>\u2192 Hardware key (most secure)<br><br>Enable 2FA everywhere: email, banking, social media.' },

  { patterns: [/social\s+engineer/i, /\bpretexting\b/i, /psychological.{0,20}(trick|manipulation)/i, /what\s+is\s+social/i],
    answer: '<strong>\uD83D\uDD75\uFE0F What is Social Engineering?</strong><br><br>Social engineering uses psychological manipulation — not technology — to trick people into giving up sensitive information.<br><br><strong>Common tactics:</strong><br>\u2192 <strong>Urgency</strong> — "Act in 10 minutes or your account is deleted!"<br>\u2192 <strong>Authority</strong> — "I am calling from your bank."<br>\u2192 <strong>Baiting</strong> — "You have won a prize!"<br>\u2192 <strong>Pretexting</strong> — Creating a fake scenario to gain trust.<br><br><strong>Defence:</strong> Always slow down and verify independently.' },

  { patterns: [/account.{0,15}(hacked|compromised|breached)/i, /think.{0,15}(hacked|compromised)/i, /what.{0,15}(do|should).{0,15}hacked/i],
    answer: '<strong>\uD83D\uDEA8 What to Do If Your Account Was Hacked</strong><br><br>1. Change your password immediately — on the hacked account AND any others using the same password.<br>2. Enable 2FA right now.<br>3. Check your email for unexpected login alerts.<br>4. Visit HaveIBeenPwned.com to check if your email appeared in a breach.<br>5. Warn your contacts if your email was compromised.<br>6. Call your bank if any financial account is involved.' },

  { patterns: [/\b(malware|virus|ransomware|spyware|trojan)\b/i],
    answer: '<strong>\uD83E\uDDA0 What is Malware?</strong><br><br>Malware is malicious software designed to damage or steal from your device.<br><br>\u2192 <strong>Virus</strong> — spreads and damages files<br>\u2192 <strong>Ransomware</strong> — encrypts your files and demands payment<br>\u2192 <strong>Spyware</strong> — secretly watches what you do online<br>\u2192 <strong>Trojan</strong> — disguises itself as a legitimate app<br>\u2192 <strong>Keylogger</strong> — records every keystroke<br><br>Protection: keep software updated, use antivirus, never open unexpected attachments.' },

  { patterns: [/password\s+manager/i, /\bbitwarden\b/i, /\b1password\b/i, /store.{0,15}password/i],
    answer: '<strong>\uD83D\uDDC4\uFE0F What is a Password Manager?</strong><br><br>A password manager stores all your passwords in an encrypted vault. You only need to remember one strong master password.<br><br><strong>Benefits:</strong><br>\u2192 Generates unique passwords for every account<br>\u2192 Auto-fills passwords so you never have to type them<br>\u2192 Alerts you if a saved password has been breached<br><br><strong>Free option:</strong> <strong>Bitwarden</strong> — open source, widely trusted, free.' },
];

var FALLBACK = [
  'Good question. The golden rule for most online threats: slow down, never share passwords or OTPs, and always verify independently before clicking links or providing personal information.',
  'I do not have a specific answer for that. Try asking about: phishing, OTP safety, fake websites, strong passwords, 2FA, malware, social engineering, or what to do after clicking a suspicious link.',
  'When in doubt, do not click it. If you are unsure about a message, verify through the official website or a phone number from the back of your card — not from the message itself.',
];

function getBotResponse(msg) {
  for (var i = 0; i < CHATBOT_KB.length; i++) {
    var entry = CHATBOT_KB[i];
    for (var j = 0; j < entry.patterns.length; j++) {
      if (entry.patterns[j].test(msg)) return entry.answer;
    }
  }
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}

function initChatbot() {
  var msgsEl  = document.getElementById('chatMessages');
  var inputEl = document.getElementById('chatInput');
  var sendBtn = document.getElementById('chatSendBtn');

  function appendMsg(html, role) {
    var div    = document.createElement('div');
    div.className = 'chat-msg ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (role === 'user') bubble.textContent = html;
    else bubble.innerHTML = html;
    div.appendChild(bubble);
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function showTyping() {
    var div = document.createElement('div');
    div.id = 'typingInd'; div.className = 'chat-msg bot';
    var b = document.createElement('div');
    b.className = 'chat-bubble';
    b.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    div.appendChild(b); msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function removeTyping() {
    var el = document.getElementById('typingInd');
    if (el) el.remove();
  }

  function send() {
    var text = inputEl.value.trim();
    if (!text) { inputEl.classList.add('input-error-border'); setTimeout(function () { inputEl.classList.remove('input-error-border'); }, 1200); return; }
    appendMsg(text, 'user');
    inputEl.value = '';
    sendBtn.disabled = true;
    showTyping();
    setTimeout(function () {
      removeTyping();
      appendMsg(getBotResponse(text), 'bot');
      sendBtn.disabled = false;
    }, 600 + Math.random() * 500);
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  document.querySelectorAll('.qq-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { inputEl.value = btn.dataset.q; send(); });
  });
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  initNavigation();
  initMessageAnalyzer();
  initPasswordAdvisor();
  initChatbot();
});
