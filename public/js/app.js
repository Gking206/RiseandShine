/* ============================================================
   RISE AND SHINE — Frontend Core v1.0
   ============================================================ */

'use strict';

// ── 1. Configuration ──────────────────────────────────────
const RAS = {
  version: '1.0.0',
  baseUrl: '/api',
  currentUser: null,
  notifInterval: null,
};

// ── 2. API Client ──────────────────────────────────────────
const API = {
  async request(method, path, body = null, isForm = false) {
    const opts = {
      method,
      credentials: 'include',
      headers: {},
    };

    if (body && !isForm) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body && isForm) {
      opts.body = body;
    }

    let res;
    try {
      res = await fetch(RAS.baseUrl + path, opts);
    } catch (err) {
      return { ok: false, status: 0, data: { success: false, message: 'Erreur de connexion au serveur.' } };
    }
    try {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } catch {
      // Réponse non JSON (ex. page d'erreur du proxy de l'hébergeur)
      return { ok: false, status: res.status, data: { success: false, message: `Erreur serveur (${res.status}).` } };
    }
  },

  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  put: (path, body) => API.request('PUT', path, body),
  delete: (path) => API.request('DELETE', path),
};

// ── 3. Auth Module ─────────────────────────────────────────
const Auth = {
  async check() {
    // Réessayer en cas d'erreur réseau ou serveur momentanée (redémarrage,
    // limite de requêtes) : seule une réponse 401 signifie « non connecté ».
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await API.get('/auth/me');
      if (res.ok && res.data.success) {
        RAS.currentUser = res.data.user;
        return res.data.user;
      }
      if (res.status === 401 || res.status === 403) return null;
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
    return null;
  },

  async login(email, password) {
    return API.post('/auth/login', { email, password });
  },

  async register(data) {
    return API.post('/auth/register', data);
  },

  async logout() {
    await API.post('/auth/logout');
    RAS.currentUser = null;
    window.location.href = '/login.html';
  },

  requireAuth() {
    if (!RAS.currentUser) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  hasRole(role) {
    if (!RAS.currentUser) return false;
    if (role === 'super_admin') return RAS.currentUser.role === 'super_admin';
    if (role === 'admin') return ['super_admin', 'admin'].includes(RAS.currentUser.role);
    return true;
  },

  redirectIfLoggedIn() {
    if (RAS.currentUser) window.location.href = '/dashboard.html';
  },
};

// ── 4. Toast Notifications ────────────────────────────────
const Toast = {
  container: null,

  init() {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'toast-container';
      this.container.id = 'toastContainer';
      document.body.appendChild(this.container);
    }
  },

  show(message, type = 'info', duration = 4000) {
    this.init();
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: '✨' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || '💬'}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease reverse';
        setTimeout(() => toast.remove(), 280);
      }, duration);
    }

    return toast;
  },

  success: (msg, dur) => Toast.show(msg, 'success', dur),
  error: (msg, dur) => Toast.show(msg, 'error', dur),
  warning: (msg, dur) => Toast.show(msg, 'warning', dur),
  info: (msg, dur) => Toast.show(msg, 'info', dur),
};

// ── 5. Modal System ───────────────────────────────────────
const Modal = {
  active: null,

  open(id) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById(id);
    if (!overlay || !modal) return;
    overlay.classList.add('active');
    modal.classList.remove('hidden');
    this.active = id;
    document.body.style.overflow = 'hidden';
  },

  close(id) {
    const overlay = document.getElementById('modalOverlay');
    if (id) {
      const modal = document.getElementById(id);
      if (modal) modal.classList.add('hidden');
    } else {
      document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    }
    if (overlay) overlay.classList.remove('active');
    this.active = null;
    document.body.style.overflow = '';
  },

  confirm(message, onConfirm, options = {}) {
    const { title = 'Confirmation', confirmText = 'Confirmer', danger = false } = options;
    const existingModal = document.getElementById('confirmModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'confirmModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" onclick="Modal.close('confirmModal')">×</button>
      </div>
      <div class="modal-body">
        <p style="color: var(--text-secondary);">${message}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close('confirmModal')">Annuler</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmBtn">${confirmText}</button>
      </div>
    `;

    let overlay = document.getElementById('modalOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.id = 'modalOverlay';
      document.body.appendChild(overlay);
    }
    overlay.appendChild(modal);

    document.getElementById('confirmBtn').addEventListener('click', () => {
      Modal.close('confirmModal');
      onConfirm();
    });

    this.open('confirmModal');
  },
};

// ── 6. Loader ─────────────────────────────────────────────
const Loader = {
  show(text = 'Chargement...') {
    let overlay = document.getElementById('loadingOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loadingOverlay';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `<div class="spinner"></div><p>${text}</p>`;
      document.body.appendChild(overlay);
    }
  },

  hide() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.remove();
  },

  button(btn, loading = true) {
    if (loading) {
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = '<span class="spinner spinner-sm"></span>';
      btn.disabled = true;
    } else {
      btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
      btn.disabled = false;
    }
  },
};

// ── 7. Sidebar ────────────────────────────────────────────
const Sidebar = {
  init() {
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    if (toggle) toggle.addEventListener('click', () => this.toggle());
    if (overlay) overlay.addEventListener('click', () => this.close());

    this.highlightCurrent();
    this.populateUser();
  },

  toggle() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  },

  close() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  },

  highlightCurrent() {
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-item[href]').forEach(item => {
      if (item.getAttribute('href') === currentPath ||
          (currentPath.endsWith('.html') && item.getAttribute('href') === currentPath)) {
        item.classList.add('active');
      }
    });
  },

  populateUser() {
    if (!RAS.currentUser) return;
    const user = RAS.currentUser;
    const initials = user.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    document.querySelectorAll('.user-display-name').forEach(el => el.textContent = user.nom);
    document.querySelectorAll('.user-display-role').forEach(el => {
      el.textContent = user.role === 'super_admin' ? 'Super Admin' : user.role === 'admin' ? 'Administrateur' : 'Membre';
    });
    document.querySelectorAll('.user-initials').forEach(el => {
      if (user.avatar) {
        el.innerHTML = `<img src="${user.avatar}" alt="${user.nom}">`;
      } else {
        el.textContent = initials;
      }
    });

    // Show/hide admin-only items
    if (user.role === 'membre') {
      document.querySelectorAll('[data-role="admin"]').forEach(el => el.style.display = 'none');
    }
    if (user.role !== 'super_admin') {
      document.querySelectorAll('[data-role="super_admin"]').forEach(el => el.style.display = 'none');
    }
  },
};

// ── 8. Notifications ──────────────────────────────────────
const Notifications = {
  panel: null,
  badge: null,

  async init() {
    this.panel = document.getElementById('notificationsPanel');
    this.badge = document.querySelector('.notification-badge');
    const btn = document.getElementById('notifBtn');
    if (btn) btn.addEventListener('click', () => this.toggle());
    await this.loadCount();
    RAS.notifInterval = setInterval(() => this.loadCount(), 60000);
  },

  async loadCount() {
    const res = await API.get('/notifications');
    if (res.ok && this.badge) {
      const count = res.data.nonLues || 0;
      this.badge.textContent = count > 0 ? count : '';
      this.badge.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  async toggle() {
    if (!this.panel) return;
    if (this.panel.classList.contains('open')) {
      this.panel.classList.remove('open');
    } else {
      await this.load();
      this.panel.classList.add('open');
    }
  },

  async load() {
    if (!this.panel) return;
    const res = await API.get('/notifications');
    if (!res.ok) return;

    const { notifications } = res.data;
    const listEl = this.panel.querySelector('.notif-list');
    if (!listEl) return;

    if (!notifications || notifications.length === 0) {
      listEl.innerHTML = '<div class="empty-state" style="padding: 40px 20px;"><div class="empty-state-icon">🔔</div><p>Aucune notification</p></div>';
      return;
    }

    listEl.innerHTML = notifications.map(n => `
      <div class="notif-item ${!n.lu ? 'unread' : ''}" onclick="Notifications.markRead('${n.id}', this)">
        ${!n.lu ? '<div class="notif-dot"></div>' : '<div style="width:8px"></div>'}
        <div>
          <p style="font-size:0.85rem;color:var(--text-primary);margin-bottom:2px;">${n.message}</p>
          <span class="text-xs text-muted">${Utils.timeAgo(n.createdAt)}</span>
        </div>
      </div>
    `).join('');
  },

  async markRead(id, el) {
    await API.put(`/notifications/${id}/read`);
    el.classList.remove('unread');
    const dot = el.querySelector('.notif-dot');
    if (dot) dot.style.opacity = '0';
    await this.loadCount();
  },

  async markAllRead() {
    await API.put('/notifications/read-all');
    await this.load();
    await this.loadCount();
    Toast.success('Toutes les notifications marquées comme lues.');
  },
};

// ── 9. Utilities ──────────────────────────────────────────
const Utils = {
  timeAgo(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'À l\'instant';
    if (mins < 60) return `Il y a ${mins} min`;
    if (hours < 24) return `Il y a ${hours}h`;
    if (days < 7) return `Il y a ${days} jours`;
    return date.toLocaleDateString('fr-FR');
  },

  formatDate(dateStr, options = {}) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const defaultOpts = { day: '2-digit', month: 'long', year: 'numeric', ...options };
    return date.toLocaleDateString('fr-FR', defaultOpts);
  },

  formatCurrency(amount, currency = 'FCFA') {
    if (amount === null || amount === undefined) return '—';
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;
  },

  getInitials(name) {
    return (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  },

  debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  countdown(targetDate) {
    const target = new Date(targetDate);
    const now = new Date();
    const diff = target - now;
    if (diff <= 0) return 'Terminé';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (days > 0) return `Dans ${days}j ${hours}h`;
    if (hours > 0) return `Dans ${hours}h ${mins}min`;
    return `Dans ${mins}min`;
  },

  statusBadge(status) {
    const map = {
      actif: ['badge-green', '●', 'Actif'],
      inactif: ['badge-gray', '●', 'Inactif'],
      en_attente: ['badge-orange', '⏳', 'En attente'],
      approuve: ['badge-green', '✓', 'Approuvé'],
      rejete: ['badge-red', '✗', 'Rejeté'],
      nouveau: ['badge-blue', '★', 'Nouveau'],
      en_suivi: ['badge-orange', '👁', 'En suivi'],
      integre: ['badge-gold', '✦', 'Intégré'],
      baptise: ['badge-green', '✝', 'Baptisé'],
      a_venir: ['badge-blue', '📅', 'À venir'],
      en_cours: ['badge-orange', '▶', 'En cours'],
      termine: ['badge-gray', '✓', 'Terminé'],
      annule: ['badge-red', '✗', 'Annulé'],
      'en_attente': ['badge-orange', '⏳', 'En attente'],
      'approuve': ['badge-green', '✓', 'Approuvé'],
      don: ['badge-green', '💝', 'Don'],
      offrande: ['badge-gold', '🙏', 'Offrande'],
      depense: ['badge-red', '💸', 'Dépense'],
      budget_evenement: ['badge-purple', '🎪', 'Budget Événement'],
      // Catégories d'événement
      public: ['badge-green', '🌍', 'Public'],
      interne: ['badge-blue', '🏠', 'Interne'],
      partenaire_externe: ['badge-purple', '🤝', 'Partenaire externe'],
      // Types d'enseignement
      pdf: ['badge-red', '📄', 'PDF'],
      video: ['badge-purple', '🎬', 'Vidéo'],
      audio: ['badge-blue', '🎵', 'Audio'],
      image: ['badge-gold', '🖼', 'Image'],
      lien: ['badge-gray', '🔗', 'Lien'],
      texte: ['badge-gray', '📝', 'Texte'],
    };
    const [cls, icon, label] = map[status] || ['badge-gray', '?', status || '—'];
    return `<span class="badge ${cls}">${icon} ${label}</span>`;
  },

  roleBadge(role) {
    const map = {
      super_admin: ['super_admin', '👑', 'Super Admin'],
      admin: ['admin', '🛡', 'Administrateur'],
      membre: ['membre', '👤', 'Membre'],
    };
    const [cls, icon, label] = map[role] || ['membre', '👤', role];
    return `<span class="role-pill ${cls}">${icon} ${label}</span>`;
  },

  typeIcon(type) {
    const icons = { pdf: '📄', video: '🎬', audio: '🎵', image: '🖼', lien: '🔗', texte: '📝' };
    return icons[type] || '📎';
  },

  categoryLabel(cat) {
    const labels = {
      predication: 'Prédication', etude_biblique: 'Étude Biblique',
      conference: 'Conférence', culte: 'Culte', formation: 'Formation', autre: 'Autre',
      interne: 'Interne', public: 'Public', partenaire_externe: 'Partenaire Externe',
    };
    return labels[cat] || cat;
  },

  paginate(data, page, limit) {
    const total = data.length;
    const pages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    return { items: data.slice(offset, offset + limit), total, pages, page };
  },
};

// ── 10. Charts (Canvas API) ───────────────────────────────
const Charts = {
  drawLine(canvas, labels, datasets, options = {}) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const allValues = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allValues, 1) * 1.1;
    const stepY = chartH / maxVal;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px system-ui';
      ctx.fillText(Math.round(maxVal - (maxVal / gridLines) * i), 5, y + 4);
    }

    // X Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = padding.left + (chartW / (labels.length - 1)) * i;
      ctx.fillText(label, x, height - 5);
    });

    // Lines
    datasets.forEach(dataset => {
      ctx.beginPath();
      ctx.strokeStyle = dataset.color || '#FFD700';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';

      dataset.data.forEach((val, i) => {
        const x = padding.left + (chartW / (labels.length - 1)) * i;
        const y = padding.top + chartH - val * stepY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill
      ctx.beginPath();
      dataset.data.forEach((val, i) => {
        const x = padding.left + (chartW / (labels.length - 1)) * i;
        const y = padding.top + chartH - val * stepY;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.lineTo(padding.left + chartW, padding.top + chartH);
      ctx.lineTo(padding.left, padding.top + chartH);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, (dataset.color || '#FFD700') + '30');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fill();

      // Dots
      ctx.fillStyle = dataset.color || '#FFD700';
      dataset.data.forEach((val, i) => {
        const x = padding.left + (chartW / (labels.length - 1)) * i;
        const y = padding.top + chartH - val * stepY;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      });
    });
  },

  drawDonut(canvas, data, colors, labels) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2, cy = height / 2;
    const radius = Math.min(cx, cy) * 0.8;
    const innerRadius = radius * 0.6;
    const total = data.reduce((s, v) => s + v, 0);
    if (total === 0) return;

    let startAngle = -Math.PI / 2;
    data.forEach((val, i) => {
      const sliceAngle = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i] || '#FFD700';
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Inner circle
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0f';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px system-ui';
    ctx.fillText('Total', cx, cy + 18);
  },

  drawBar(canvas, labels, datasets) {
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const barWidth = (chartW / labels.length) * 0.6;
    const barGap = (chartW / labels.length) * 0.4;

    const allValues = datasets.flatMap(d => d.data);
    const maxVal = Math.max(...allValues, 1) * 1.1;

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px system-ui';
      ctx.fillText(Math.round(maxVal - (maxVal / 5) * i), 5, y + 4);
    }

    const dsCount = datasets.length;
    const dsBarW = barWidth / dsCount;

    datasets.forEach((dataset, di) => {
      dataset.data.forEach((val, i) => {
        const barH = (val / maxVal) * chartH;
        const x = padding.left + i * (barWidth + barGap) + di * dsBarW + barGap / 2;
        const y = padding.top + chartH - barH;
        const grad = ctx.createLinearGradient(0, y, 0, y + barH);
        grad.addColorStop(0, dataset.color || '#FFD700');
        grad.addColorStop(1, (dataset.color || '#FFD700') + '80');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, dsBarW - 2, barH, [4, 4, 0, 0]);
        ctx.fill();
      });
    });

    // X Labels
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    labels.forEach((label, i) => {
      const x = padding.left + i * (barWidth + barGap) + barWidth / 2 + barGap / 2;
      ctx.fillText(label, x, height - 5);
    });
  },

  resizeCanvas(canvas) {
    const parent = canvas.parentElement;
    canvas.width = parent.offsetWidth;
    canvas.height = parent.offsetHeight || 240;
  },
};

// ── 11. Forms Helper ──────────────────────────────────────
const Forms = {
  getData(formEl) {
    const data = {};
    const inputs = formEl.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      if (!input.name) return;
      if (input.type === 'checkbox') data[input.name] = input.checked;
      else if (input.type === 'number') data[input.name] = input.value ? Number(input.value) : null;
      else data[input.name] = input.value;
    });
    return data;
  },

  setData(formEl, data) {
    Object.entries(data).forEach(([key, val]) => {
      const input = formEl.querySelector(`[name="${key}"]`);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = !!val;
      else input.value = val !== null && val !== undefined ? val : '';
    });
    FileUpload.syncAll(formEl);
  },

  clear(formEl) {
    formEl.reset();
    formEl.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
    FileUpload.resetAll(formEl);
  },

  setError(formEl, fieldName, message) {
    const input = formEl.querySelector(`[name="${fieldName}"]`);
    if (input) {
      input.style.borderColor = 'var(--ras-red)';
      const hint = input.nextElementSibling;
      if (hint && hint.classList.contains('form-error')) {
        hint.textContent = message;
        hint.classList.add('show');
      }
    }
  },

  clearErrors(formEl) {
    formEl.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(el => {
      el.style.borderColor = '';
    });
    formEl.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
  },
};

// ── 11b. Import de fichiers ───────────────────────────────
// Remplace les champs « URL » : <div class="file-upload" data-name="image" data-accept="image"></div>
// Le fichier choisi (téléphone ou PC) est envoyé à /api/uploads ; son adresse est
// placée dans un champ caché nommé data-name, lu normalement par Forms.getData.
//   data-accept   : image | document | av | media  (types proposés)
//   data-max-dim  : taille max. en pixels des photos après réduction (défaut 1920)
// Les fichiers partent par morceaux (/api/uploads/chunk) : les gros audios et
// vidéos passent les limites du serveur et un morceau perdu est renvoyé.
const FileUpload = {
  // Extensions acceptées (doivent correspondre à config.upload.kinds côté serveur)
  exts: {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'amr', 'flac', 'wma', '3ga'],
    video: ['mp4', 'm4v', 'mov', 'webm', '3gp', 'mkv', 'avi'],
    document: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'txt'],
  },
  maxSizes: { image: 15 * 1024 * 1024, audio: 300 * 1024 * 1024, video: 1024 * 1024 * 1024, document: 50 * 1024 * 1024 },
  chunkSize: 4 * 1024 * 1024,
  accepts: {
    image: { kinds: ['image'], mime: 'image/*', button: '📷 Choisir une photo', hint: 'JPG, PNG, GIF ou WEBP — 15 Mo max.' },
    document: { kinds: ['document', 'image'], mime: 'image/*', button: '📎 Choisir un fichier', hint: 'PDF, Word, PowerPoint, Excel ou photo — 50 Mo max.' },
    av: { kinds: ['image', 'audio', 'video'], mime: 'image/*,audio/*,video/*', button: '📎 Photo, audio ou vidéo', hint: 'Photo (15 Mo), audio MP3, M4A, WAV… (300 Mo) ou vidéo MP4, MOV… (1 Go).' },
    media: { kinds: ['image', 'audio', 'video', 'document'], mime: 'image/*,audio/*,video/*', button: '📎 Choisir un fichier', hint: 'Audio MP3, M4A, WAV… (300 Mo), vidéo MP4, MOV… (1 Go), PDF, Word, PowerPoint ou photo.' },
  },
  pending: 0,

  // Attribut accept : types génériques + extensions (certains téléphones ne
  // reconnaissent pas « .amr » ou « .opus » par leur type)
  acceptAttr(accept) {
    const conf = this.accepts[accept];
    return [conf.mime, ...conf.kinds.flatMap(k => this.exts[k]).map(e => '.' + e)].join(',');
  },

  extOf(name) {
    const m = /\.([A-Za-z0-9]+)$/.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  },

  kindOfExt(ext) {
    return Object.keys(this.exts).find(k => this.exts[k].includes(ext)) || null;
  },

  formatSize(bytes) {
    return bytes >= 1024 * 1024 * 1024 ? `${(bytes / 1024 / 1024 / 1024).toFixed(1)} Go` : `${Math.max(1, Math.round(bytes / 1024 / 1024))} Mo`;
  },

  init(root = document) {
    root.querySelectorAll('.file-upload:not([data-ready])').forEach(el => this.build(el));
  },

  build(el) {
    el.dataset.ready = '1';
    const accept = this.accepts[el.dataset.accept] ? el.dataset.accept : 'media';
    const conf = this.accepts[accept];

    const hidden = document.createElement('input');
    hidden.type = 'hidden';
    hidden.name = el.dataset.name;

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = this.acceptAttr(accept);
    file.className = 'file-upload-input';

    const zone = document.createElement('button');
    zone.type = 'button';
    zone.className = 'file-upload-zone';
    zone.innerHTML = `<span class="file-upload-btn"></span><span class="file-upload-hint"></span>`;
    zone.querySelector('.file-upload-btn').textContent = conf.button;
    zone.querySelector('.file-upload-hint').textContent = conf.hint;
    zone.addEventListener('click', () => file.click());

    const preview = document.createElement('div');
    preview.className = 'file-upload-preview';

    const progress = document.createElement('div');
    progress.className = 'file-upload-progress';
    progress.innerHTML = '<div class="file-upload-track"><div class="file-upload-bar"></div></div><span class="file-upload-status"></span>';

    el.append(hidden, file, zone, progress, preview);

    file.addEventListener('change', () => {
      if (file.files && file.files[0]) this.upload(el, file.files[0], accept);
      file.value = ''; // permettre de choisir à nouveau le même fichier
    });

    // Glisser-déposer sur ordinateur
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      if (e.dataTransfer.files[0]) this.upload(el, e.dataTransfer.files[0], accept);
    });

    this.render(el);
  },

  hiddenOf(el) { return el.querySelector('input[type="hidden"]'); },

  syncAll(root) { root.querySelectorAll('.file-upload[data-ready]').forEach(el => this.render(el)); },

  resetAll(root) {
    root.querySelectorAll('.file-upload[data-ready]').forEach(el => {
      this.hiddenOf(el).value = '';
      this.render(el);
    });
  },

  kindOf(url) {
    return this.kindOfExt(this.extOf(String(url || '').split('?')[0])) || 'link';
  },

  // Affiche l'aperçu du fichier actuel (ou rien)
  render(el, fileName) {
    const url = this.hiddenOf(el).value;
    const preview = el.querySelector('.file-upload-preview');
    const zone = el.querySelector('.file-upload-zone');
    preview.replaceChildren();
    zone.style.display = url ? 'none' : '';
    if (!url) return;

    const media = this.createMedia(url, fileName);
    media.classList.add('file-upload-media');

    const actions = document.createElement('div');
    actions.className = 'file-upload-actions';
    const change = document.createElement('button');
    change.type = 'button';
    change.className = 'btn btn-sm btn-secondary';
    change.textContent = '🔄 Changer';
    change.addEventListener('click', () => el.querySelector('.file-upload-input').click());
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-sm btn-danger';
    remove.textContent = '✕ Retirer';
    remove.addEventListener('click', () => { this.hiddenOf(el).value = ''; this.render(el); });
    actions.append(change, remove);

    preview.append(media, actions);
  },

  // Formats lisibles directement dans le navigateur ; les autres (AMR, WMA,
  // MKV, AVI…) sont proposés en téléchargement.
  playable: {
    audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac'],
    video: ['mp4', 'm4v', 'mov', 'webm'],
  },

  displayKind(url) {
    const ext = this.extOf(String(url || '').split('?')[0]);
    const kind = this.kindOfExt(ext);
    if (kind === 'image') return 'image';
    if ((kind === 'audio' || kind === 'video') && this.playable[kind].includes(ext)) return kind;
    return kind ? 'download' : 'link';
  },

  // Élément d'affichage d'un fichier (aperçu du formulaire)
  createMedia(url, fileName) {
    const kind = this.displayKind(url);
    let media;
    if (kind === 'image') {
      media = document.createElement('img');
      media.src = url;
      media.alt = 'Aperçu';
    } else if (kind === 'audio' || kind === 'video') {
      media = document.createElement(kind);
      media.src = url;
      media.controls = true;
      media.preload = 'metadata';
      if (kind === 'video') media.playsInline = true;
    } else {
      media = document.createElement('a');
      media.href = url;
      media.target = '_blank';
      media.rel = 'noopener';
      media.className = 'file-upload-doc';
      const icon = { audio: '🎵', video: '🎬' }[this.kindOfExt(this.extOf(url))] || '📄';
      media.textContent = `${icon} ${fileName || decodeURIComponent(url.split('/').pop())}`;
    }
    return media;
  },

  isUploaded(url) {
    return /^\/uploads\//.test(String(url || ''));
  },

  // Adresse qui force le téléchargement, sous un nom lisible (titre + extension)
  downloadUrl(url, name) {
    if (!this.isUploaded(url)) return url;
    return `${url}?download=1&name=${encodeURIComponent(name || 'fichier-rise-and-shine')}`;
  },

  // Bouton « Télécharger » ; pour un lien externe (YouTube…), « Ouvrir le lien »
  downloadButton(url, name, { label, className = 'btn btn-sm btn-secondary', onclick = '', title = '' } = {}) {
    if (!url) return '';
    const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    const click = `event.stopPropagation();${onclick}`;
    if (!this.isUploaded(url)) {
      return `<a href="${esc(url)}" target="_blank" rel="noopener" class="${className}" onclick="${esc(click)}"${title ? ` title="${esc(title)}"` : ''}>${label || '🔗 Ouvrir le lien'}</a>`;
    }
    return `<a href="${esc(this.downloadUrl(url, name))}" download class="${className}" onclick="${esc(click)}"${title ? ` title="${esc(title)}"` : ''}>${label || '⬇ Télécharger'}</a>`;
  },

  // Même chose en HTML, pour les listes (témoignages, galerie…)
  mediaHtml(url, { alt = '', style = '' } = {}) {
    const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    const u = esc(url);
    const a = esc(alt);
    switch (this.displayKind(url)) {
      case 'image': return `<img src="${u}" alt="${a}" style="${esc(style)}" loading="lazy">`;
      case 'audio': return `<audio src="${u}" controls preload="metadata" style="width:100%;margin-bottom:12px;"></audio>`;
      case 'video': return `<video src="${u}" controls playsinline preload="metadata" style="width:100%;max-height:360px;border-radius:10px;background:#000;"></video>`;
      default: return this.downloadButton(url, alt, { label: '⬇ Télécharger le fichier' });
    }
  },

  // Réduit les photos lourdes (appareil photo des téléphones) avant l'envoi
  async compressImage(file, maxDim) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // GIF : animation conservée
    if (file.size < 600 * 1024) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d');
      if (file.type !== 'image/png') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob = await new Promise(r => canvas.toBlob(r, type, 0.85));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type });
    } catch {
      return file;
    }
  },

  // Désactive le bouton d'enregistrement du formulaire pendant l'envoi
  setBusy(el, busy) {
    const scope = el.closest('.modal') || el.closest('form') || document;
    scope.querySelectorAll('.modal-footer .btn-primary, button[type="submit"]').forEach(btn => {
      if (busy) { btn.dataset.uploadDisabled = btn.disabled ? '0' : '1'; btn.disabled = true; }
      else if (btn.dataset.uploadDisabled === '1') { btn.disabled = false; delete btn.dataset.uploadDisabled; }
    });
  },

  // Envoie un morceau ; onProgress reçoit les octets envoyés de ce morceau
  sendChunk(params, blob, onProgress) {
    return new Promise(resolve => {
      const body = new FormData();
      body.append('chunk', blob, 'chunk');
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${RAS.baseUrl}/uploads/chunk?${new URLSearchParams(params)}`);
      xhr.withCredentials = true;
      xhr.timeout = 120000;
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.min(e.loaded, blob.size)); };
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch {}
        resolve({ ok: xhr.status >= 200 && xhr.status < 300 && data && data.success, data, status: xhr.status });
      };
      xhr.onerror = () => resolve({ ok: false, data: null, status: 0 });
      xhr.ontimeout = () => resolve({ ok: false, data: null, status: 0 });
      xhr.send(body);
    });
  },

  // Vérifications faites avant l'envoi, pour un message immédiat
  checkFile(file, accept) {
    const ext = this.extOf(file.name);
    const kind = this.kindOfExt(ext);
    const allowed = this.accepts[accept].kinds;
    if (!kind || !allowed.includes(kind)) {
      const list = allowed.flatMap(k => this.exts[k]).map(e => e.toUpperCase()).join(', ');
      return `Format « .${ext || '?'} » non accepté ici. Formats possibles : ${list}.`;
    }
    if (file.size > this.maxSizes[kind]) {
      return `Fichier trop volumineux (${this.formatSize(file.size)}). Maximum ${this.formatSize(this.maxSizes[kind])} pour ce type de fichier.`;
    }
    if (!file.size) return 'Ce fichier est vide.';
    return null;
  },

  async upload(el, original, accept) {
    const progress = el.querySelector('.file-upload-progress');
    const bar = el.querySelector('.file-upload-bar');
    const status = el.querySelector('.file-upload-status');
    const zone = el.querySelector('.file-upload-zone');

    const problem = this.checkFile(original, accept);
    if (problem) { Toast.error(problem, 8000); return; }

    zone.style.display = 'none';
    progress.classList.add('active');
    bar.style.width = '0%';
    status.textContent = 'Préparation…';
    this.pending++;
    this.setBusy(el, true);

    const file = this.kindOfExt(this.extOf(original.name)) === 'image'
      ? await this.compressImage(original, parseInt(el.dataset.maxDim || '1920', 10))
      : original;

    const total = Math.max(1, Math.ceil(file.size / this.chunkSize));
    const uploadId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const base = { accept, uploadId, total, size: file.size, name: file.name };
    let result = null;
    let index = 0;

    while (index < total) {
      const start = index * this.chunkSize;
      const blob = file.slice(start, Math.min(start + this.chunkSize, file.size));
      let attempt = 0;
      for (;;) {
        result = await this.sendChunk({ ...base, index }, blob, sent => {
          const pct = Math.floor(((start + sent) / file.size) * 100);
          bar.style.width = pct + '%';
          status.textContent = `Envoi… ${pct}%${total > 1 ? ` (${this.formatSize(start + sent)} / ${this.formatSize(file.size)})` : ''}`;
        });
        if (result.ok) break;
        // Morceau manquant côté serveur : reprendre à l'endroit indiqué
        if (result.status === 409 && result.data && Number.isInteger(result.data.expected)) break;
        // Coupure réseau ou erreur serveur passagère : nouvel essai
        const retryable = result.status === 0 || result.status >= 500 || result.status === 429;
        if (!retryable || ++attempt > 4) break;
        status.textContent = `Connexion instable, nouvel essai (${attempt}/4)…`;
        await new Promise(r => setTimeout(r, 1500 * attempt));
      }
      if (result.ok) { index++; continue; }
      if (result.status === 409 && result.data && Number.isInteger(result.data.expected)) { index = result.data.expected; continue; }
      break;
    }

    this.pending--;
    this.setBusy(el, false);
    progress.classList.remove('active');

    if (result && result.ok && result.data.url) {
      this.hiddenOf(el).value = result.data.url;
      this.render(el, original.name);
      Toast.success('Fichier importé.');
    } else {
      this.render(el);
      const message = (result && result.data && result.data.message) ||
        (result && result.status === 413 ? 'Fichier trop volumineux pour le serveur.' :
          result && result.status === 0 ? 'Connexion perdue pendant l\'envoi. Vérifiez votre connexion et réessayez.' :
            'Erreur lors de l\'import du fichier.');
      Toast.error(message, 8000);
    }
  },
};

// ── 12. Pagination Helper ─────────────────────────────────
const Pagination = {
  render(containerEl, { total, page, pages, limit }, onPageChange) {
    if (!containerEl || pages <= 1) {
      if (containerEl) containerEl.innerHTML = '';
      return;
    }

    let html = `<div class="pagination">`;
    html += `<button class="page-btn" ${page === 1 ? 'disabled' : ''} onclick="(${onPageChange})(${page - 1})">‹</button>`;

    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
      html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="(${onPageChange})(${i})">${i}</button>`;
    }

    html += `<button class="page-btn" ${page === pages ? 'disabled' : ''} onclick="(${onPageChange})(${page + 1})">›</button>`;
    html += `<span class="page-info">${total} résultat(s)</span></div>`;
    containerEl.innerHTML = html;
  },
};

// ── 13. Search Debounce ───────────────────────────────────
function initSearch(inputId, callback) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const debouncedSearch = Utils.debounce((val) => callback(val), 400);
  input.addEventListener('input', (e) => debouncedSearch(e.target.value.trim()));
}

// ── 14. Dashboard Module ──────────────────────────────────
const Dashboard = {
  async init() {
    await this.loadStats();
    await this.loadAnnouncements();
    await this.loadUpcomingEvents();
    await this.loadRecentTestimonies();
  },

  async loadStats() {
    const res = await API.get('/users/analytics');
    if (!res.ok) return;
    const { stats, evangelismStats, membersGrowth, financeStats } = res.data;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    set('stat-membres', stats?.membres?.total || 0);
    set('stat-membres-actifs', stats?.membres?.actifs || 0);
    set('stat-evenements', stats?.evenements?.total || 0);
    set('stat-evenements-avenir', stats?.evenements?.aVenir || 0);
    set('stat-evangelisme', stats?.evangelisme?.total || 0);
    set('stat-enseignements', stats?.enseignements?.total || 0);
    set('stat-temoignages-attente', stats?.temoignages?.enAttente || 0);

    if (financeStats) {
      set('stat-solde', Utils.formatCurrency(financeStats.solde));
    }

    // Draw charts
    setTimeout(() => {
      this.drawMembersChart(membersGrowth);
      this.drawEvangelismChart(evangelismStats);
    }, 100);
  },

  drawMembersChart(data) {
    const canvas = document.getElementById('membersChart');
    if (!canvas || !data) return;
    Charts.resizeCanvas(canvas);
    const labels = Object.keys(data.parMois || {}).map(k => k.slice(5));
    const values = Object.values(data.parMois || {});
    Charts.drawLine(canvas, labels, [{ data: values, color: '#FFD700' }]);
  },

  drawEvangelismChart(data) {
    const canvas = document.getElementById('evangelismChart');
    if (!canvas || !data) return;
    Charts.resizeCanvas(canvas);
    const labels = Object.keys(data.parMois || {}).map(k => k.slice(5));
    const values = Object.values(data.parMois || {});
    Charts.drawLine(canvas, labels, [{ data: values, color: '#FF8C00' }]);
  },

  async loadAnnouncements() {
    const res = await API.get('/notifications/announcements');
    if (!res.ok) return;
    const container = document.getElementById('announcementsList');
    if (!container) return;

    if (!res.data.announcements || res.data.announcements.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center" style="padding: 20px;">Aucune annonce</p>';
      return;
    }

    container.innerHTML = res.data.announcements.map(a => `
      <div class="card" style="padding: 14px; margin-bottom: 12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <h5 style="font-size:0.875rem;">${a.titre}</h5>
          <span class="badge ${a.priorite === 'urgente' ? 'badge-red' : 'badge-gold'}">${a.priorite || 'normale'}</span>
        </div>
        <p style="font-size:0.8rem;color:var(--text-secondary);">${a.contenu}</p>
        <p class="text-xs text-muted" style="margin-top:6px;">${Utils.timeAgo(a.createdAt)}</p>
      </div>
    `).join('');
  },

  async loadUpcomingEvents() {
    const res = await API.get('/events?upcoming=true&limit=3');
    if (!res.ok) return;
    const container = document.getElementById('upcomingEventsList');
    if (!container) return;

    if (!res.data.data || res.data.data.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center" style="padding: 20px;">Aucun événement à venir</p>';
      return;
    }

    container.innerHTML = res.data.data.map(e => `
      <div class="member-card" style="margin-bottom: 10px; cursor: pointer;" onclick="window.location.href='/evenements.html'">
        <div class="stat-icon orange" style="width:40px;height:40px;font-size:1rem;">📅</div>
        <div class="member-info">
          <div class="member-name">${e.titre}</div>
          <div class="member-meta">${Utils.formatDate(e.dateDebut)} — ${e.lieu || 'Lieu TBD'}</div>
        </div>
        <span class="event-countdown">${Utils.countdown(e.dateDebut)}</span>
      </div>
    `).join('');
  },

  async loadRecentTestimonies() {
    const res = await API.get('/testimonies?limit=3');
    if (!res.ok) return;
    const container = document.getElementById('recentTestimoniesList');
    if (!container) return;

    if (!res.data.data || res.data.data.length === 0) {
      container.innerHTML = '<p class="text-muted text-sm text-center" style="padding: 20px;">Aucun témoignage</p>';
      return;
    }

    container.innerHTML = res.data.data.map(t => `
      <div class="testimony-card" style="padding: 14px; margin-bottom: 10px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          <div class="avatar avatar-sm">${Utils.getInitials(t.auteurNom)}</div>
          <div>
            <div style="font-size:0.85rem;font-weight:600;">${t.titre}</div>
            <div class="text-xs text-muted">${t.auteurNom} — ${Utils.timeAgo(t.createdAt)}</div>
          </div>
          ${Utils.statusBadge(t.statut)}
        </div>
        <p style="font-size:0.8rem;color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${t.contenu}</p>
      </div>
    `).join('');
  },
};

// ── 15. Members Module ────────────────────────────────────
const Members = {
  page: 1, limit: 20, search: '', filters: {},

  async init() {
    await this.load();
    initSearch('searchMembers', (val) => { this.search = val; this.page = 1; this.load(); });
    const statusFilter = document.getElementById('filterStatus');
    if (statusFilter) statusFilter.addEventListener('change', (e) => {
      this.filters.statut = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.search) params.append('search', this.search);
    if (this.filters.statut) params.append('statut', this.filters.statut);

    const res = await API.get(`/members?${params}`);
    if (!res.ok) { Toast.error(res.data.message); return; }

    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const tbody = document.getElementById('membersTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding: 40px;"><div class="empty-state" style="padding: 0;"><div class="empty-state-icon">👥</div><p>Aucun membre trouvé</p></div></td></tr>`;
      const paginationEl = document.getElementById('membersPagination');
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    tbody.innerHTML = data.map(m => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="avatar avatar-sm">${m.avatar ? `<img src="${m.avatar}">` : Utils.getInitials(m.nom)}</div>
            <div>
              <div style="font-weight:600;font-size:0.875rem;">${m.nom}</div>
              <div class="text-xs text-muted">${m.email || '—'}</div>
            </div>
          </div>
        </td>
        <td>${m.telephone || '—'}</td>
        <td>${m.ville || '—'}</td>
        <td>${m.age ? m.age + ' ans' : '—'}</td>
        <td>${Utils.statusBadge(m.statut)}</td>
        <td>${Utils.formatDate(m.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-secondary btn-icon-only" title="Voir profil" onclick="Members.viewProfile('${m.id}')">👁</button>
            <button class="btn btn-sm btn-secondary btn-icon-only" title="Modifier" onclick="Members.edit('${m.id}')">✏️</button>
            <button class="btn btn-sm btn-danger btn-icon-only" title="Rapport" onclick="Members.openReport('${m.id}', '${m.nom}')">📋</button>
          </div>
        </td>
      </tr>
    `).join('');

    Pagination.render(
      document.getElementById('membersPagination'),
      { total, page, pages, limit: this.limit },
      `function(p){Members.page=p;Members.load()}`
    );
  },

  async viewProfile(id) {
    window.location.href = `/membres.html?id=${id}`;
  },

  async edit(id) {
    const res = await API.get(`/members/${id}`);
    if (!res.ok) { Toast.error('Impossible de charger le membre.'); return; }
    const m = res.data.member;
    const form = document.getElementById('editMemberForm');
    if (form) {
      Forms.setData(form, m);
      form.dataset.memberId = id;
      Modal.open('editMemberModal');
    }
  },

  async saveEdit() {
    const form = document.getElementById('editMemberForm');
    if (!form) return;
    const id = form.dataset.memberId;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveEditMemberBtn');
    Loader.button(btn, true);
    const res = await API.put(`/members/${id}`, data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('editMemberModal');
      Toast.success('Membre mis à jour.');
      this.load();
    } else {
      Toast.error(res.data.message);
    }
  },

  async openReport(id, nom) {
    const form = document.getElementById('reportForm');
    if (form) {
      form.dataset.memberId = id;
      const titleEl = document.getElementById('reportModalTitle');
      if (titleEl) titleEl.textContent = `Rapport confidentiel — ${nom}`;
      Modal.open('reportModal');
    }
  },

  async saveReport() {
    const form = document.getElementById('reportForm');
    if (!form) return;
    const id = form.dataset.memberId;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveReportBtn');
    Loader.button(btn, true);
    const res = await API.post(`/members/${id}/reports`, data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('reportModal');
      Toast.success('Rapport créé avec succès.');
      Forms.clear(form);
    } else {
      Toast.error(res.data.message);
    }
  },
};

// ── 16. Evangelism Module ─────────────────────────────────
const Evangelism = {
  page: 1, limit: 20, search: '', filters: {},

  async init() {
    await this.load();
    await this.loadStats();
    initSearch('searchEvangelism', (val) => { this.search = val; this.page = 1; this.load(); });
    const statusFilter = document.getElementById('filterEvangelismStatus');
    if (statusFilter) statusFilter.addEventListener('change', (e) => {
      this.filters.statut = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.search) params.append('search', this.search);
    if (this.filters.statut) params.append('statut', this.filters.statut);

    const res = await API.get(`/evangelism?${params}`);
    if (!res.ok) return;
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const container = document.getElementById('evangelismList');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🌱</div><h3>Aucune personne évangélisée</h3><p>Commencez à enregistrer les personnes que vous avez évangélisées.</p><button class="btn btn-primary" onclick="Evangelism.openNew()">+ Ajouter</button></div>`;
      return;
    }

    container.innerHTML = `<div class="table-container"><table class="table">
      <thead><tr><th>Nom</th><th>Téléphone</th><th>Localisation</th><th>Date</th><th>Statut</th><th>Par</th><th>Actions</th></tr></thead>
      <tbody>
        ${data.map(e => `
          <tr>
            <td><strong style="font-size:0.875rem;">${e.nom}</strong></td>
            <td>${e.telephone || '—'}</td>
            <td>${e.localisation || '—'}</td>
            <td>${Utils.formatDate(e.dateEvangelisation, { day: '2-digit', month: 'short' })}</td>
            <td>${Utils.statusBadge(e.statut)}</td>
            <td><span class="text-sm">${e.membreNom || '—'}</span></td>
            <td>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-sm btn-secondary btn-icon-only" onclick="Evangelism.edit('${e.id}')">✏️</button>
                <button class="btn btn-sm btn-danger btn-icon-only" onclick="Evangelism.delete('${e.id}')">🗑</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table></div>`;

    Pagination.render(
      document.getElementById('evangelismPagination'),
      { total, page, pages },
      `function(p){Evangelism.page=p;Evangelism.load()}`
    );
  },

  async loadStats() {
    const res = await API.get('/evangelism/stats');
    if (!res.ok) return;
    const { stats } = res.data;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('ev-total', stats.total || 0);
    set('ev-nouveau', stats.parStatut?.nouveau || 0);
    set('ev-suivi', stats.parStatut?.en_suivi || 0);
    set('ev-integre', stats.parStatut?.integre || 0);
    set('ev-baptise', stats.parStatut?.baptise || 0);

    const canvas = document.getElementById('evangelismDonut');
    if (canvas && stats.parStatut) {
      Charts.resizeCanvas(canvas);
      const statuses = ['nouveau', 'en_suivi', 'integre', 'baptise'];
      Charts.drawDonut(
        canvas,
        statuses.map(s => stats.parStatut[s] || 0),
        ['#6495ED', '#FF8C00', '#FFD700', '#4CAF50'],
        statuses
      );
    }
  },

  openNew() {
    Modal.open('newEvangelismModal');
  },

  async save() {
    const form = document.getElementById('newEvangelismForm');
    if (!form) return;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveEvangelismBtn');
    Loader.button(btn, true);
    const res = await API.post('/evangelism', data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('newEvangelismModal');
      Toast.success('Enregistrement créé.');
      Forms.clear(form);
      this.load();
      this.loadStats();
    } else {
      Toast.error(res.data.message);
    }
  },

  async edit(id) {
    const res = await API.get(`/evangelism?page=1&limit=100`);
    const record = res.data.data?.find(e => e.id === id);
    if (!record) return;
    const form = document.getElementById('editEvangelismForm');
    if (form) {
      Forms.setData(form, record);
      form.dataset.id = id;
      Modal.open('editEvangelismModal');
    }
  },

  async saveEdit() {
    const form = document.getElementById('editEvangelismForm');
    if (!form) return;
    const id = form.dataset.id;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveEditEvangelismBtn');
    Loader.button(btn, true);
    const res = await API.put(`/evangelism/${id}`, data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('editEvangelismModal');
      Toast.success('Dossier mis à jour.');
      this.load();
      this.loadStats();
    } else {
      Toast.error(res.data.message);
    }
  },

  async delete(id) {
    Modal.confirm('Supprimer ce dossier d\'évangélisation ?', async () => {
      const res = await API.delete(`/evangelism/${id}`);
      if (res.ok) { Toast.success('Dossier supprimé.'); this.load(); this.loadStats(); }
      else Toast.error(res.data.message);
    }, { title: 'Confirmer la suppression', confirmText: 'Supprimer', danger: true });
  },
};

// ── 17. Finance Module ────────────────────────────────────
const Finance = {
  page: 1, limit: 20, filters: {},

  async init() {
    await this.load();
    await this.loadStats();
    const typeFilter = document.getElementById('filterFinanceType');
    if (typeFilter) typeFilter.addEventListener('change', (e) => {
      this.filters.type = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.filters.type) params.append('type', this.filters.type);
    if (this.filters.statut) params.append('statut', this.filters.statut);

    const res = await API.get(`/finances?${params}`);
    if (!res.ok) { Toast.error(res.data.message); return; }
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const tbody = document.getElementById('financeTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding:40px;"><div class="empty-state" style="padding:0;"><div class="empty-state-icon">💰</div><p>Aucune transaction</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(f => `
      <tr>
        <td>${Utils.formatDate(f.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>${Utils.statusBadge(f.type)}</td>
        <td style="font-weight:600;">${Utils.formatCurrency(f.montant)}</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${f.description}</td>
        <td>${Utils.statusBadge(f.statut)}</td>
        <td>
          <div style="display:flex;gap:6px;">
            ${f.recu ? FileUpload.downloadButton(f.recu, `Reçu - ${f.description || f.type}`, { label: '🧾', className: 'btn btn-sm btn-secondary btn-icon-only', title: 'Télécharger le reçu' }) : ''}
            ${f.statut === 'en_attente' && Auth.hasRole('super_admin') ? `
              <button class="btn btn-sm btn-success btn-icon-only" title="Approuver" onclick="Finance.approve('${f.id}', 'approuve')">✓</button>
              <button class="btn btn-sm btn-danger btn-icon-only" title="Rejeter" onclick="Finance.approve('${f.id}', 'rejete')">✗</button>
            ` : ''}
            ${Auth.hasRole('super_admin') ? `<button class="btn btn-sm btn-danger btn-icon-only" onclick="Finance.delete('${f.id}')">🗑</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');

    Pagination.render(
      document.getElementById('financePagination'),
      { total, page, pages },
      `function(p){Finance.page=p;Finance.load()}`
    );
  },

  async loadStats() {
    if (!Auth.hasRole('super_admin')) return;
    const res = await API.get('/finances/stats');
    if (!res.ok) return;
    const { stats } = res.data;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('finance-dons', Utils.formatCurrency(stats.totalDons));
    set('finance-offrendes', Utils.formatCurrency(stats.totalOffrendes));
    set('finance-depenses', Utils.formatCurrency(stats.totalDepenses));
    set('finance-solde', Utils.formatCurrency(stats.solde));

    const canvas = document.getElementById('financeChart');
    if (canvas && stats.parMois) {
      Charts.resizeCanvas(canvas);
      const labels = Object.keys(stats.parMois).map(k => k.slice(5));
      Charts.drawBar(canvas, labels, [
        { data: Object.values(stats.parMois).map(m => m.entrees), color: '#4CAF50' },
        { data: Object.values(stats.parMois).map(m => m.sorties), color: '#FF4500' },
      ]);
    }
  },

  openNew() { Modal.open('newTransactionModal'); },

  async save() {
    const form = document.getElementById('newTransactionForm');
    if (!form) return;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveTransactionBtn');
    Loader.button(btn, true);
    const res = await API.post('/finances', data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('newTransactionModal');
      Toast.success('Transaction enregistrée.');
      Forms.clear(form);
      this.load();
      this.loadStats();
    } else {
      Toast.error(res.data.message);
    }
  },

  async approve(id, action) {
    const res = await API.put(`/finances/${id}/approve`, { action });
    if (res.ok) { Toast.success(`Transaction ${action === 'approuve' ? 'approuvée' : 'rejetée'}.`); this.load(); this.loadStats(); }
    else Toast.error(res.data.message);
  },

  async delete(id) {
    Modal.confirm('Supprimer cette transaction ?', async () => {
      const res = await API.delete(`/finances/${id}`);
      if (res.ok) { Toast.success('Transaction supprimée.'); this.load(); this.loadStats(); }
      else Toast.error(res.data.message);
    }, { danger: true });
  },
};

// ── 18. Events Module ─────────────────────────────────────
const Events = {
  page: 1, limit: 9, filters: {},

  async init() {
    await this.load();
    const catFilter = document.getElementById('filterEventCat');
    if (catFilter) catFilter.addEventListener('change', (e) => {
      this.filters.categorie = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.filters.categorie) params.append('categorie', this.filters.categorie);
    const res = await API.get(`/events?${params}`);
    if (!res.ok) return;
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const container = document.getElementById('eventsGrid');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">📅</div><h3>Aucun événement</h3><p>Aucun événement programmé pour le moment.</p>${Auth.hasRole('admin') ? '<button class="btn btn-primary" onclick="Events.openNew()">+ Créer un événement</button>' : ''}</div>`;
      return;
    }

    container.innerHTML = data.map(e => `
      <div class="event-card" onclick="Events.view('${e.id}')">
        <div class="event-banner" style="${e.bannerUrl ? `background-image:url(${e.bannerUrl});background-size:cover;` : 'background: linear-gradient(135deg, #1a1a2e, #16213e);'}">
          <div class="event-category-badge">${Utils.statusBadge(e.categorie)}</div>
          ${!e.bannerUrl ? '<span style="font-size:3rem;opacity:0.3;">📅</span>' : ''}
          ${FileUpload.isUploaded(e.bannerUrl) ? FileUpload.downloadButton(e.bannerUrl, `${e.titre} - photo`, { label: '⬇', className: 'event-download', title: 'Télécharger la photo' }) : ''}
        </div>
        <div class="event-body">
          <div class="event-date">📅 ${Utils.formatDate(e.dateDebut)}</div>
          <h4 style="margin-bottom:6px;font-size:0.95rem;">${e.titre}</h4>
          ${e.lieu ? `<p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">📍 ${e.lieu}</p>` : ''}
          <div style="display:flex;align-items:center;justify-content:space-between;">
            ${Utils.statusBadge(e.statut)}
            <span class="event-countdown">${Utils.countdown(e.dateDebut)}</span>
          </div>
          ${e.rsvp ? `<div style="margin-top:8px;font-size:0.75rem;color:var(--text-muted);">👥 ${e.rsvp.length} inscription(s)</div>` : ''}
        </div>
      </div>
    `).join('');

    Pagination.render(
      document.getElementById('eventsPagination'),
      { total, page, pages },
      `function(p){Events.page=p;Events.load()}`
    );
  },

  async view(id) {
    const res = await API.get(`/events/${id}`);
    if (!res.ok) return;
    const e = res.data.event;
    const isRegistered = (e.rsvp || []).some(r => r.userId === RAS.currentUser?.id);

    const detail = document.getElementById('eventDetailContent');
    if (detail) {
      detail.innerHTML = `
        ${e.bannerUrl ? `<img src="${e.bannerUrl}" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px;margin-bottom:10px;">` : ''}
        ${FileUpload.isUploaded(e.bannerUrl) ? `<div style="margin-bottom:16px;">${FileUpload.downloadButton(e.bannerUrl, `${e.titre} - photo`, { label: '⬇ Télécharger la photo' })}</div>` : ''}
        <h2 style="margin-bottom:8px;">${e.titre}</h2>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${Utils.statusBadge(e.categorie)} ${Utils.statusBadge(e.statut)}
        </div>
        <div style="display:grid;gap:10px;margin-bottom:16px;">
          <div style="display:flex;gap:10px;font-size:0.875rem;"><span>📅</span><span>${Utils.formatDate(e.dateDebut)}</span></div>
          ${e.lieu ? `<div style="display:flex;gap:10px;font-size:0.875rem;"><span>📍</span><span>${e.lieu}</span></div>` : ''}
          ${e.capacite ? `<div style="display:flex;gap:10px;font-size:0.875rem;"><span>👥</span><span>Capacité: ${e.capacite}</span></div>` : ''}
        </div>
        ${e.description ? `<p style="color:var(--text-secondary);margin-bottom:16px;line-height:1.7;">${e.description}</p>` : ''}
        ${e.intervenants && e.intervenants.length > 0 ? `<div style="margin-bottom:16px;"><h5 style="margin-bottom:8px;">Intervenants</h5>${e.intervenants.map(i => `<span class="badge badge-gold" style="margin-right:6px;">${i}</span>`).join('')}</div>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border-subtle);padding-top:16px;">
          <span style="font-size:0.875rem;color:var(--text-muted);">${(e.rsvp||[]).length} inscription(s)</span>
          <button class="btn ${isRegistered ? 'btn-secondary' : 'btn-primary'}" onclick="Events.rsvp('${e.id}', this)">
            ${isRegistered ? '✓ Inscrit — Annuler' : '+ S\'inscrire'}
          </button>
        </div>
      `;
      Modal.open('eventDetailModal');
    }
  },

  async rsvp(id, btn) {
    Loader.button(btn, true);
    const res = await API.post(`/events/${id}/rsvp`);
    Loader.button(btn, false);
    if (res.ok) {
      Toast.success(res.data.message);
      btn.textContent = res.data.inscrit ? '✓ Inscrit — Annuler' : '+ S\'inscrire';
    } else {
      Toast.error(res.data.message);
    }
  },

  openNew() { Modal.open('newEventModal'); },

  async save() {
    const form = document.getElementById('newEventForm');
    if (!form) return;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveEventBtn');
    Loader.button(btn, true);
    const res = await API.post('/events', data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('newEventModal');
      Toast.success('Événement créé!');
      Forms.clear(form);
      this.load();
    } else {
      Toast.error(res.data.message);
    }
  },
};

// ── 19. Testimonies Module ────────────────────────────────
const Testimonies = {
  page: 1, limit: 9, filters: {},

  async init() {
    await this.load();
    const statusFilter = document.getElementById('filterTestimonyStatus');
    if (statusFilter) statusFilter.addEventListener('change', (e) => {
      this.filters.statut = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.filters.statut) params.append('statut', this.filters.statut);
    const res = await API.get(`/testimonies?${params}`);
    if (!res.ok) return;
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const container = document.getElementById('testimoniesGrid');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">✨</div><h3>Aucun témoignage</h3><p>Soyez le premier à partager votre témoignage.</p><button class="btn btn-primary" onclick="Testimonies.openNew()">+ Partager</button></div>`;
      return;
    }

    container.innerHTML = data.map(t => `
      <div class="testimony-card">
        <div class="testimony-header">
          <div class="avatar">${t.auteurAvatar ? `<img src="${t.auteurAvatar}">` : Utils.getInitials(t.auteurNom)}</div>
          <div class="testimony-meta">
            <div style="font-weight:600;font-size:0.875rem;">${t.auteurNom}</div>
            <div class="text-xs text-muted">${Utils.timeAgo(t.createdAt)}</div>
          </div>
          <div style="margin-left:auto;">${Utils.statusBadge(t.statut)}</div>
        </div>
        ${t.image ? FileUpload.mediaHtml(t.image, { style: 'width:100%;height:160px;object-fit:cover;border-radius:10px;margin-bottom:12px;' }) : ''}
        <h4 style="font-size:0.95rem;margin-bottom:8px;">${t.titre}</h4>
        <div class="testimony-body" style="-webkit-line-clamp:4;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;">${t.contenu}</div>
        <div class="testimony-footer">
          <button class="testimony-action ${(t.likes||[]).includes(RAS.currentUser?.id) ? 'liked' : ''}" onclick="Testimonies.like('${t.id}', this)">
            ❤️ <span class="like-count">${(t.likes||[]).length}</span>
          </button>
          <button class="testimony-action" onclick="Testimonies.view('${t.id}')">
            💬 ${(t.commentaires||[]).length}
          </button>
          ${Auth.hasRole('admin') ? `
            ${t.statut === 'en_attente' ? `
              <button class="btn btn-sm btn-success" onclick="Testimonies.moderate('${t.id}', 'approuve')">✓</button>
              <button class="btn btn-sm btn-danger" onclick="Testimonies.moderate('${t.id}', 'rejete')">✗</button>
            ` : ''}
            <button class="btn btn-sm btn-secondary" onclick="Testimonies.moderate('${t.id}', null, ${!t.featured})">⭐</button>
          ` : ''}
        </div>
      </div>
    `).join('');

    Pagination.render(
      document.getElementById('testimoniesPagination'),
      { total, page, pages },
      `function(p){Testimonies.page=p;Testimonies.load()}`
    );
  },

  async like(id, btn) {
    const res = await API.post(`/testimonies/${id}/like`);
    if (res.ok) {
      const countEl = btn.querySelector('.like-count');
      if (countEl) countEl.textContent = res.data.likes;
      if (res.data.liked) btn.classList.add('liked'); else btn.classList.remove('liked');
    }
  },

  async view(id) {
    const res = await API.get(`/testimonies/${id}`);
    if (!res.ok) return;
    const t = res.data.testimony;
    const detail = document.getElementById('testimonyDetailContent');
    if (detail) {
      detail.innerHTML = `
        <div class="testimony-header" style="margin-bottom:16px;">
          <div class="avatar avatar-lg">${Utils.getInitials(t.auteurNom)}</div>
          <div>
            <h4>${t.auteurNom}</h4>
            <span class="text-muted text-sm">${Utils.formatDate(t.createdAt)}</span>
          </div>
        </div>
        ${t.image ? FileUpload.mediaHtml(t.image, { style: 'width:100%;border-radius:12px;margin-bottom:10px;' }) : ''}
        ${FileUpload.isUploaded(t.image) && FileUpload.displayKind(t.image) !== 'download' ? `<div style="margin-bottom:16px;">${FileUpload.downloadButton(t.image, t.titre)}</div>` : ''}
        <h3 style="margin-bottom:12px;">${t.titre}</h3>
        <p style="line-height:1.8;color:var(--text-secondary);">${t.contenu}</p>
        <div class="divider"></div>
        <h5 style="margin-bottom:12px;">Commentaires (${(t.commentaires||[]).length})</h5>
        ${(t.commentaires||[]).map(c => `
          <div style="display:flex;gap:10px;margin-bottom:12px;">
            <div class="avatar avatar-sm">${Utils.getInitials(c.auteurNom)}</div>
            <div>
              <div style="font-size:0.8rem;font-weight:600;">${c.auteurNom}</div>
              <p style="font-size:0.85rem;color:var(--text-secondary);">${c.contenu}</p>
            </div>
          </div>
        `).join('') || '<p class="text-muted text-sm">Aucun commentaire</p>'}
        <div style="display:flex;gap:10px;margin-top:16px;">
          <input class="form-input" id="newCommentInput" placeholder="Écrire un commentaire..." style="flex:1;">
          <button class="btn btn-primary" onclick="Testimonies.addComment('${t.id}')">Envoyer</button>
        </div>
      `;
      Modal.open('testimonyDetailModal');
    }
  },

  async addComment(id) {
    const input = document.getElementById('newCommentInput');
    if (!input || !input.value.trim()) return;
    const res = await API.post(`/testimonies/${id}/comment`, { contenu: input.value.trim() });
    if (res.ok) { Toast.success('Commentaire ajouté.'); input.value = ''; this.view(id); }
    else Toast.error(res.data.message);
  },

  async moderate(id, action, featured) {
    const body = {};
    if (action) body.action = action;
    if (featured !== undefined) body.featured = featured;
    const res = await API.put(`/testimonies/${id}/moderate`, body);
    if (res.ok) { Toast.success('Témoignage mis à jour.'); this.load(); }
    else Toast.error(res.data.message);
  },

  openNew() { Modal.open('newTestimonyModal'); },

  async save() {
    const form = document.getElementById('newTestimonyForm');
    if (!form) return;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveTestimonyBtn');
    Loader.button(btn, true);
    const res = await API.post('/testimonies', data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('newTestimonyModal');
      Toast.success('Témoignage soumis pour approbation!');
      Forms.clear(form);
      this.load();
    } else {
      Toast.error(res.data.message);
    }
  },
};

// ── 20. Teachings Module ──────────────────────────────────
const Teachings = {
  page: 1, limit: 12, search: '', filters: {},

  async init() {
    await this.load();
    initSearch('searchTeachings', (val) => { this.search = val; this.page = 1; this.load(); });
    const catFilter = document.getElementById('filterTeachingCat');
    if (catFilter) catFilter.addEventListener('change', (e) => {
      this.filters.categorie = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
    const typeFilter = document.getElementById('filterTeachingType');
    if (typeFilter) typeFilter.addEventListener('change', (e) => {
      this.filters.type = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.search) params.append('search', this.search);
    if (this.filters.categorie) params.append('categorie', this.filters.categorie);
    if (this.filters.type) params.append('type', this.filters.type);
    const res = await API.get(`/teachings?${params}`);
    if (!res.ok) return;
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const container = document.getElementById('teachingsList');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">📚</div><h3>Aucun enseignement</h3><p>La bibliothèque est vide pour le moment.</p>${Auth.hasRole('admin') ? '<button class="btn btn-primary" onclick="Teachings.openNew()">+ Ajouter</button>' : ''}</div>`;
      return;
    }

    container.innerHTML = data.map(t => `
      <div class="teaching-card">
        <div class="teaching-type-icon">${Utils.typeIcon(t.type)}</div>
        <div style="flex:1;min-width:0;">
          <h4 style="font-size:0.9rem;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.titre}</h4>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">${t.auteur} — ${Utils.categoryLabel(t.categorie)}</p>
          <div style="display:flex;align-items:center;gap:8px;">
            ${Utils.statusBadge(t.type)}
            <span class="text-xs text-muted">👁 ${t.vues || 0}</span>
            <span class="text-xs text-muted">⬇ ${t.telechargements || 0}</span>
          </div>
          ${t.fichierUrl && ['audio', 'video'].includes(FileUpload.displayKind(t.fichierUrl))
            ? `<div style="margin-top:10px;">${FileUpload.mediaHtml(t.fichierUrl)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;">
          ${t.fichierUrl || t.lien ? `<a href="${t.fichierUrl || t.lien}" target="_blank" class="btn btn-sm btn-primary">Accéder</a>` : ''}
          ${FileUpload.isUploaded(t.fichierUrl) ? FileUpload.downloadButton(t.fichierUrl, t.titre, { onclick: `Teachings.download('${t.id}')` }) : ''}
          ${Auth.hasRole('admin') ? `<button class="btn btn-sm btn-danger btn-icon-only" onclick="Teachings.delete('${t.id}')">🗑</button>` : ''}
        </div>
      </div>
    `).join('');

    Pagination.render(
      document.getElementById('teachingsPagination'),
      { total, page, pages },
      `function(p){Teachings.page=p;Teachings.load()}`
    );
  },

  async download(id) {
    await API.post(`/teachings/${id}/download`);
  },

  openNew() { Modal.open('newTeachingModal'); },

  async save() {
    const form = document.getElementById('newTeachingForm');
    if (!form) return;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveTeachingBtn');
    Loader.button(btn, true);
    const res = await API.post('/teachings', data);
    Loader.button(btn, false);
    if (res.ok) {
      Modal.close('newTeachingModal');
      Toast.success('Enseignement ajouté!');
      Forms.clear(form);
      this.load();
    } else {
      Toast.error(res.data.message);
    }
  },

  async delete(id) {
    Modal.confirm('Supprimer cet enseignement ?', async () => {
      const res = await API.delete(`/teachings/${id}`);
      if (res.ok) { Toast.success('Enseignement supprimé.'); this.load(); }
      else Toast.error(res.data.message);
    }, { danger: true });
  },
};

// ── 21. Settings Module ───────────────────────────────────
const Settings = {
  async init() {
    if (!RAS.currentUser) return;
    const form = document.getElementById('profileForm');
    if (form) {
      // Charger toutes les données du profil depuis le serveur (fraîches)
      const res = await API.get('/auth/me');
      const userData = res.ok ? res.data.user : RAS.currentUser;
      Forms.setData(form, userData);
      // S'assurer que l'email est bien affiché
      const emailInput = form.querySelector('[name="email"]');
      if (emailInput) emailInput.value = userData.email || '';
    }
  },

  async saveProfile() {
    const form = document.getElementById('profileForm');
    if (!form) return;
    const data = Forms.getData(form);
    const btn = document.getElementById('saveProfileBtn');
    Loader.button(btn, true);
    const res = await API.put('/auth/profile', data);
    Loader.button(btn, false);
    if (res.ok) {
      RAS.currentUser = res.data.user;
      Toast.success('Profil mis à jour avec succès !');
      Sidebar.populateUser();
      // Rafraîchir l'email affiché
      const emailInput = form.querySelector('[name="email"]');
      if (emailInput) emailInput.value = res.data.user.email || '';
    } else {
      Toast.error(res.data.message);
    }
  },

  async changePassword() {
    const form = document.getElementById('passwordForm');
    if (!form) return;
    const data = Forms.getData(form);
    if (data.nouveauMotDePasse !== data.confirmMotDePasse) {
      Toast.error('Les mots de passe ne correspondent pas.');
      return;
    }
    const btn = document.getElementById('savePasswordBtn');
    Loader.button(btn, true);
    const res = await API.put('/auth/change-password', { ancienMotDePasse: data.ancienMotDePasse, nouveauMotDePasse: data.nouveauMotDePasse });
    Loader.button(btn, false);
    if (res.ok) { Toast.success('Mot de passe modifié.'); Forms.clear(form); }
    else Toast.error(res.data.message);
  },
};

// ── 22. Admin Users Module ────────────────────────────────
const AdminUsers = {
  page: 1, limit: 20, search: '', filters: {},

  async init() {
    await this.load();
    initSearch('searchUsers', (val) => { this.search = val; this.page = 1; this.load(); });
    const roleFilter = document.getElementById('filterUserRole');
    if (roleFilter) roleFilter.addEventListener('change', (e) => {
      this.filters.role = e.target.value || undefined;
      this.page = 1;
      this.load();
    });
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    if (this.search) params.append('search', this.search);
    if (this.filters.role) params.append('role', this.filters.role);
    const res = await API.get(`/users?${params}`);
    if (!res.ok) { Toast.error(res.data.message); return; }
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:40px;text-align:center;"><div class="empty-state" style="padding:0;"><div class="empty-state-icon">👥</div><p>Aucun utilisateur</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="avatar avatar-sm">${Utils.getInitials(u.nom)}</div>
            <div>
              <div style="font-weight:600;font-size:0.875rem;">${u.nom}</div>
              <div class="text-xs text-muted">${u.email}</div>
            </div>
          </div>
        </td>
        <td>${Utils.roleBadge(u.role)}</td>
        <td>${u.telephone || '—'}</td>
        <td>${Utils.statusBadge(u.actif !== false ? 'actif' : 'inactif')}</td>
        <td>${Utils.formatDate(u.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <select class="form-select" style="width:auto;padding:4px 8px;font-size:0.75rem;" onchange="AdminUsers.changeRole('${u.id}', this.value)">
              <option value="">Rôle...</option>
              <option value="membre" ${u.role === 'membre' ? 'selected' : ''}>Membre</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
              <option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
            </select>
            <button class="btn btn-sm ${u.actif !== false ? 'btn-secondary' : 'btn-success'} btn-icon-only" onclick="AdminUsers.toggleStatus('${u.id}')" title="${u.actif !== false ? 'Désactiver' : 'Activer'}">${u.actif !== false ? '🔒' : '🔓'}</button>
            <button class="btn btn-sm btn-danger btn-icon-only" onclick="AdminUsers.delete('${u.id}')" title="Supprimer">🗑</button>
          </div>
        </td>
      </tr>
    `).join('');

    Pagination.render(
      document.getElementById('usersPagination'),
      { total, page, pages },
      `function(p){AdminUsers.page=p;AdminUsers.load()}`
    );
  },

  async changeRole(id, role) {
    if (!role) return;
    const res = await API.put(`/users/${id}/role`, { role });
    if (res.ok) { Toast.success(`Rôle modifié: ${role}`); this.load(); }
    else Toast.error(res.data.message);
  },

  async toggleStatus(id) {
    const res = await API.put(`/users/${id}/status`);
    if (res.ok) { Toast.success(res.data.message); this.load(); }
    else Toast.error(res.data.message);
  },

  async delete(id) {
    Modal.confirm('Supprimer cet utilisateur définitivement ?', async () => {
      const res = await API.delete(`/users/${id}`);
      if (res.ok) { Toast.success('Utilisateur supprimé.'); this.load(); }
      else Toast.error(res.data.message);
    }, { danger: true, confirmText: 'Supprimer' });
  },

  async resetPassword(id) {
    const pwd = prompt('Nouveau mot de passe (min. 6 caractères):');
    if (!pwd || pwd.length < 6) { Toast.warning('Mot de passe trop court.'); return; }
    const res = await API.put(`/users/${id}/reset-password`, { newPassword: pwd });
    if (res.ok) Toast.success('Mot de passe réinitialisé.');
    else Toast.error(res.data.message);
  },
};

// ── 23. Gallery Module ────────────────────────────────────
const Gallery = {
  page: 1, limit: 20,

  async init() {
    await this.load();
  },

  async load() {
    const params = new URLSearchParams({ page: this.page, limit: this.limit });
    const res = await API.get(`/teachings/galleries?${params}`);
    if (!res.ok) return;
    this.render(res.data);
  },

  render({ data, total, page, pages }) {
    const container = document.getElementById('galleryGrid');
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-state-icon">🖼</div><h3>Galerie vide</h3><p>Aucune image pour le moment.</p>${Auth.hasRole('admin') ? '<button class="btn btn-primary" onclick="Gallery.openNew()">+ Ajouter</button>' : ''}</div>`;
      return;
    }

    // Photos, vidéos et audios : vignette adaptée, lecture dans la fenêtre de détail
    const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    this.items = data;
    container.innerHTML = data.map((item, i) => {
      const kind = FileUpload.displayKind(item.imageUrl);
      let thumb;
      if (kind === 'image') thumb = `<img src="${esc(item.imageUrl)}" alt="${esc(item.titre)}" loading="lazy">`;
      else if (kind === 'video') thumb = `<video src="${esc(item.imageUrl)}#t=0.5" muted playsinline preload="metadata"></video><span class="gallery-badge">▶</span>`;
      else thumb = `<div class="gallery-file"><span>${FileUpload.kindOf(item.imageUrl) === 'audio' ? '🎵' : '🎬'}</span><small>${esc(item.titre)}</small></div>`;
      return `<div class="gallery-item" onclick="Gallery.view(${i})">${thumb}</div>`;
    }).join('');

    Pagination.render(
      document.getElementById('galleryPagination'),
      { total, page, pages },
      `function(p){Gallery.page=p;Gallery.load()}`
    );
  },

  view(i) {
    const item = (this.items || [])[i];
    const detail = document.getElementById('galleryDetailContent');
    if (!item || !detail) return;
    const title = String(item.titre ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
    detail.innerHTML = FileUpload.mediaHtml(item.imageUrl, { alt: item.titre, style: 'width:100%;max-height:70vh;object-fit:contain;border-radius:12px;' }) +
      `<p style="text-align:center;margin-top:12px;color:var(--text-muted);">${title}</p>` +
      (FileUpload.isUploaded(item.imageUrl) && FileUpload.displayKind(item.imageUrl) !== 'download'
        ? `<div style="text-align:center;margin-top:12px;">${FileUpload.downloadButton(item.imageUrl, item.titre || 'galerie-rise-and-shine', { className: 'btn btn-primary' })}</div>` : '');
    Modal.open('galleryDetailModal');
  },

  // Ancien nom, conservé pour compatibilité
  viewImage(url, title) {
    this.items = [{ imageUrl: url, titre: title }];
    this.view(0);
  },

  openNew() { Modal.open('newGalleryModal'); },

  async save() {
    const form = document.getElementById('newGalleryForm');
    if (!form) return;
    const data = Forms.getData(form);
    const res = await API.post('/teachings/galleries', data);
    if (res.ok) {
      Modal.close('newGalleryModal');
      Toast.success('Image ajoutée.');
      Forms.clear(form);
      this.load();
    } else {
      Toast.error(res.data.message);
    }
  },
};

// ── 24. Landing Page Logic ────────────────────────────────
const Landing = {
  async init() {
    this.initScrollNav();
    this.initCountdown();
    await this.loadPublicData();
  },

  initScrollNav() {
    const nav = document.querySelector('.landing-nav');
    if (!nav) return;
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    });
  },

  initCountdown() {
    const el = document.getElementById('heroCountdown');
    if (!el) return;
    setInterval(() => {
      const next = new Date();
      next.setDate(next.getDate() + ((0 - next.getDay() + 7) % 7 || 7));
      next.setHours(18, 0, 0, 0);
      const diff = next - new Date();
      const days = Math.floor(diff / 86400000);
      const hrs = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      el.textContent = `${days}j ${hrs}h ${mins}min`;
    }, 1000);
  },

  async loadPublicData() {
    const evRes = await API.get('/events?upcoming=true&limit=3');
    const evContainer = document.getElementById('landingEvents');
    if (evContainer && evRes.ok && evRes.data.data) {
      evContainer.innerHTML = evRes.data.data.map(e => `
        <div class="event-card" style="cursor:default;">
          <div class="event-body">
            <div class="event-date">📅 ${Utils.formatDate(e.dateDebut)}</div>
            <h4>${e.titre}</h4>
            ${e.lieu ? `<p class="text-sm text-muted">📍 ${e.lieu}</p>` : ''}
          </div>
        </div>
      `).join('') || '<p class="text-muted text-center">Aucun événement à venir</p>';
    }
  },
};

// ── 24b. Liens Réseaux Sociaux ────────────────────────────
// Les liens sont gérés par le Super Admin (page admin.html) et appliqués
// à tous les boutons .social-btn.<réseau> du site.
const SocialLinks = {
  networks: ['facebook', 'instagram', 'youtube', 'tiktok', 'whatsapp'],

  async fetch() {
    const res = await API.get('/settings/social');
    return res.ok && res.data.links ? res.data.links : null;
  },

  fields: [
    { name: 'facebook', label: '📘 Facebook', placeholder: 'https://www.facebook.com/...' },
    { name: 'tiktok', label: '🎵 TikTok', placeholder: 'https://www.tiktok.com/@...' },
    { name: 'instagram', label: '📸 Instagram', placeholder: 'https://www.instagram.com/...' },
    { name: 'youtube', label: '▶ YouTube', placeholder: 'https://www.youtube.com/@...' },
    { name: 'whatsapp', label: '💬 WhatsApp (groupe ou chaîne)', placeholder: 'https://chat.whatsapp.com/... ou https://wa.me/226...' },
  ],

  // Formulaire de modification des liens (Super Admin), inséré dans `container`.
  // Utilisé sur le tableau de bord et sur la page Gestion Utilisateurs.
  async renderEditor(container) {
    if (!container) return;
    container.innerHTML = `
      <form class="social-links-form" novalidate onsubmit="event.preventDefault()">
        <div class="form-grid">
          ${this.fields.map(f => `
            <div class="form-group">
              <label class="form-label">${f.label}</label>
              <input type="url" name="${f.name}" class="form-input" placeholder="${f.placeholder}">
            </div>`).join('')}
        </div>
        <button type="submit" class="btn btn-primary">💾 Enregistrer les liens</button>
      </form>`;
    const form = container.querySelector('form');
    form.addEventListener('submit', () => this.save(form));
    const links = await this.fetch();
    if (links) Forms.setData(form, links);
  },

  async save(form) {
    const data = Forms.getData(form);
    for (const [network, url] of Object.entries(data)) {
      if (url && !/^https?:\/\//i.test(url.trim())) {
        Toast.error(`Le lien ${network} doit commencer par https://`);
        return;
      }
    }
    const btn = form.querySelector('[type="submit"]');
    Loader.button(btn, true);
    const res = await API.put('/settings/social', data);
    Loader.button(btn, false);
    if (res.ok) {
      Toast.success(res.data.message);
      Forms.setData(form, res.data.links);
      this.apply();
    } else {
      Toast.error(res.data.message || 'Erreur lors de l\'enregistrement.');
    }
  },

  async apply() {
    if (!document.querySelector('.social-btn')) return;
    const links = await this.fetch();
    if (!links) return;
    this.networks.forEach(network => {
      document.querySelectorAll(`.social-btn.${network}`).forEach(btn => {
        const url = links[network];
        if (url) {
          btn.href = url;
          btn.target = '_blank';
          btn.rel = 'noopener noreferrer';
          btn.style.display = '';
        } else {
          btn.style.display = 'none';
        }
      });
    });
  },
};

// ── 25. Page Router ───────────────────────────────────────
const Router = {
  async init() {
    const path = window.location.pathname;
    const page = path.split('/').pop();

    // Check auth for protected pages
    const publicPages = ['index.html', '', 'login.html', 'register.html'];
    const isPublic = publicPages.some(p => page === p || path === '/' || path === '');

    if (!isPublic) {
      const user = await Auth.check();
      if (!user) {
        window.location.href = '/login.html';
        return;
      }
    }

    SocialLinks.apply();

    if (page === 'login.html') {
      // Brancher le formulaire immédiatement : auparavant, un appel à
      // /auth/logout était attendu d'abord, et une soumission rapide
      // rechargeait simplement la page de connexion.
      this.initLogin();
    } else if (page === 'register.html') {
      const user = await Auth.check();
      if (user) { window.location.href = '/dashboard.html'; return; }
      this.initRegister();
    } else if (page === 'index.html' || path === '/' || path === '') {
      await Landing.init();
    } else {
      Sidebar.init();
      await Notifications.init();
      await this.initProtectedPage(page);
    }
  },

  async initProtectedPage(page) {
    // Pages réservées aux admins — rediriger les membres simples
    const adminOnlyPages = ['membres.html', 'finances.html', 'admin.html'];
    if (adminOnlyPages.includes(page) && !Auth.hasRole('admin')) {
      Toast.warning('Accès réservé aux administrateurs.');
      setTimeout(() => { window.location.href = '/dashboard.html'; }, 1500);
      return;
    }

    switch (page) {
      case 'dashboard.html': await Dashboard.init(); break;
      case 'membres.html': if (Auth.hasRole('admin')) await Members.init(); break;
      case 'evangelisation.html': await Evangelism.init(); break;
      case 'temoignages.html': await Testimonies.init(); break;
      case 'evenements.html': await Events.init(); break;
      case 'enseignements.html': await Teachings.init(); break;
      case 'galerie.html': await Gallery.init(); break;
      case 'finances.html': if (Auth.hasRole('admin')) await Finance.init(); break;
      case 'parametres.html': await Settings.init(); break;
      case 'admin.html': if (Auth.hasRole('super_admin')) await AdminUsers.init(); break;
    }
  },

  initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    // Arrivée depuis l'inscription : préremplir l'e-mail et confirmer la création
    try {
      const registered = JSON.parse(sessionStorage.getItem('ras.registered') || 'null');
      if (registered) {
        sessionStorage.removeItem('ras.registered');
        const emailInput = form.querySelector('[name="email"]');
        if (emailInput && registered.email) emailInput.value = String(registered.email).trim();
        Toast.success(registered.message || 'Votre compte a été créé. Connectez-vous.', 6000);
        const passInput = form.querySelector('[name="password"]');
        if (passInput) passInput.focus();
      }
    } catch {}
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Forms.getData(form);
      const btn = form.querySelector('[type="submit"]');
      Loader.button(btn, true);
      const res = await Auth.login(data.email, data.password);
      Loader.button(btn, false);
      if (res.ok && res.data.success) {
        RAS.currentUser = res.data.user;
        Toast.success(res.data.message);
        setTimeout(() => { window.location.href = '/dashboard.html'; }, 500);
      } else if (res.status === 0) {
        Toast.error('Serveur injoignable. Vérifiez votre connexion et réessayez.');
      } else {
        Toast.error(res.data.message || 'Erreur de connexion.');
        const passInput = form.querySelector('[name="password"]');
        if (passInput) passInput.value = '';
      }
    });
  },

  initRegister() {
    // L'administrateur est assigné automatiquement côté serveur
    const form = document.getElementById('registerForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const terms = document.getElementById('acceptTerms');
      if (terms && !terms.checked) return; // message affiché par register.html
      const data = Forms.getData(form);
      const btn = form.querySelector('[type="submit"]');
      if (btn.disabled) return; // éviter le double envoi
      Loader.button(btn, true);
      const res = await Auth.register(data);
      Loader.button(btn, false);
      if (res.ok && res.data.success) {
        // Le message est réaffiché sur la page de connexion, avec l'e-mail prérempli
        try {
          sessionStorage.setItem('ras.registered', JSON.stringify({ email: data.email, message: res.data.message }));
        } catch {}
        Toast.success(res.data.message, 5000);
        setTimeout(() => { window.location.href = '/login.html'; }, 1500);
      } else {
        Toast.error(res.data.message || 'Erreur lors de l\'inscription.');
      }
    });
  },
};

// ── 26. Global Event Listeners ────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Modal overlay click to close
  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) Modal.close();
    });
  }

  // Logout buttons
  document.querySelectorAll('.btn-logout, [data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', () => Auth.logout());
  });

  // Champs d'import de fichiers (avant le routeur, qui peut préremplir les formulaires)
  FileUpload.init();

  // Initialize router
  Router.init().catch(err => {
    console.error('Router init error:', err);
  });

  // Resize charts on window resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      document.querySelectorAll('canvas[data-chart]').forEach(canvas => {
        Charts.resizeCanvas(canvas);
      });
    }, 300);
  });
});

// Expose to global scope for onclick handlers
window.Modal = Modal;
window.Toast = Toast;
window.Auth = Auth;
window.Members = Members;
window.Evangelism = Evangelism;
window.Finance = Finance;
window.Events = Events;
window.Testimonies = Testimonies;
window.Teachings = Teachings;
window.Gallery = Gallery;
window.AdminUsers = AdminUsers;
window.Settings = Settings;
window.SocialLinks = SocialLinks;
window.FileUpload = FileUpload;
window.Notifications = Notifications;
window.Utils = Utils;
