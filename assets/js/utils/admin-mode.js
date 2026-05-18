// Site-wide admin unlock: nav control + dialog + session token (same contract as adminLogin).

var AdminMode = {
  TOKEN_KEY: 'crossgunsAdminToken',
  EXPIRES_KEY: 'crossgunsAdminExpiresAt',
  EVENT_NAME: 'crossguns-admin-mode-changed',
  _inited: false,

  init: function () {
    if (this._inited) return;
    this._inited = true;
    this.ensureDialog();
    this.bindNavToggle();
    this.refreshNavLabel();
    this.refreshAdminNavVisibility();
  },

  isUnlocked: function () {
    var t = sessionStorage.getItem(this.TOKEN_KEY);
    if (!t) return false;
    var exp = sessionStorage.getItem(this.EXPIRES_KEY);
    if (exp) {
      var ms = new Date(exp).getTime();
      if (!isNaN(ms) && Date.now() >= ms) {
        this.lock();
        return false;
      }
    }
    return true;
  },

  dispatchChange: function () {
    window.dispatchEvent(new CustomEvent(this.EVENT_NAME));
  },

  lock: function () {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.EXPIRES_KEY);
    this.refreshNavLabel();
    this.refreshAdminNavVisibility();
    this.dispatchChange();
  },

  refreshAdminNavVisibility: function () {
    var on = this.isUnlocked();
    document.querySelectorAll('.nav-admin-only').forEach(function (el) {
      el.hidden = !on;
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
    });
  },

  refreshNavLabel: function () {
    var label = this.isUnlocked() ? 'Lock Admin Mode' : 'Unlock Admin Mode';
    document.querySelectorAll('.nav-admin-toggle').forEach(function (btn) {
      btn.textContent = label;
    });
    this.refreshAdminNavVisibility();
  },

  ensureDialog: function () {
    if (document.getElementById('admin-unlock-dialog')) return;
    var dlg = document.createElement('dialog');
    dlg.id = 'admin-unlock-dialog';
    dlg.className = 'admin-unlock-dialog';
    dlg.setAttribute('aria-labelledby', 'admin-unlock-title');
    dlg.innerHTML =
      '<form class="admin-unlock-dialog__form">' +
      '<h2 id="admin-unlock-title" class="admin-unlock-dialog__title">Unlock Admin Mode</h2>' +
      '<p><label for="admin-unlock-secret">Secret</label></p>' +
      '<p><input type="password" id="admin-unlock-secret" autocomplete="current-password" required class="admin-unlock-dialog__input" /></p>' +
      '<p id="admin-unlock-msg" class="admin-unlock-dialog__msg" hidden></p>' +
      '<p class="admin-unlock-dialog__actions">' +
      '<button type="submit" class="btn" id="admin-unlock-submit">Unlock</button> ' +
      '<button type="button" class="btn" id="admin-unlock-cancel">Cancel</button>' +
      '</p>' +
      '</form>';
    document.body.appendChild(dlg);

    var form = dlg.querySelector('form');
    var secretEl = document.getElementById('admin-unlock-secret');
    var msgEl = document.getElementById('admin-unlock-msg');

    dlg.querySelector('#admin-unlock-cancel').addEventListener('click', function () {
      dlg.close();
      if (secretEl) secretEl.value = '';
      if (msgEl) {
        msgEl.textContent = '';
        msgEl.hidden = true;
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!secretEl) return;
      var pin = secretEl.value;
      if (msgEl) {
        msgEl.textContent = 'Checking…';
        msgEl.hidden = false;
      }
      ApiClient.post('adminLogin', { pin: pin })
        .then(function (r) {
          sessionStorage.setItem(AdminMode.TOKEN_KEY, r.token);
          if (r.expiresAt) sessionStorage.setItem(AdminMode.EXPIRES_KEY, r.expiresAt);
          secretEl.value = '';
          if (msgEl) {
            msgEl.textContent = '';
            msgEl.hidden = true;
          }
          dlg.close();
          AdminMode.refreshNavLabel();
          AdminMode.dispatchChange();
        })
        .catch(function (err) {
          if (msgEl) {
            msgEl.textContent = err.message || 'Unlock failed';
            msgEl.hidden = false;
          }
        });
    });
  },

  openDialog: function () {
    var dlg = document.getElementById('admin-unlock-dialog');
    if (!dlg) return;
    var msgEl = document.getElementById('admin-unlock-msg');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.hidden = true;
    }
    if (typeof dlg.showModal === 'function') dlg.showModal();
  },

  bindNavToggle: function () {
    var self = this;
    document.querySelectorAll('.nav-admin-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (self.isUnlocked()) {
          self.lock();
        } else {
          self.openDialog();
        }
      });
    });
  },
};

document.addEventListener('DOMContentLoaded', function () {
  AdminMode.init();
});
