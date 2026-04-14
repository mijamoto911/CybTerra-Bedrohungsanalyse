/* ============================================================
   CybTerra · script.js
   Bedrohungsanalyse + Risikorechner + KI-Chatbot
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     KONFIGURATION
     ============================================================ */

  /* ⚠️ API-Key hier eintragen — für Produktion: server-seitig proxyen!
     Schlüssel erhalten Sie unter: https://console.anthropic.com       */
  const ANTHROPIC_API_KEY = 'YOUR_ANTHROPIC_API_KEY';

  /* Gültige Lizenzschlüssel (Demo).
     In Produktion: Verifizierung über eigenes Backend.
     Testschlüssel: CT-DEMO-2025-PROD                              */
  const VALID_KEYS = new Set([
    'CT-DEMO-2025-PROD',
    'CT-ESSENTIALS-001',
    'CT-SHIELD-001',
    'CT-FORTRESS-001',
  ]);

  /* ============================================================
     HILFSFUNKTIONEN (geteilt)
     ============================================================ */

  function getAgo(date) {
    const s = (Date.now() - date) / 1000;
    if (s < 3600)  return Math.floor(s / 60)   + ' Min. ago';
    if (s < 86400) return Math.floor(s / 3600)  + ' Std. ago';
    if (s < 604800)return Math.floor(s / 86400) + ' Tage ago';
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  }

  function fmtEur(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
    if (n >= 1000)    return Math.round(n / 1000).toLocaleString('de-DE') + ' Tsd. €';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  /* ============================================================
     SEKTION 1 — BEDROHUNGSANALYSE
     ============================================================ */

  let allNews = [];

  async function loadCISA() {
    const countEl = document.getElementById('cve-count');
    const badgeEl = document.getElementById('cve-badge');
    const listEl  = document.getElementById('cve-list');
    if (!listEl) return;

    try {
      const r = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
      const d = await r.json();
      const vulns = d.vulnerabilities || [];

      if (countEl) countEl.textContent = vulns.length.toLocaleString('de-DE');

      const recent = vulns.slice(-8).reverse();
      if (badgeEl) {
        const dt = recent[0]?.dateAdded
          ? new Date(recent[0].dateAdded).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
          : 'heute';
        badgeEl.textContent = 'aktualisiert ' + dt;
      }

      listEl.innerHTML = recent.map(v => {
        const name  = v.vulnerabilityName || v.shortDescription || 'Unbekannte Schwachstelle';
        const short = name.length > 65 ? name.slice(0, 65) + '…' : name;
        const date  = v.dateAdded
          ? new Date(v.dateAdded).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
          : '';
        return `<div class="tw-cve-row">
          <div>
            <div class="tw-cve-id">${v.cveID}</div>
            <div class="tw-cve-name">${short}</div>
            <div class="tw-cve-vendor">${v.vendorProject || ''} · ${v.product || ''}</div>
          </div>
          <div class="tw-cve-date">${date}</div>
        </div>`;
      }).join('');
    } catch (e) {
      if (countEl) countEl.textContent = '1.000+';
      if (badgeEl) badgeEl.textContent = 'cisa.gov';
      if (listEl)  listEl.innerHTML =
        '<div class="tw-error">CISA-Daten vorübergehend nicht verfügbar.<br>Besuchen Sie <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank">cisa.gov</a></div>';
    }
  }

  async function loadNews() {
    const el = document.getElementById('news-list');
    if (!el) return;
    const proxy = 'https://api.rss2json.com/v1/api.json?rss_url=';
    const feeds = [
      'https://feeds.feedburner.com/TheHackersNews',
      'https://www.bleepingcomputer.com/feed/',
    ];
    try {
      const results = await Promise.allSettled(
        feeds.map(f => fetch(proxy + encodeURIComponent(f)).then(r => r.json()))
      );
      const items = [];
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.items) {
          const src = i === 0 ? 'The Hacker News' : 'BleepingComputer';
          r.value.items.slice(0, 8).forEach(item => {
            items.push({
              title: item.title,
              link:  item.link,
              date:  new Date(item.pubDate),
              src,
              tags:  (item.title + ' ' + (item.description || '')).toLowerCase(),
            });
          });
        }
      });
      items.sort((a, b) => b.date - a.date);
      allNews = items;
      renderNews(items);
    } catch (e) {
      renderNewsFallback();
    }
  }

  function renderNews(items) {
    const el = document.getElementById('news-list');
    if (!el) return;
    if (!items.length) { renderNewsFallback(); return; }
    el.innerHTML = items.slice(0, 7).map(item => {
      const t = item.title.length > 85 ? item.title.slice(0, 85) + '…' : item.title;
      return `<a class="tw-news-row" href="${item.link}" target="_blank" rel="noopener">
        <div>
          <div class="tw-news-title">${t}</div>
          <div class="tw-news-src">${item.src}</div>
        </div>
        <div class="tw-news-date">${getAgo(item.date)}</div>
      </a>`;
    }).join('');
  }

  function renderNewsFallback() {
    const el = document.getElementById('news-list');
    if (!el) return;
    const fallback = [
      { title: 'Ransomware-Angriffe auf KMU stiegen 2025 um 88 %',             src: 'Cybersecurity Ventures', ago: '2025' },
      { title: 'Lieferkettenangriffe: 30 % aller Datenverletzungen betroffen',  src: 'Verizon DBIR',          ago: '2025' },
      { title: 'API-Schwachstellen stiegen um 181 % im Jahresvergleich',        src: 'Security Boulevard',    ago: '2026' },
      { title: '131 neue CVEs täglich – mittlere Ausnutzungszeit unter 5 Tagen',src: 'NVD / CISA',           ago: '2026' },
      { title: 'Durchschnittlich 207 Tage bis zur Erkennung ohne Monitoring',   src: 'IBM Security',         ago: '2024' },
    ];
    el.innerHTML = fallback.map(n =>
      `<div class="tw-news-row">
        <div><div class="tw-news-title">${n.title}</div><div class="tw-news-src">${n.src}</div></div>
        <div class="tw-news-date">${n.ago}</div>
      </div>`
    ).join('');
  }

  window.filterNews = function (tag, btn) {
    document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (tag === 'all') { renderNews(allNews); return; }
    const filtered = allNews.filter(n => n.tags.includes(tag));
    renderNews(filtered.length ? filtered : allNews);
  };

  /* ============================================================
     SEKTION 2 — RISIKORECHNER
     ============================================================ */

  function initCheckboxes() {
    document.querySelectorAll('.rc-check').forEach(el =>
      el.addEventListener('click', () => el.classList.toggle('on'))
    );
  }

  window.calculate = function () {
    const company   = (document.getElementById('company')?.value || '').trim() || 'Ihr Unternehmen';
    const industry  = document.getElementById('industry')?.value  || 'other';
    const employees = parseInt(document.getElementById('employees')?.value || '50');
    const revenue   = parseFloat(document.getElementById('revenue')?.value  || '500') * 1000 || 500000;

    const dataChecked = [...document.querySelectorAll('#data-checks .rc-check.on')].map(e => e.dataset.val);
    const secChecked  = [...document.querySelectorAll('#security-checks .rc-check.on')].map(e => e.dataset.val);
    const secScore    = secChecked.length;

    const mult = { fintech:2.1, healthcare:2.4, ecommerce:1.7, saas:1.5, outsourcing:1.4, manufacturing:1.3, other:1.2 }[industry] || 1.2;
    const dataRisk = { customer:85000, payment:120000, health:200000, ip:95000, employee:45000, financial:75000 };
    const dataLoss  = dataChecked.reduce((s, k) => s + (dataRisk[k] || 0), 0);
    const secFactor = 1 + Math.max(0, (6 - secScore) * 0.18);

    const base       = Math.max(50000, revenue * 0.12);
    const downtime   = employees * 1200 * (secScore < 3 ? 5 : 3);
    const regulatory = dataChecked.includes('payment') ? 75000 : dataChecked.includes('health') ? 120000 : 15000;
    const reputation = revenue * (0.08 + (6 - secScore) * 0.015);
    const incident   = (base + dataLoss) * mult * secFactor;
    const total      = Math.round(incident + downtime + regulatory + reputation);

    const items = [
      { label: 'Kosten der Schadensbehebung',             val: Math.round(incident)   },
      { label: 'Betriebsausfall & Produktivitätsverlust', val: Math.round(downtime)   },
      { label: 'Reputationsschäden',                      val: Math.round(reputation) },
      { label: 'Bußgelder / DSGVO-Strafen',               val: Math.round(regulatory) },
    ];

    const breachProb   = Math.min(95, 40 + (6 - secScore) * 9 + dataChecked.length * 3);
    const recoveryDays = secScore < 2 ? 45 : secScore < 4 ? 21 : 10;
    const yearlyRisk   = Math.round(total * (breachProb / 100));
    const rcClass      = recoveryDays > 20 ? 'high' : recoveryDays > 10 ? 'med' : 'low';

    const recsMap = {
      fintech:       ['PCI-DSS-Compliance implementieren','24/7-Transaktionsüberwachung einrichten','Alle Zahlungsdaten verschlüsseln'],
      healthcare:    ['DSGVO-konforme Datenverschlüsselung','Zugriffskontrolle für Patientenakten','Vollständiges Audit-Logging'],
      ecommerce:     ['Schutz vor Skimming / Magecart','Web Application Firewall (WAF) einrichten','API-Monitoring der Zahlungsschnittstellen'],
      saas:          ['Penetrationstest für API und Web-App','SIEM zur Anomalieerkennung einführen','Zero-Trust-Architektur umsetzen'],
      outsourcing:   ['Kundenumgebungen isolieren','Privilegierte Konten regelmäßig auditieren','SOC-Monitoring rund um die Uhr'],
      manufacturing: ['OT/SCADA-Systeme absichern','Netzwerke segmentieren','Redundanz kritischer Systeme aufbauen'],
      other:         ['Grundlegenden Security-Audit durchführen','Team zu Phishing schulen','MFA überall einführen'],
    };
    const recs = recsMap[industry] || recsMap.other;
    const dateStr = new Date().toLocaleDateString('de-DE', { day:'numeric', month:'long', year:'numeric' });

    const el = document.getElementById('results');
    if (!el) return;

    el.innerHTML = `
      <div class="rc-results-head">
        <div class="rc-results-title">Risikoanalyse ohne Cyberschutz</div>
        <div class="rc-results-company">${company} · ${dateStr}</div>
      </div>
      <div class="rc-results-body">
        <div class="rc-total">
          <div class="rc-total-num">${fmtEur(total)}</div>
          <div class="rc-total-label">potenzielle Verluste<br>durch einen einzigen Vorfall</div>
        </div>
        <div class="rc-items">
          ${items.map(i => `
            <div class="rc-item">
              <div class="rc-item-label">${i.label}</div>
              <div class="rc-item-bar-wrap"><div class="rc-item-bar" style="width:${Math.round(i.val/total*100)}%"></div></div>
              <div class="rc-item-val">${fmtEur(i.val)}</div>
            </div>`).join('')}
        </div>
        <div class="rc-risk-row">
          <div class="rc-risk high">
            <div class="rc-risk-label">Angriffswahrscheinlichkeit</div>
            <div class="rc-risk-val">${breachProb}%</div>
            <div class="rc-risk-desc">innerhalb von 12 Monaten</div>
          </div>
          <div class="rc-risk med">
            <div class="rc-risk-label">Erwarteter Schaden</div>
            <div class="rc-risk-val">${fmtEur(yearlyRisk)}</div>
            <div class="rc-risk-desc">hochgerechnet auf ein Jahr</div>
          </div>
          <div class="rc-risk ${rcClass}">
            <div class="rc-risk-label">Wiederherstellung</div>
            <div class="rc-risk-val">${recoveryDays}+ Tage</div>
            <div class="rc-risk-desc">bis zur Normalisierung</div>
          </div>
        </div>
        <div class="rc-recs">
          <div class="rc-recs-title">Prioritäten für ${company}</div>
          ${recs.map(r => `<div class="rc-rec"><div class="rc-rec-dot"></div>${r}</div>`).join('')}
          ${secScore < 3 ? '<div class="rc-rec"><div class="rc-rec-dot"></div>MFA und Datensicherungen sofort einführen</div>' : ''}
        </div>
        <div class="rc-cta">
          <div class="rc-cta-text">Schutz kostet 10–50× weniger als ein Vorfall.
            <small>Kostenlose Beratung – wir zeigen konkrete Schritte für Ihr Unternehmen.</small>
          </div>
          <a class="rc-cta-link" href="https://cybterra.com" target="_blank">Audit anfordern →</a>
        </div>
      </div>`;

    el.classList.remove('hidden');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ============================================================
     SEKTION 3 — KI-CHATBOT
     ============================================================ */

  let isPro        = false;
  let isLoading    = false;
  let conversation = [];

  /* Schlüsselwörter die Pro-Zugang erfordern */
  const PRO_KEYWORDS = [
    'antivirus','antiviren','defender','bitdefender','eset','kaspersky',
    'firewall','installier','einrichten','konfigur',
    'passwort','password','bitwarden','keepass','passwort-manager',
    '2fa','mfa','zwei-faktor','authenticator',
    'backup','sicherung','wiederherstellung','veeam','acronis',
    'vpn','netzwerk','router','port',
    'gdpr','dsgvo','datenschutz compliance',
    'incident','angriff bemerkt','gehackt','ransomware entfernen',
    'siem','edr','endpoint','patch',
    'schritt für schritt','anleitung','tutorial',
    'wie installiere','wie richte','wie konfiguriere','wie schütze',
  ];

  function isProQuestion(text) {
    const t = text.toLowerCase();
    return PRO_KEYWORDS.some(k => t.includes(k));
  }

  function buildSystemPrompt() {
    const access = isPro
      ? `Der Benutzer hat ein gültiges CybTerra-Paket aktiviert und hat VOLLEN ZUGRIFF.
Gib detaillierte technische Anleitungen zu: Antivirus-Installation, Firewall-Konfiguration,
Passwort-Manager, 2FA/MFA, Backup-Strategien, VPN, Netzwerksicherheit, DSGVO-Compliance, Incident Response.`
      : `Der Benutzer hat KEIN aktives Paket.
Beantworte nur allgemeine Fragen. Für technische Anleitungen erkläre freundlich,
dass diese Inhalte nur für Kunden verfügbar sind.`;

    return `Du bist der KI-Sicherheitsassistent von CybTerra — einem professionellen Cybersicherheits-Unternehmen für KMU im DACH-Raum.
Antworte immer auf Deutsch. Sei klar, professionell und direkt. Max. 200 Wörter außer bei Anleitungen.
${access}
Allgemeine Themen (immer beantworten): Was ist Cybersicherheit, warum wichtig, aktuelle Bedrohungen,
CybTerra Pakete (Essentials €1.500, Shield €3.500, Fortress €6.000, Custom), allgemeine Tipps, Kontakt.
Website: cybterra.com`;
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/^[-•] (.+)/gm, '<li>$1</li>')
      .replace(/((<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>');
  }

  function renderMsg(role, content, locked) {
    const container = document.getElementById('messages');
    if (!container) return;
    const time = new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' });
    const div  = document.createElement('div');
    div.className = `msg ${role}`;

    let bubble = '';
    if (locked) {
      bubble = `<div class="lock-card">
        <div class="lock-icon">🔒</div>
        <div class="lock-text">
          <strong>Nur für Kunden verfügbar</strong>
          Diese Anleitung ist für Inhaber eines CybTerra-Pakets freigeschaltet.
          <br><button class="lock-btn" onclick="openModal()">Paket aktivieren →</button>
        </div>
      </div>`;
    } else {
      bubble = `<div class="msg-bubble">${formatText(content)}</div>`;
    }

    div.innerHTML = `
      <div class="msg-avatar">${role === 'user' ? 'Sie' : 'CT'}</div>
      <div>${bubble}<div class="msg-time">${time}</div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const c = document.getElementById('messages');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'msg bot'; d.id = 'ct-typing';
    d.innerHTML = `<div class="msg-avatar">CT</div>
      <div class="typing-bubble">
        <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
      </div>`;
    c.appendChild(d);
    c.scrollTop = c.scrollHeight;
  }

  function removeTyping() { document.getElementById('ct-typing')?.remove(); }

  async function callClaude(userMsg) {
    conversation.push({ role: 'user', content: userMsg });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: buildSystemPrompt(),
        messages: conversation.slice(-10),
      }),
    });
    if (!res.ok) throw new Error('API ' + res.status);
    const data  = await res.json();
    const reply = data.content?.[0]?.text || 'Bitte versuchen Sie es erneut.';
    conversation.push({ role: 'assistant', content: reply });
    return reply;
  }

  window.sendMessage = async function (text) {
    const input = document.getElementById('userInput');
    const msg   = (text || input?.value || '').trim();
    if (!msg || isLoading) return;
    if (input) { input.value = ''; input.style.height = 'auto'; }
    clearQR();
    renderMsg('user', msg);

    if (!isPro && isProQuestion(msg)) {
      renderMsg('bot', '', true);
      showQR('locked');
      return;
    }

    isLoading = true;
    const btn = document.getElementById('sendBtn');
    if (btn) btn.disabled = true;
    showTyping();

    try {
      const reply = await callClaude(msg);
      removeTyping();
      renderMsg('bot', reply);
      showQR('default');
    } catch (e) {
      removeTyping();
      renderMsg('bot', 'Es gab ein technisches Problem. Bitte wenden Sie sich direkt an cybterra.com');
    } finally {
      isLoading = false;
      if (btn) btn.disabled = false;
    }
  };

  const QR_SETS = {
    default: [
      { label: 'Welche Pakete gibt es?',   text: 'Welche Sicherheitspakete bietet CybTerra an?', locked: false },
      { label: 'Was kostet ein Angriff?',  text: 'Was kostet ein Cyberangriff ein KMU?',          locked: false },
      { label: '🔒 Antivirus einrichten',  text: 'Wie installiere ich Antivirus?',                locked: true  },
      { label: '🔒 Firewall konfigurieren',text: 'Wie richte ich eine Firewall ein?',             locked: true  },
    ],
    locked: [
      { label: 'Paket aktivieren', text: null, action: 'openModal', locked: false },
      { label: 'Pakete ansehen',   text: 'Welche Pakete bietet CybTerra an?',    locked: false },
    ],
    pro: [
      { label: 'Antivirus installieren', text: 'Wie installiere ich Antivirus Schritt für Schritt?', locked: false },
      { label: 'Firewall einrichten',    text: 'Wie konfiguriere ich eine Firewall?',                locked: false },
      { label: 'Passwort-Manager',       text: 'Wie richte ich einen Passwort-Manager ein?',         locked: false },
      { label: '2FA aktivieren',         text: 'Wie aktiviere ich Zwei-Faktor-Authentifizierung?',   locked: false },
    ],
  };

  function showQR(type) {
    const el = document.getElementById('quickReplies');
    if (!el) return;
    const set = isPro ? QR_SETS.pro : (QR_SETS[type] || QR_SETS.default);
    el.innerHTML = set.map(q => {
      const cls = q.locked ? 'qr-btn locked' : 'qr-btn';
      const oc  = q.action
        ? `onclick="${q.action}()"`
        : q.locked
          ? `onclick="openModal()"`
          : `onclick="sendMessage('${q.text.replace(/'/g,"\\'")}')"`
      return `<button class="${cls}" ${oc}>${q.label}</button>`;
    }).join('');
  }

  function clearQR() {
    const el = document.getElementById('quickReplies');
    if (el) el.innerHTML = '';
  }

  /* ── Modal ── */
  window.openModal = function () {
    const m = document.getElementById('activateModal');
    if (m) { m.classList.remove('hidden'); document.getElementById('licenseInput')?.focus(); }
  };

  window.closeModal = function () {
    const m = document.getElementById('activateModal');
    if (m) m.classList.add('hidden');
    const e = document.getElementById('keyError');
    if (e) e.classList.add('hidden');
    const i = document.getElementById('licenseInput');
    if (i) i.value = '';
  };

  window.activateLicense = function () {
    const key  = (document.getElementById('licenseInput')?.value || '').trim().toUpperCase();
    const errEl = document.getElementById('keyError');

    /* Demo: jeder Schlüssel der mit CT- beginnt gilt als gültig */
    if (VALID_KEYS.has(key) || key.startsWith('CT-')) {
      isPro = true;
      closeModal();
      conversation = [];
      const badge = document.getElementById('accessBadge');
      if (badge) { badge.textContent = '✓ Pro'; badge.className = 'access-badge pro'; }
      renderMsg('bot', '✅ **Paket erfolgreich aktiviert!**\n\nSie haben jetzt vollen Zugriff auf alle Sicherheitsanleitungen. Was möchten Sie einrichten?');
      showQR('pro');
    } else {
      if (errEl) { errEl.classList.remove('hidden'); errEl.textContent = 'Ungültiger Schlüssel. Bitte prüfen Sie Ihre E-Mail oder wenden Sie sich an cybterra.com'; }
    }
  };

  /* ── UI-Events ── */
  window.handleKey = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendMessage(); }
  };

  window.autoResize = function (el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  };

  /* ============================================================
     INITIALISIERUNG
     ============================================================ */

  function init() {
    /* Timestamp */
    const ts = document.getElementById('updated-time');
    if (ts) ts.textContent = 'Aktualisiert: ' + new Date().toLocaleString('de-DE', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    }) + ' Uhr';

    /* Sektion 1 */
    loadCISA();
    loadNews();

    /* Sektion 2 */
    initCheckboxes();

    /* Sektion 3 — Modal schließen bei Klick außerhalb */
    const modal = document.getElementById('activateModal');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) window.closeModal(); });
    const li = document.getElementById('licenseInput');
    if (li) li.addEventListener('keydown', e => { if (e.key === 'Enter') window.activateLicense(); });

    /* Willkommensnachricht */
    renderMsg('bot', 'Guten Tag! Ich bin der KI-Sicherheitsassistent von **CybTerra**.\n\nIch beantworte Ihre Fragen rund um Cybersicherheit. Für detaillierte Anleitungen aktivieren Sie bitte Ihr Paket.');
    showQR('default');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
