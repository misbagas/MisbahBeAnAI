const STORAGE_KEY = 'resumecraft-v2';

const starterData = {
  fullName: '',
  headline: '',
  email: '',
  phone: '',
  location: '',
  photo: '',
  showPhoto: false,
  summary: '',
  skills: '',
  linkedin: '',
  github: '',
  website: '',
  template: 'modern',
  accent: '#7c6ce5',
  compactSpacing: false,
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  achievements: []
};

const SCORE_WEIGHTS = {
  relevance: 20,
  ats: 15,
  impact: 15,
  skills: 10,
  projects: 10,
  summary: 8,
  readability: 7,
  structure: 5,
  education: 3,
  certifications: 2,
  links: 2,
  consistency: 3
};

const ACTION_VERBS = new Set([
  'built','developed','designed','implemented','automated','optimized','migrated','secured',
  'refactored','deployed','created','engineered','integrated','led','improved','reduced',
  'increased','launched','delivered','architected','configured','tested','maintained',
  'modernized','streamlined','analyzed','resolved','orchestrated','provisioned'
]);

const STOPWORDS = new Set(('a an and are as at be been being by for from had has have he her here hers him his i if in into is it its of on or our she that the their them they this to was we were will with you your about above after again against all am any because before below between both but can cannot could did do does doing down during each few further get got getting had how however just more most no nor not now off once only other out over own same should so some such than too under until very what when where which while who why would').split(/\s+/));

const TECH_TERMS = [
  'javascript','typescript','react','angular','vue','node.js','nodejs','express','next.js','nextjs',
  'java','spring boot','springboot','quarkus','python','django','flask','php','laravel','c#','.net',
  'go','golang','rust','kotlin','swift','c++','html','css','tailwind','rest api','rest apis',
  'graphql','websocket','postgresql','postgres','mysql','mariadb','oracle','mongodb','sqlite',
  'redis','docker','kubernetes','aws','azure','gcp','github actions','git','linux','terraform',
  'jenkins','ci/cd','microservices','api security','owasp','vapt','iam','siem','soc','oauth','jwt',
  'openai api','llm','machine learning','cybersecurity','blockchain','solidity'
];

let data = loadData();
let zoom = 90;
let toastTimer;
let lastAnalysis = null;

const $ = (id) => document.getElementById(id);
const els = {
  paper: $('resumePaper'),
  toast: $('toast'),
  saveStatus: $('saveStatus'),
  previewBadge: $('previewBadge'),
  completionPercent: $('completionPercent'),
  completionBar: $('completionBar'),
  completionHint: $('completionHint'),
  summary: $('summary'),
  summaryCount: $('summaryCount'),
  skillChips: $('skillChips'),
  experienceList: $('experienceList'),
  educationList: $('educationList'),
  projectsList: $('projectsList'),
  certificationList: $('certificationList'),
  achievementList: $('achievementList'),
  previewExperience: $('previewExperience'),
  previewEducation: $('previewEducation'),
  previewProjects: $('previewProjects'),
  previewCertifications: $('previewCertifications'),
  previewAchievements: $('previewAchievements'),
  previewSkills: $('previewSkills'),
  previewLinks: $('previewLinks'),
  previewContacts: $('previewContacts'),
  previewName: $('previewName'),
  previewHeadline: $('previewHeadline'),
  previewSummary: $('previewSummary'),
  resumePhoto: $('resumePhoto'),
  photoPreview: $('photoPreview'),
  zoomValue: $('zoomValue')
};

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function normalizeData(input) {
  const base = deepClone(starterData);
  const out = { ...base, ...(input || {}) };
  for (const key of ['experience', 'education', 'projects', 'certifications', 'achievements']) {
    out[key] = Array.isArray(out[key]) ? out[key].filter(Boolean) : [];
  }
  out.showPhoto = !!out.showPhoto;
  out.compactSpacing = !!out.compactSpacing;
  out.template = ['modern','classic','compact'].includes(out.template) ? out.template : 'modern';
  out.accent = /^#[0-9a-f]{6}$/i.test(out.accent || '') ? out.accent : '#7c6ce5';
  return out;
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return deepClone(starterData);
    return normalizeData(JSON.parse(raw));
  } catch {
    return deepClone(starterData);
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaveState('Autosaved', false);
  } catch {
    setSaveState('Local save unavailable', true);
  }
}

function setSaveState(text, saving) {
  els.saveStatus.innerHTML = `<span class="status-dot${saving ? ' is-saving' : ''}"></span> ${escapeHtml(text)}`;
  els.previewBadge.textContent = saving ? 'Saving…' : 'Live';
}

function scheduleSave() {
  setSaveState('Saving…', true);
  clearTimeout(scheduleSave.timer);
  scheduleSave.timer = setTimeout(saveData, 250);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value.includes('://') ? value : `https://${value}`);
    if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return '';
    return parsed.href;
  } catch { return ''; }
}

function formatUrlForLabel(url) {
  return String(url || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '') || '';
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function inputValue(value) { return escapeHtml(value || ''); }

function cardTemplate(type, item, index) {
  const remove = `<button class="mini-btn remove" type="button" data-remove="${type}" data-id="${escapeHtml(item.id)}" aria-label="Remove item">×</button>`;
  if (type === 'experience') {
    return `<article class="repeat-card" data-id="${escapeHtml(item.id)}">
      <div class="repeat-card-header"><span class="repeat-card-title">Role ${index + 1}</span><div class="card-actions">${remove}</div></div>
      <div class="repeat-card-body"><div class="form-grid two-col">
        <label class="field"><span>Job title</span><input data-collection="experience" data-id="${escapeHtml(item.id)}" data-key="role" value="${inputValue(item.role)}" maxlength="100" placeholder="Software Engineer" /></label>
        <label class="field"><span>Company</span><input data-collection="experience" data-id="${escapeHtml(item.id)}" data-key="company" value="${inputValue(item.company)}" maxlength="120" placeholder="Company Name" /></label>
        <label class="field"><span>Start</span><input data-collection="experience" data-id="${escapeHtml(item.id)}" data-key="start" value="${inputValue(item.start)}" maxlength="40" placeholder="Jan 2024" /></label>
        <label class="field"><span>End</span><input data-collection="experience" data-id="${escapeHtml(item.id)}" data-key="end" value="${inputValue(item.end)}" maxlength="40" placeholder="Present" /></label>
        <label class="field full"><span>Location <small>optional</small></span><input data-collection="experience" data-id="${escapeHtml(item.id)}" data-key="location" value="${inputValue(item.location)}" maxlength="100" placeholder="Jakarta, Indonesia · Remote" /></label>
        <label class="field full"><span>Impact bullets <small>one per line</small></span><textarea data-collection="experience" data-id="${escapeHtml(item.id)}" data-key="bullets" maxlength="1600" placeholder="Developed a Java REST API for order processing\nReduced manual processing by 35% after automating validation...">${escapeHtml(item.bullets || '')}</textarea></label>
      </div></div>
    </article>`;
  }

  if (type === 'education') {
    return `<article class="repeat-card" data-id="${escapeHtml(item.id)}">
      <div class="repeat-card-header"><span class="repeat-card-title">Education ${index + 1}</span><div class="card-actions">${remove}</div></div>
      <div class="repeat-card-body"><div class="form-grid two-col">
        <label class="field full"><span>Degree / Program</span><input data-collection="education" data-id="${escapeHtml(item.id)}" data-key="degree" value="${inputValue(item.degree)}" maxlength="140" placeholder="B.Sc. Information Technology" /></label>
        <label class="field"><span>School</span><input data-collection="education" data-id="${escapeHtml(item.id)}" data-key="school" value="${inputValue(item.school)}" maxlength="140" placeholder="University Name" /></label>
        <label class="field"><span>Year</span><input data-collection="education" data-id="${escapeHtml(item.id)}" data-key="year" value="${inputValue(item.year)}" maxlength="50" placeholder="2022 – 2026" /></label>
        <label class="field full"><span>Details <small>optional</small></span><input data-collection="education" data-id="${escapeHtml(item.id)}" data-key="details" value="${inputValue(item.details)}" maxlength="220" placeholder="GPA 3.72 · Relevant coursework: Software Engineering" /></label>
      </div></div>
    </article>`;
  }

  if (type === 'projects') {
    return `<article class="repeat-card" data-id="${escapeHtml(item.id)}">
      <div class="repeat-card-header"><span class="repeat-card-title">Project ${index + 1}</span><div class="card-actions">${remove}</div></div>
      <div class="repeat-card-body"><div class="form-grid two-col">
        <label class="field"><span>Project name</span><input data-collection="projects" data-id="${escapeHtml(item.id)}" data-key="name" value="${inputValue(item.name)}" maxlength="120" placeholder="AI Chat Application" /></label>
        <label class="field"><span>URL <small>optional</small></span><input data-collection="projects" data-id="${escapeHtml(item.id)}" data-key="url" value="${inputValue(item.url)}" maxlength="240" placeholder="https://github.com/..." /></label>
        <label class="field full"><span>Description <small>stack + what you built + outcome</small></span><textarea data-collection="projects" data-id="${escapeHtml(item.id)}" data-key="description" maxlength="800" placeholder="Built a full-stack AI chat platform with React, Node.js and PostgreSQL; implemented file uploads, history and containerized deployment.">${escapeHtml(item.description || '')}</textarea></label>
      </div></div>
    </article>`;
  }

  if (type === 'certifications') {
    return `<article class="repeat-card compact-card" data-id="${escapeHtml(item.id)}">
      <div class="repeat-card-header"><span class="repeat-card-title">Certification ${index + 1}</span><div class="card-actions">${remove}</div></div>
      <div class="repeat-card-body"><div class="form-grid two-col">
        <label class="field"><span>Certification</span><input data-collection="certifications" data-id="${escapeHtml(item.id)}" data-key="name" value="${inputValue(item.name)}" maxlength="160" placeholder="AWS Certified Cloud Practitioner" /></label>
        <label class="field"><span>Issuer / Year</span><input data-collection="certifications" data-id="${escapeHtml(item.id)}" data-key="issuer" value="${inputValue(item.issuer)}" maxlength="140" placeholder="Amazon Web Services · 2026" /></label>
      </div></div>
    </article>`;
  }

  return `<article class="repeat-card compact-card" data-id="${escapeHtml(item.id)}">
    <div class="repeat-card-header"><span class="repeat-card-title">Achievement ${index + 1}</span><div class="card-actions">${remove}</div></div>
    <div class="repeat-card-body"><div class="form-grid">
      <label class="field"><span>Achievement</span><input data-collection="achievements" data-id="${escapeHtml(item.id)}" data-key="text" value="${inputValue(item.text)}" maxlength="240" placeholder="Won 2nd place in a national software engineering competition" /></label>
    </div></div>
  </article>`;
}

function emptyCollection(title, copy) {
  return `<div class="tip-box"><span class="tip-icon">＋</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div></div>`;
}

function renderCollections() {
  els.experienceList.innerHTML = data.experience.length ? data.experience.map((x,i) => cardTemplate('experience',x,i)).join('') : emptyCollection('No experience yet','Add your most recent role, internship or freelance engagement.');
  els.educationList.innerHTML = data.education.length ? data.education.map((x,i) => cardTemplate('education',x,i)).join('') : emptyCollection('No education yet','Add your degree, bootcamp or relevant study.');
  els.projectsList.innerHTML = data.projects.length ? data.projects.map((x,i) => cardTemplate('projects',x,i)).join('') : emptyCollection('No projects yet','Add 1–3 projects that prove your technical or business impact.');
  els.certificationList.innerHTML = data.certifications.length ? data.certifications.map((x,i) => cardTemplate('certifications',x,i)).join('') : emptyCollection('No certifications yet','Optional: add certifications that support the target role.');
  els.achievementList.innerHTML = data.achievements.length ? data.achievements.map((x,i) => cardTemplate('achievements',x,i)).join('') : emptyCollection('No achievements yet','Optional: add measurable awards, competitions or leadership evidence.');
  populateBulletExperienceSelect();
}

function bindStaticForm() {
  const ids = ['fullName','headline','email','phone','location','summary','skills','linkedin','github','website'];
  for (const id of ids) {
    const node = $(id);
    if (!node) continue;
    node.value = data[id] || '';
    node.addEventListener('input', (event) => {
      data[id] = event.target.value;
      updateUI();
      scheduleSave();
    });
  }
  $('summary').addEventListener('input', updateSummaryCount);
  $('showPhoto').checked = data.showPhoto;
  $('compactSpacing').checked = data.compactSpacing;
  $('showPhoto').addEventListener('change', e => { data.showPhoto = e.target.checked; updateUI(); scheduleSave(); });
  $('compactSpacing').addEventListener('change', e => { data.compactSpacing = e.target.checked; updateUI(); scheduleSave(); });
  $('jobDescription').addEventListener('input', () => {
    renderJobMatcher();
    renderAnalysis();
  });
}

function bindSectionTabs() {
  document.querySelectorAll('.section-tab').forEach(button => {
    button.addEventListener('click', () => activateSection(button.dataset.target));
  });
}

function activateSection(targetId) {
  document.querySelectorAll('.section-tab').forEach(b => b.classList.toggle('is-active', b.dataset.target === targetId));
  document.querySelectorAll('.editor-section').forEach(s => s.classList.toggle('is-active', s.id === targetId));
  if (targetId === 'analyzerSection') renderAnalysis();
}

function bindCollectionEvents() {
  document.addEventListener('input', event => {
    const field = event.target.closest('[data-collection][data-id][data-key]');
    if (!field) return;
    const collection = field.dataset.collection;
    const item = data[collection]?.find(entry => entry.id === field.dataset.id);
    if (!item) return;
    item[field.dataset.key] = field.value;
    updateUI();
    scheduleSave();
    if (lastAnalysis) renderAnalysis();
  });

  document.addEventListener('click', event => {
    const remove = event.target.closest('[data-remove][data-id]');
    if (!remove) return;
    const collection = remove.dataset.remove;
    data[collection] = data[collection].filter(item => item.id !== remove.dataset.id);
    renderCollections();
    updateUI();
    scheduleSave();
    if (lastAnalysis) renderAnalysis();
  });
}

function addItem(collection) {
  const base = collection === 'experience'
    ? { id: uid('exp'), role:'', company:'', start:'', end:'', location:'', bullets:'' }
    : collection === 'education'
      ? { id: uid('edu'), degree:'', school:'', year:'', details:'' }
      : collection === 'projects'
        ? { id: uid('proj'), name:'', url:'', description:'' }
        : collection === 'certifications'
          ? { id: uid('cert'), name:'', issuer:'' }
          : { id: uid('ach'), text:'' };
  data[collection].push(base);
  renderCollections();
  updateUI();
  scheduleSave();
}

function setupPhoto() {
  const input = $('photoInput');
  const stage = $('previewStage');
  const paper = $('resumePaper');

  const acceptImageFile = (file, successMessage = 'Profile photo added.') => {
    if (!file) return false;
    if (!String(file.type || '').startsWith('image/')) {
      toast('Drop an image file such as JPG, PNG or WebP.');
      return false;
    }
    if (file.size > 2_500_000) {
      toast('Photo is too large. Keep it under 2.5 MB.');
      return false;
    }

    const reader = new FileReader();
    reader.onload = () => {
      data.photo = reader.result;
      data.showPhoto = true;
      $('showPhoto').checked = true;
      updateUI();
      scheduleSave();
      toast(successMessage);
    };
    reader.onerror = () => toast('The image could not be read. Try another file.');
    reader.readAsDataURL(file);
    return true;
  };

  input.addEventListener('change', event => {
    const file = event.target.files?.[0];
    acceptImageFile(file);
    input.value = '';
  });

  $('removePhotoBtn').addEventListener('click', () => {
    data.photo = '';
    data.showPhoto = false;
    $('showPhoto').checked = false;
    updateUI();
    scheduleSave();
    toast('Profile photo removed.');
  });

  // Drag an image from the desktop and drop it directly on the A4 resume.
  if (stage) {
    let dragDepth = 0;
    const hasImageFiles = event => Array.from(event.dataTransfer?.items || []).some(item => item.kind === 'file' && String(item.type || '').startsWith('image/'));

    stage.addEventListener('dragenter', event => {
      if (!hasImageFiles(event)) return;
      event.preventDefault();
      dragDepth += 1;
      stage.classList.add('is-dragging');
      paper?.classList.add('is-drop-target');
    });

    stage.addEventListener('dragover', event => {
      if (!hasImageFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      stage.classList.add('is-dragging');
      paper?.classList.add('is-drop-target');
    });

    stage.addEventListener('dragleave', event => {
      if (!hasImageFiles(event)) return;
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) {
        stage.classList.remove('is-dragging');
        paper?.classList.remove('is-drop-target');
      }
    });

    stage.addEventListener('drop', event => {
      if (!hasImageFiles(event)) return;
      event.preventDefault();
      dragDepth = 0;
      stage.classList.remove('is-dragging');
      paper?.classList.remove('is-drop-target');
      const file = Array.from(event.dataTransfer?.files || []).find(item => String(item.type || '').startsWith('image/'));
      acceptImageFile(file, 'Profile photo dropped onto your A4 resume.');
    });
  }
}

function updatePhoto() {
  if (data.photo) {
    els.photoPreview.innerHTML = `<img src="${escapeHtml(data.photo)}" alt="Profile preview" />`;
    els.resumePhoto.innerHTML = `<img src="${escapeHtml(data.photo)}" alt="Profile photo" />`;
  } else {
    els.photoPreview.innerHTML = '<span>Photo</span>';
    els.resumePhoto.innerHTML = '<span>Photo</span>';
  }
  els.resumePhoto.style.display = data.showPhoto && data.photo ? 'flex' : 'none';
}

function renderPreview() {
  els.previewName.textContent = data.fullName.trim() || 'Your Name';
  els.previewHeadline.textContent = data.headline.trim() || 'Your Professional Title';

  const contacts = [];
  if (data.email.trim()) contacts.push(`<a href="mailto:${escapeHtml(data.email.trim())}">${escapeHtml(data.email.trim())}</a>`);
  if (data.phone.trim()) contacts.push(`<span>${escapeHtml(data.phone.trim())}</span>`);
  if (data.location.trim()) contacts.push(`<span>${escapeHtml(data.location.trim())}</span>`);
  els.previewContacts.innerHTML = contacts.join('<span aria-hidden="true">·</span>') || '<span>Email · Phone · Location</span>';

  const summary = data.summary.trim();
  $('previewSummarySection').style.display = summary ? '' : 'none';
  els.previewSummary.textContent = summary;

  renderSkillsPreview();
  renderExperiencePreview();
  renderProjectsPreview();
  renderEducationPreview();
  renderCertificationPreview();
  renderAchievementPreview();
  renderLinksPreview();

  els.paper.classList.remove('template-modern','template-classic','template-compact');
  els.paper.classList.add(`template-${data.template}`);
  els.paper.classList.toggle('compact-spacing', data.compactSpacing);
  document.documentElement.style.setProperty('--accent', data.accent);
}

function renderExperiencePreview() {
  const items = data.experience.filter(item => item.role || item.company || item.bullets);
  $('previewExperienceSection').style.display = items.length ? '' : 'none';
  els.previewExperience.innerHTML = items.map(item => {
    const bullets = String(item.bullets || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean);
    return `<article class="resume-entry">
      <div class="entry-top"><div><div class="entry-role">${escapeHtml(item.role || 'Role')}</div><div class="entry-company">${escapeHtml(item.company || 'Company')}</div></div><span class="entry-date">${escapeHtml([item.start,item.end].filter(Boolean).join(' – '))}</span></div>
      ${item.location ? `<div class="entry-location">${escapeHtml(item.location)}</div>` : ''}
      ${bullets.length ? `<ul class="entry-bullets">${bullets.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
    </article>`;
  }).join('');
}

function renderEducationPreview() {
  const items = data.education.filter(item => item.degree || item.school || item.year || item.details);
  $('previewEducationSection').style.display = items.length ? '' : 'none';
  els.previewEducation.innerHTML = items.map(item => `<article class="resume-entry">
    <div class="entry-top"><div><div class="entry-role">${escapeHtml(item.degree || 'Degree / Program')}</div><div class="entry-company">${escapeHtml(item.school || 'School')}</div></div><span class="entry-date">${escapeHtml(item.year || '')}</span></div>
    ${item.details ? `<p class="entry-description">${escapeHtml(item.details)}</p>` : ''}
  </article>`).join('');
}

function renderProjectsPreview() {
  const items = data.projects.filter(item => item.name || item.description || item.url);
  $('previewProjectsSection').style.display = items.length ? '' : 'none';
  els.previewProjects.innerHTML = items.map(item => {
    const url = safeUrl(item.url);
    return `<article class="resume-entry">
      <div class="entry-top"><div class="entry-role">${escapeHtml(item.name || 'Project')}</div>${url ? `<a class="entry-date" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(formatUrlForLabel(item.url))}</a>` : ''}</div>
      ${item.description ? `<p class="entry-description">${escapeHtml(item.description)}</p>` : ''}
    </article>`;
  }).join('');
}

function renderSkillsPreview() {
  const skills = parseSkills();
  $('previewSkillsSection').style.display = skills.length ? '' : 'none';
  els.previewSkills.innerHTML = skills.map(skill => `<span class="resume-skill">${escapeHtml(skill)}</span>`).join('');
  els.skillChips.innerHTML = skills.length ? skills.map(skill => `<span class="skill-chip">${escapeHtml(skill)}</span>`).join('') : '<span class="resume-empty">Add relevant skills as comma-separated values.</span>';
}

function renderCertificationPreview() {
  const items = data.certifications.filter(item => item.name || item.issuer);
  $('previewCertificationSection').style.display = items.length ? '' : 'none';
  els.previewCertifications.innerHTML = items.map(item => `<article class="resume-entry compact-entry"><div class="entry-top"><div><div class="entry-role">${escapeHtml(item.name || 'Certification')}</div><div class="entry-company">${escapeHtml(item.issuer || '')}</div></div></div></article>`).join('');
}

function renderAchievementPreview() {
  const items = data.achievements.filter(item => item.text);
  $('previewAchievementSection').style.display = items.length ? '' : 'none';
  els.previewAchievements.innerHTML = items.map(item => `<article class="resume-entry compact-entry"><ul class="entry-bullets"><li>${escapeHtml(item.text)}</li></ul></article>`).join('');
}

function renderLinksPreview() {
  const links = [
    ['LinkedIn', data.linkedin],
    ['GitHub', data.github],
    ['Portfolio', data.website]
  ].map(([label,url]) => ({ label, url:safeUrl(url) })).filter(item => item.url);
  $('previewLinksSection').style.display = links.length ? '' : 'none';
  els.previewLinks.innerHTML = links.map(item => `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${item.label} · ${escapeHtml(formatUrlForLabel(item.url))}</a>`).join('');
}

function parseSkills() {
  return [...new Set(data.skills.split(',').map(v => v.trim()).filter(Boolean))];
}

function updateSummaryCount() {
  els.summaryCount.textContent = `${$('summary').value.length} / 500`;
}

function updateCompletion() {
  const checks = [
    ['fullName',18], ['headline',12], ['email',10], ['location',7], ['summary',16],
    ['experience',15], ['education',8], ['skills',8], ['links',6]
  ];
  let score = 0;
  for (const [key,weight] of checks) {
    let complete = false;
    if (key === 'experience') complete = data.experience.some(x => x.role && x.company && x.bullets);
    else if (key === 'education') complete = data.education.some(x => x.degree && x.school);
    else if (key === 'skills') complete = parseSkills().length > 0;
    else if (key === 'links') complete = [data.linkedin,data.github,data.website].some(v => v.trim());
    else complete = String(data[key] || '').trim().length > 0;
    if (complete) score += weight;
  }
  score = Math.min(100,score);
  els.completionPercent.textContent = `${score}%`;
  els.completionBar.style.width = `${score}%`;
  els.completionHint.textContent = score >= 90 ? 'Strong completeness. Use Analyze for evidence and ATS checks.'
    : score >= 70 ? 'Good foundation. Add measurable impact and proof links.'
    : score >= 40 ? 'Good start. Fill the highest-value sections next.'
    : 'Start with your name, headline and contact details.';
}

function updateUI() {
  renderPreview();
  updatePhoto();
  updateCompletion();
  updateSummaryCount();
  syncDesignControls();
  if (lastAnalysis) renderAnalysis();
}

function syncDesignControls() {
  document.querySelectorAll('.template-option').forEach(btn => btn.classList.toggle('is-selected', btn.dataset.template === data.template));
  document.querySelectorAll('.accent-swatch').forEach(btn => btn.classList.toggle('is-selected', btn.dataset.accent.toLowerCase() === data.accent.toLowerCase()));
}

function toast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function setupDesignControls() {
  document.querySelectorAll('.template-option').forEach(btn => btn.addEventListener('click', () => {
    data.template = btn.dataset.template; updateUI(); scheduleSave();
  }));
  document.querySelectorAll('.accent-swatch').forEach(btn => btn.addEventListener('click', () => {
    data.accent = btn.dataset.accent; updateUI(); scheduleSave();
  }));
}

function setZoom(nextZoom) {
  zoom = Math.max(55, Math.min(120, nextZoom));
  els.zoomValue.textContent = `${zoom}%`;
  document.documentElement.style.setProperty('--paper-scale', String(zoom / 100));
}

function bindActions() {
  $('addExperienceBtn').addEventListener('click', () => { addItem('experience'); activateSection('experienceSection'); });
  $('addEducationBtn').addEventListener('click', () => { addItem('education'); activateSection('educationSection'); });
  $('addProjectBtn').addEventListener('click', () => { addItem('projects'); activateSection('projectsSection'); });
  $('addCertificationBtn').addEventListener('click', () => { addItem('certifications'); activateSection('credentialsSection'); });
  $('addAchievementBtn').addEventListener('click', () => { addItem('achievements'); activateSection('credentialsSection'); });

  $('newResumeBtn').addEventListener('click', () => {
    if (!window.confirm('Start a new resume? Export the current JSON first if you may need it later.')) return;
    data = deepClone(starterData);
    lastAnalysis = null;
    bindAllFormValues(); renderCollections(); updateUI(); renderAnalysis(); saveData(); toast('New resume started.');
  });

  $('exportBtn').addEventListener('click', () => {
    const payload = JSON.stringify({ ...data, exportedAt: new Date().toISOString(), app: 'ResumeCraft' }, null, 2);
    const blob = new Blob([payload], { type:'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${slugify(data.fullName || 'resume')}-resumecraft.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 0);
    toast('Resume data exported.');
  });

  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        data = normalizeData(JSON.parse(reader.result));
        lastAnalysis = null;
        bindAllFormValues(); renderCollections(); updateUI(); renderAnalysis(); saveData(); toast('Resume imported successfully.');
      } catch {
        toast('That file is not valid ResumeCraft JSON.');
      } finally { event.target.value = ''; }
    };
    reader.readAsText(file);
  });

  $('printBtn').addEventListener('click', () => window.print());
  $('zoomOutBtn').addEventListener('click', () => setZoom(zoom - 5));
  $('zoomInBtn').addEventListener('click', () => setZoom(zoom + 5));
  $('runAnalysisBtn').addEventListener('click', () => { lastAnalysis = analyzeResume(); renderAnalysis(); toast('Resume analyzed.'); });
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'resume';
}

function bindAllFormValues() {
  for (const id of ['fullName','headline','email','phone','location','summary','skills','linkedin','github','website']) if ($(id)) $(id).value = data[id] || '';
  $('showPhoto').checked = data.showPhoto;
  $('compactSpacing').checked = data.compactSpacing;
}

function resumeText() {
  const sections = [
    data.fullName, data.headline, data.email, data.phone, data.location, data.summary,
    data.skills, ...data.experience.flatMap(x => [x.role,x.company,x.start,x.end,x.location,x.bullets]),
    ...data.projects.flatMap(x => [x.name,x.description,x.url]),
    ...data.education.flatMap(x => [x.degree,x.school,x.year,x.details]),
    ...data.certifications.flatMap(x => [x.name,x.issuer]),
    ...data.achievements.map(x => x.text),
    data.linkedin, data.github, data.website
  ];
  return sections.filter(Boolean).join('\n');
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/[“”‘’]/g,'').replace(/[^\p{L}\p{N}+#./-]/gu,'');
}

function extractKeywords(text) {
  const raw = String(text || '').toLowerCase();
  const special = TECH_TERMS.filter(term => raw.includes(term));
  const words = raw.split(/\s+/)
    .map(normalizeWord)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  const frequent = {};
  words.forEach(w => { frequent[w] = (frequent[w] || 0) + 1; });
  const topWords = Object.entries(frequent).sort((a,b) => b[1] - a[1]).slice(0, 40).map(([w]) => w);
  return [...new Set([...special, ...topWords])].slice(0, 50);
}

function countMetrics(text) {
  const matches = String(text || '').match(/(?:\b\d+(?:\.\d+)?\s*[%+]?|\$\s?\d[\d,.]*|\b\d+\s*(?:k|m|hours?|days?|weeks?|months?|years?|users?|records?|requests?|endpoints?|services?|engineers?|projects?|clients?)\b)/gi);
  return new Set((matches || []).map(x => x.toLowerCase().trim())).size;
}

function hasActionVerb(text) {
  const first = normalizeWord(String(text || '').trim().split(/\s+/)[0] || '');
  return ACTION_VERBS.has(first) || ACTION_VERBS.has(first.replace(/ed$/,''));
}

function evidenceScore() {
  const bullets = data.experience.flatMap(x => String(x.bullets || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean));
  if (!bullets.length) return { score:0, bullets:0, metrics:0, verbs:0, tech:0 };
  const verbs = bullets.filter(hasActionVerb).length;
  const metrics = bullets.filter(b => countMetrics(b) > 0).length;
  const techWords = new Set(parseSkills().map(x => x.toLowerCase()));
  const tech = bullets.filter(b => [...techWords].some(t => t && b.toLowerCase().includes(t))).length;
  const avgLen = bullets.reduce((a,b) => a + b.length,0) / bullets.length;
  let score = (verbs / bullets.length) * 35 + (metrics / bullets.length) * 40 + (tech / bullets.length) * 15;
  if (avgLen >= 55 && avgLen <= 190) score += 10;
  return { score:Math.min(100,Math.round(score)), bullets:bullets.length, metrics, verbs, tech };
}

function analyzeResume() {
  const text = resumeText();
  const skills = parseSkills();
  const bulletsInfo = evidenceScore();
  const jobText = $('jobDescription').value.trim();
  const jobKeywords = extractKeywords(jobText);
  const lowerResume = text.toLowerCase();

  const matched = jobKeywords.filter(k => lowerResume.includes(k.toLowerCase()));
  const missing = jobKeywords.filter(k => !lowerResume.includes(k.toLowerCase()));

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim());
  const linkCount = [data.linkedin,data.github,data.website].filter(v => safeUrl(v)).length;
  const standardSections = [data.summary,data.skills,data.experience.length,data.projects.length,data.education.length].filter(Boolean).length;
  const dateFields = data.experience.flatMap(x => [x.start,x.end]).filter(Boolean);
  const hasFourDigitDates = dateFields.filter(x => /\b20\d{2}\b/.test(x)).length;
  const hasBadUrls = [data.linkedin,data.github,data.website,...data.projects.map(x=>x.url)].filter(v => v.trim() && !safeUrl(v)).length;

  const relevance = jobText
    ? Math.round(Math.min(100, (matched.length / Math.max(jobKeywords.length,1)) * 80 + (data.headline.trim() ? 20 : 0)))
    : Math.round(Math.min(100, (data.headline ? 30 : 0) + Math.min(50, skills.length * 5) + (data.experience.length || data.projects.length ? 20 : 0)));

  const ats = Math.round(Math.min(100,
    (standardSections / 5) * 35 +
    (data.fullName ? 15 : 0) +
    (emailOk ? 15 : 0) +
    (data.headline ? 10 : 0) +
    (data.showPhoto ? 0 : 15) +
    (hasBadUrls ? 0 : 10)
  ));

  const impact = bulletsInfo.score;
  const skillsScore = jobText
    ? Math.round(Math.min(100, Math.min(70, (matched.length / Math.max(jobKeywords.length,1)) * 70) + Math.min(30, skills.length * 3)))
    : Math.round(Math.min(100, (skills.length ? 30 : 0) + Math.min(70, skills.length * 7)));
  const projectsScore = Math.round(Math.min(100,
    data.projects.length ? Math.min(60, data.projects.length * 20) + Math.min(40, data.projects.filter(p => p.description && p.description.length >= 60 && (countMetrics(p.description) || TECH_TERMS.some(t => p.description.toLowerCase().includes(t)))).length * 20) : 0
  ));
  const summaryLen = data.summary.trim().length;
  const summaryScore = Math.round(Math.min(100, (summaryLen >= 70 ? 55 : summaryLen >= 45 ? 35 : 10) + (TECH_TERMS.some(t => data.summary.toLowerCase().includes(t)) ? 20 : 0) + (countMetrics(data.summary) ? 15 : 0) + (data.headline && data.summary.toLowerCase().includes(data.headline.toLowerCase().split(/\s+/)[0]) ? 10 : 0)));
  const sentenceLengths = data.summary.split(/[.!?]+/).map(x => x.trim()).filter(Boolean).map(x => x.length);
  const avgBulletLen = bulletsInfo.bullets ? data.experience.flatMap(x => x.bullets.split(/\r?\n/).filter(Boolean)).reduce((a,b)=>a+b.trim().length,0) / bulletsInfo.bullets : 0;
  const readability = Math.round(Math.min(100,
    (avgBulletLen ? (avgBulletLen >= 55 && avgBulletLen <= 190 ? 50 : 25) : 20) +
    (sentenceLengths.every(n => n <= 230) ? 25 : 10) +
    (text.length <= 6500 ? 25 : 10)
  ));
  const structure = Math.round((data.fullName ? 20 : 0) + (data.headline ? 20 : 0) + (emailOk ? 15 : 0) + (standardSections >= 3 ? 25 : standardSections * 7) + (data.experience.length || data.projects.length || data.education.length ? 20 : 0));
  const education = data.education.some(x => x.degree && x.school) ? 100 : 0;
  const certifications = data.certifications.some(x => x.name) ? 100 : 0;
  const links = Math.min(100, linkCount * 35 + (emailOk ? 30 : 0));
  const consistency = Math.max(0, Math.round(
    (hasBadUrls ? 0 : 35) +
    (data.skills.split(',').length === skills.length ? 15 : 0) +
    (dateFields.length === 0 ? 20 : hasFourDigitDates === dateFields.length ? 20 : 10) +
    (text.length > 0 ? 30 : 0)
  ));

  const values = { relevance, ats, impact, skills:skillsScore, projects:projectsScore, summary:summaryScore, readability, structure, education, certifications, links, consistency };
  const total = Object.entries(SCORE_WEIGHTS).reduce((sum,[key,weight]) => sum + (values[key] / 100) * weight, 0);

  return {
    total:Math.round(total),
    values,
    matched,
    missing,
    jobKeywordCount:jobKeywords.length,
    bulletsInfo,
    emailOk,
    linkCount,
    hasBadUrls,
    jobText:!!jobText
  };
}

function scoreLabel(score) {
  if (score >= 90) return ['Excellent foundation','Strong evidence and structure. Proofread claims before sending.'];
  if (score >= 75) return ['Strong foundation','A few targeted improvements can make the evidence sharper.'];
  if (score >= 60) return ['Solid starting point','Use the checks below to strengthen relevance and impact.'];
  if (score >= 40) return ['Needs more evidence','Add role-specific keywords, outcomes and proof.'];
  return ['Early draft','Build the core sections first, then run the analyzer again.'];
}

function scoreTone(score) {
  return score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad';
}

function renderAnalysis() {
  if (!lastAnalysis) {
    const blank = { total:0, values:Object.fromEntries(Object.keys(SCORE_WEIGHTS).map(k=>[k,0])), matched:[], missing:[], jobKeywordCount:0, bulletsInfo:{score:0,bullets:0,metrics:0,verbs:0,tech:0}, emailOk:false, linkCount:0, hasBadUrls:false, jobText:!!$('jobDescription').value.trim() };
    lastAnalysis = blank;
  }
  const a = lastAnalysis;
  $('overallScore').textContent = a.total;
  $('overallScore').style.background = `conic-gradient(var(--accent) ${a.total * 3.6}deg, #e9e7f2 0deg)`;
  $('analysisHero').className = `analyzer-hero ${scoreTone(a.total)}`;
  const [title, subtitle] = scoreLabel(a.total);
  $('analysisTitle').textContent = title;
  $('analysisSubtitle').textContent = subtitle;

  const meta = {
    relevance:['Job Relevance','Exact-role alignment and keyword coverage'],
    ats:['ATS Compatibility','Standard headings, parseable structure and export hygiene'],
    impact:['Experience & Impact','Action verbs, technology and quantified evidence'],
    skills:['Skills / Keywords','Relevant technical vocabulary and skill coverage'],
    projects:['Projects','Shipped-work evidence, stack and outcomes'],
    summary:['Professional Summary','Focused positioning and role-specific signals'],
    readability:['Readability','Scan speed, bullet length and content density'],
    structure:['Structure','Clear hierarchy and standard resume organization'],
    education:['Education','Degree / school evidence where relevant'],
    certifications:['Certifications','Relevant credential evidence'],
    links:['Links / Contact','Contactability and verification paths'],
    consistency:['Accuracy / Consistency','Date, URL and entry consistency checks']
  };
  $('scoreGrid').innerHTML = Object.entries(SCORE_WEIGHTS).map(([key,weight]) => `<div class="score-card">
    <div class="score-card-top"><div><strong>${meta[key][0]}</strong><span>${meta[key][1]}</span></div><b>${Math.round(a.values[key])}</b></div>
    <div class="score-meter"><span style="width:${Math.round(a.values[key])}%"></span></div>
    <small>${weight}% weight</small>
  </div>`).join('');

  renderATS(a);
  renderJobMatcher(a);
  renderBulletCoach();
}

function renderATS(a) {
  const checks = [
    [!!data.fullName,'Full name is present.','Add the name recruiters should see first.'],
    [a.emailOk,'Email looks valid.','Use a normal, professional email address.'],
    [!!data.headline,'Professional title is present.','Add the target role or clear specialty.'],
    [!data.showPhoto,'No profile photo on the exported resume.','Consider disabling the photo for an ATS-conservative version.'],
    [data.summary.trim().length <= 500,'Summary is within the 500-character editor limit.','Shorten the summary so it stays focused.'],
    [data.experience.flatMap(x=>x.bullets.split(/\r?\n/)).filter(x=>x.trim()).length > 0 || data.projects.some(x=>x.description.trim()),'The resume contains evidence bullets or project descriptions.','Add evidence, not just responsibilities or titles.'],
    [!a.hasBadUrls,'Professional URLs are valid or blank.','Fix malformed URLs before exporting.'],
    [!/[★☆●○■□▣]/.test(resumeText()),'No decorative rating characters were found in content.','Remove decorative rating symbols from important information.']
  ];
  $('atsStatus').textContent = checks.every(x=>x[0]) ? 'ATS ready' : 'Needs review';
  $('atsStatus').className = `check-pill ${checks.every(x=>x[0]) ? 'good' : 'warn'}`;
  $('atsChecklist').innerHTML = checks.map(([ok,good,bad]) => `<div class="check-item ${ok ? 'pass' : 'warn'}"><span>${ok ? '✓' : '!'}</span><div>${escapeHtml(ok ? good : bad)}</div></div>`).join('');
}

function renderJobMatcher(a) {
  const jobText = $('jobDescription').value.trim();
  if (!jobText) {
    $('matchStatus').textContent = 'Waiting';
    $('matchStatus').className = 'check-pill neutral';
    $('matchSummary').textContent = 'Paste a job description and the analyzer will compare recurring keywords against your resume.';
    $('matchedKeywords').innerHTML = '<span class="keyword-empty">No matched keywords yet.</span>';
    $('missingKeywords').innerHTML = '<span class="keyword-empty">No suggestions yet.</span>';
    return;
  }

  const matched = a.matched || [];
  const missing = a.missing || [];
  const pct = Math.round((matched.length / Math.max(a.jobKeywordCount,1)) * 100);
  $('matchStatus').textContent = `${pct}% keyword coverage`;
  $('matchStatus').className = `check-pill ${pct >= 75 ? 'good' : pct >= 50 ? 'warn' : 'bad'}`;
  $('matchSummary').textContent = `${matched.length} of ${a.jobKeywordCount} extracted keywords appear in the current resume. Use only keywords that honestly describe your experience.`;
  $('matchedKeywords').innerHTML = matched.length ? matched.slice(0,24).map(x=>`<span class="keyword-tag matched">${escapeHtml(x)}</span>`).join('') : '<span class="keyword-empty">None found yet.</span>';
  $('missingKeywords').innerHTML = missing.length ? missing.slice(0,24).map(x=>`<span class="keyword-tag missing">${escapeHtml(x)}</span>`).join('') : '<span class="keyword-empty">No major gaps detected.</span>';
}

function populateBulletExperienceSelect() {
  const select = $('bulletExperienceSelect');
  if (!select) return;
  const current = select.value;
  select.innerHTML = data.experience.length ? data.experience.map((x,i)=>`<option value="${escapeHtml(x.id)}">${escapeHtml((x.role || `Role ${i+1}`) + (x.company ? ` · ${x.company}` : ''))}</option>`).join('') : '<option value="">No experience roles</option>';
  if ([...select.options].some(o => o.value === current)) select.value = current;
  select.onchange = renderBulletCoach;
}

function improveBullet(bullet) {
  const original = bullet.trim();
  if (!original) return '';
  const first = normalizeWord(original.split(/\s+/)[0] || '');
  const hasVerb = hasActionVerb(original);
  const hasMetric = countMetrics(original) > 0;
  const matchedTech = TECH_TERMS.find(t => original.toLowerCase().includes(t));
  const clauses = [];
  if (!hasVerb) clauses.push('Start with a strong action verb such as Built, Developed, Designed, Implemented or Optimized');
  if (!matchedTech) clauses.push('name the main technology used');
  if (!hasMetric) clauses.push('add the measurable result, such as time saved, users served, performance improved or cost reduced');
  if (!clauses.length) return { original, suggestion: original, status:'Strong signal set', details:'Already contains an action verb, technology signal and a measurable value.' };

  let prefix = hasVerb ? original : `Developed ${original.charAt(0).toLowerCase()}${original.slice(1)}`;
  const suggestion = `${prefix} — ${clauses.join('; ')}.`;
  return { original, suggestion, status:'Improve evidence', details:hasMetric ? 'Metric detected.' : 'No metric detected; use a verified number if one exists.' };
}

function renderBulletCoach() {
  const select = $('bulletExperienceSelect');
  const id = select?.value;
  const role = data.experience.find(x => x.id === id);
  if (!role || !String(role.bullets || '').trim()) {
    $('bulletCoachList').innerHTML = '<div class="empty-analysis">Add an experience role with bullets to get rewrite guidance.</div>';
    return;
  }
  const bullets = role.bullets.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  $('bulletCoachList').innerHTML = bullets.map((b,i)=>{
    const improved = improveBullet(b);
    return `<article class="bullet-coach-item">
      <div class="bullet-number">${i+1}</div>
      <div class="bullet-content">
        <span class="coach-label">Current</span><p>${escapeHtml(improved.original)}</p>
        <span class="coach-label accent-label">Suggested</span><p class="suggested-text">${escapeHtml(improved.suggestion)}</p>
        <small>${escapeHtml(improved.details)}</small>
      </div>
      <button class="mini-btn copy" type="button" data-copy="${escapeHtml(improved.suggestion)}" aria-label="Copy suggestion">↗</button>
    </article>`;
  }).join('');
}

document.addEventListener('click', event => {
  const copyBtn = event.target.closest('[data-copy]');
  if (!copyBtn) return;
  const value = copyBtn.dataset.copy;
  navigator.clipboard?.writeText(value).then(() => toast('Suggestion copied.')).catch(() => toast('Copy is unavailable in this browser.'));
});

function init() {
  bindStaticForm();
  bindSectionTabs();
  bindCollectionEvents();
  setupPhoto();
  setupDesignControls();
  bindActions();
  renderCollections();
  bindAllFormValues();
  updateUI();
  setZoom(zoom);
  renderAnalysis();
}
init();
