/* ============================================================
   CybTerra · Bedrohungsanalyse + Risikorechner
   ============================================================ */

(function () {
  'use strict';

  /* ── Gemeinsame Hilfsfunktionen ── */

  function getAgo(date) {
    const diff = (Date.now() - date) / 1000;
    if (diff < 3600)  return Math.floor(diff / 60) + ' Min. ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' Std. ago';
    if (diff < 604800) return Math.floor(diff / 86400) + ' Tage ago';
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
  }

  function fmtEur(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' Mio. €';
    if (n >= 1000)    return Math.round(n / 1000).toLocaleString('de-DE') + ' Tsd. €';
    return Math.round(n).toLocaleString('de-DE') + ' €';
  }

  /* ============================================================
     BEDROHUNGSANALYSE — CISA + RSS
  ============================================================ */

  let allNews = [];

  async function loadCISA() {
    const countEl = document.getElementById('cve-count');
    const badgeEl = document.getElementById('cve-badge');
    const listEl  = document.getElementById('cve-list');
    if (!countEl || !listEl) return;

    try {
      const r = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json');
      const d = await r.json();
      const vulns = d.vulnerabilities || [];

      countEl.textContent = vulns.length.toLocaleString('de-DE');

      const recent = vulns.slice(-8).reverse();
      const addedDate = recent[0]?.dateAdded
        ? new Date(recent[0].dateAdded).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
        : 'heute';
      if (badgeEl) badgeEl.textContent = 'aktualisiert ' + addedDate;

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
    const newsEl = document.getElementById('news-list');
    if (!newsEl) return;

    const feeds = [
      'https://feeds.feedburner.com/TheHackersNews',
      'https://www.bleepingcomputer.com/feed/'
    ];
    const proxy = 'https://api.rss2json.com/v1/api.json?rss_url=';

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
              tags:  (item.title + ' ' + (item.description || '')).toLowerCase()
            });
          });
        }
      });
      items.sort((a, b) => b.date - a.date);
      allNews = items;
      renderNews(items);
    } catch (e) {
      renderFallback();
    }
  }

  function renderNews(items) {
    const el = document.getElementById('news-list');
    if (!el) return;
    if (!items.length) { renderFallback(); return; }
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

  function renderFallback() {
    const el = document.getElementById('news-list');
    if (!el) return;
    const news = [
      { title: 'Ransomware-Angriffe auf KMU stiegen 2025 um 88 %',          src: 'Cybersecurity Ventures', ago: '2025' },
      { title: 'Lieferkettenangriffe: 30 % aller Datenverletzungen betroffen', src: 'Verizon DBIR',          ago: '2025' },
      { title: 'API-Schwachstellen stiegen um 181 % im Jahresvergleich',      src: 'Security Boulevard',    ago: '2026' },
      { title: '131 neue CVEs täglich – mittlere Ausnutzungszeit unter 5 Tagen', src: 'NVD / CISA',         ago: '2026' },
      { title: 'Durchschnittlich 207 Tage bis zur Erkennung ohne Monitoring',  src: 'IBM Security',         ago: '2024' },
    ];
    el.innerHTML = news.map(n =>
      `<div class="tw-news-row">
        <div><div class="tw-news-title">${n.title}</div><div class="tw-news-src">${n.src}</div></div>
        <div class="tw-news-date">${n.ago}</div>
      </div>`
    ).join('');
  }

  /* filterNews — global, aufgerufen von onclick in HTML */
  window.filterNews = function (tag, btn) {
    document.querySelectorAll('.tw-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    if (tag === 'all') { renderNews(allNews); return; }
    const filtered = allNews.filter(n => n.tags.includes(tag));
    renderNews(filtered.length ? filtered : allNews);
  };

  /* ============================================================
     RISIKORECHNER
  ============================================================ */

  /* Checkboxen toggle */
  function initCheckboxes() {
    document.querySelectorAll('.rc-check').forEach(el => {
      el.addEventListener('click', () => el.classList.toggle('on'));
    });
  }

  /* calculate — global, aufgerufen von onclick in HTML */
  window.calculate = function () {
    const company   = (document.getElementById('company')?.value || '').trim() || 'Ihr Unternehmen';
    const industry  = document.getElementById('industry')?.value || 'other';
    const employees = parseInt(document.getElementById('employees')?.value || '50');
    const revenue   = parseFloat(document.getElementById('revenue')?.value || '500') * 1000 || 500000;

    const dataChecked = [...document.querySelectorAll('#data-checks .rc-check.on')].map(e => e.dataset.val);
    const secChecked  = [...document.querySelectorAll('#security-checks .rc-check.on')].map(e => e.dataset.val);
    const secScore    = secChecked.length;

    const mult = { fintech: 2.1, healthcare: 2.4, ecommerce: 1.7, saas: 1.5, outsourcing: 1.4, manufacturing: 1.3, other: 1.2 }[industry] || 1.2;

    const dataRisk = { customer: 85000, payment: 120000, health: 200000, ip: 95000, employee: 45000, financial: 75000 };
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
      fintech:       ['PCI-DSS-Compliance implementieren', '24/7-Transaktionsüberwachung einrichten', 'Alle Zahlungsdaten verschlüsseln'],
      healthcare:    ['DSGVO-konforme Datenverschlüsselung', 'Zugriffskontrolle für Patientenakten', 'Vollständiges Audit-Logging'],
      ecommerce:     ['Schutz vor Skimming / Magecart', 'Web Application Firewall (WAF) einrichten', 'API-Monitoring der Zahlungsschnittstellen'],
      saas:          ['Penetrationstest für API und Web-App', 'SIEM zur Anomalieerkennung einführen', 'Zero-Trust-Architektur umsetzen'],
      outsourcing:   ['Kundenumgebungen isolieren', 'Privilegierte Konten regelmäßig auditieren', 'SOC-Monitoring rund um die Uhr'],
      manufacturing: ['OT/SCADA-Systeme absichern', 'Netzwerke segmentieren', 'Redundanz kritischer Systeme aufbauen'],
      other:         ['Grundlegenden Security-Audit durchführen', 'Team zu Phishing schulen', 'MFA überall einführen'],
    };
    const recs = recsMap[industry] || recsMap.other;

    const dateStr = new Date().toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });

    const resultsEl = document.getElementById('results');
    if (!resultsEl) return;

    resultsEl.innerHTML = `
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
              <div class="rc-item-bar-wrap"><div class="rc-item-bar" style="width:${Math.round(i.val / total * 100)}%"></div></div>
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
          <div class="rc-cta-text">
            Schutz kostet 10–50× weniger als ein Vorfall.
            <small>Kostenlose Beratung – wir zeigen konkrete Schritte für Ihr Unternehmen.</small>
          </div>
          <a class="rc-cta-link" href="https://cybterra.com" target="_blank">Audit anfordern →</a>
        </div>
      </div>
    `;

    resultsEl.classList.remove('hidden');
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ============================================================
     INITIALISIERUNG
  ============================================================ */

  function init() {
    /* Timestamp */
    const tsEl = document.getElementById('updated-time');
    if (tsEl) {
      tsEl.textContent = 'Aktualisiert: ' + new Date().toLocaleString('de-DE', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
      }) + ' Uhr';
    }

    /* Bedrohungsanalyse */
    loadCISA();
    loadNews();

    /* Risikorechner */
    initCheckboxes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
