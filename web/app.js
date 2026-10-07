const $ = id => document.getElementById(id);
const normalize = value => value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[\s\-־'’]/g, '');
const confidenceLabels = { high: 'ביטחון גבוה', medium: 'ביטחון בינוני', low: 'ביטחון נמוך' };
let names = [], filtered = [], shown = 30, installPrompt;
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function filterNames() {
  const q = normalize($('search').value.trim());
  const gender = $('gender').value, origin = $('origin').value;
  filtered = names.filter(n => {
    const matchesText = !q || normalize(n.name_he).includes(q) || normalize(n.name_en).includes(q);
    const matchesGender = gender === 'all' || n.gender === gender || (gender !== 'זכר/נקבה' && n.gender === 'זכר/נקבה');
    const matchesOrigin = origin === 'all' || (origin === 'biblical' && n.origin.includes('מקראי')) || (origin === 'hebrew' && n.origin.includes('עברי')) || (origin === 'international' && n.origin.includes('בינלאומי'));
    return matchesText && matchesGender && matchesOrigin;
  });
  shown = 30;
  $('clear-search').hidden = !$('search').value;
  render();
}
function render() {
  const fragment = document.createDocumentFragment();
  filtered.slice(0, shown).forEach(n => {
    const card = element('button', undefined, 'name-card');
    card.type = 'button'; card.dataset.id = n.id; card.setAttribute('aria-label', `פרטי השם ${n.name_he}`);
    const top = element('div', undefined, 'card-top');
    top.append(element('h3', n.name_he));
    const english = element('span', n.name_en, 'card-english'); english.dir = 'ltr'; top.append(english);
    card.append(top, element('p', n.meaning_he), element('span', n.gender === 'זכר/נקבה' ? 'לבנים ולבנות' : n.gender === 'זכר' ? 'לבנים' : 'לבנות', 'card-gender'));
    fragment.append(card);
  });
  $('results').replaceChildren(fragment); $('results').setAttribute('aria-busy', 'false');
  $('result-count').textContent = `${filtered.length} רשומות${filtered.length !== names.length ? ` מתוך ${names.length}` : ''}`;
  $('load-more').hidden = shown >= filtered.length;
  $('empty').hidden = filtered.length > 0 || names.length === 0;
}
function showName(id) {
  const n = names.find(n => n.id === id); if (!n) return;
  $('detail-name').textContent = n.name_he; $('detail-english').textContent = n.name_en;
  $('detail-origin').textContent = n.origin;
  $('detail-meaning').textContent = n.meaning_he; $('detail-etymology').textContent = n.etymology_he;
  $('detail-badges').replaceChildren(element('span', n.gender, 'badge'), element('span', confidenceLabels[n.confidence], `badge ${n.confidence}`));
  const canonical = n.canonical_name_id || n.id;
  const variants = names.filter(v => v.id !== n.id && (v.canonical_name_id || v.id) === canonical);
  $('variants-section').hidden = !variants.length; $('variants').replaceChildren();
  variants.forEach(v => { const button = element('button', v.name_he, 'badge variant-button'); button.type = 'button'; button.addEventListener('click', () => showName(v.id)); $('variants').append(button); });
  const sources = $('detail-sources'); sources.replaceChildren();
  const links = n.source_links || [];
  if (links.length) {
    const list = element('ul');
    links.forEach(s => {
      const li = element('li');
      try {
        const url = new URL(s.url);
        if (url.protocol !== 'https:') throw new Error('Invalid source URL');
        const link = element('a', s.label); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; li.append(link);
      } catch { li.append(element('span', s.label)); }
      const type = { secondary: 'מקור משני', primary: 'מקור ראשוני', lexical: 'מקור מילוני', user_submission: 'תוכן שהוזן בידי משתמשים', documentary: 'דוגמה מתועדת לשימוש בשם' }[s.kind];
      if (type) li.append(element('span', type, 'source-note')); list.append(li);
    }); sources.append(list);
  } else {
    sources.append(element('p', 'תוויות המקור ברשומה: ' + n.sources.join(', ')));
    sources.append(element('p', 'טרם נוספו קישורים מדויקים לרשומה זו. תוויות אלה אינן אימות מתועד.', 'source-note'));
  }
  if (n.research_date) sources.append(element('p', 'בדיקה ממוקדת: ' + new Intl.DateTimeFormat('he-IL').format(new Date(n.research_date + 'T12:00:00'))));
  if (n.research_notes_he) sources.append(element('p', n.research_notes_he, 'source-note'));
  $('source-details').open = false;
  if (!$('name-dialog').open) $('name-dialog').showModal();
}
async function loadNames() {
  $('error').hidden = true; $('results').setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/data/names.json'); if (!response.ok) throw new Error('Dataset unavailable');
    const data = await response.json();
    if (!Array.isArray(data.names) || !data.names.length) throw new Error('Invalid dataset');
    names = data.names.sort((a, b) => a.name_he.localeCompare(b.name_he, 'he')); filterNames();
  } catch {
    $('error').hidden = false; $('results').setAttribute('aria-busy', 'false'); $('result-count').textContent = 'הנתונים אינם זמינים';
  }
}
$('search-form').addEventListener('submit', event => { event.preventDefault(); filterNames(); $('search').blur(); });
['search', 'gender', 'origin'].forEach(id => $(id).addEventListener(id === 'search' ? 'input' : 'change', filterNames));
$('clear-search').addEventListener('click', () => { $('search').value = ''; filterNames(); $('search').focus(); });
$('reset').addEventListener('click', () => { $('search').value = ''; $('gender').value = $('origin').value = 'all'; filterNames(); $('search').focus(); });
$('retry').addEventListener('click', loadNames);
$('load-more').addEventListener('click', () => { const before = shown; shown += 30; render(); $('results').children[before]?.focus(); });
$('results').addEventListener('click', event => { const card = event.target.closest('[data-id]'); if (card) showName(card.dataset.id); });
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
});
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
$('install').hidden = standalone();
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = standalone(); });
window.addEventListener('appinstalled', () => { $('install').hidden = true; installPrompt = undefined; });
$('install').addEventListener('click', async () => {
  if (installPrompt) {
    await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = undefined;
  } else {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    $('install-instructions').textContent = ios ? 'ב־Safari: לחצו על כפתור השיתוף, ואז על „הוספה למסך הבית”.' : 'ב־Chrome: פתחו את תפריט שלוש הנקודות ובחרו „התקנת אפליקציה” או „הוספה למסך הבית”.';
    $('install-dialog').showModal();
  }
});
function updateOfflineStatus(ready = false) {
  $('offline-status').textContent = ready ? (navigator.onLine ? 'מוכן לשימוש גם ללא אינטרנט' : 'ללא אינטרנט · השמות זמינים במכשיר') : 'מכין את היישומון לעבודה ללא אינטרנט…';
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(() => {
    updateOfflineStatus(true);
    window.addEventListener('online', () => updateOfflineStatus(true)); window.addEventListener('offline', () => updateOfflineStatus(true));
  }).catch(() => { $('offline-status').textContent = 'השמירה לשימוש ללא אינטרנט לא הושלמה'; });
  let reloading = false;
  const wasControlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (wasControlled && !reloading) { reloading = true; location.reload(); } });
} else { $('offline-status').textContent = 'לשימוש ללא אינטרנט יש לפתוח בדפדפן התומך בהתקנה'; }
loadNames();
