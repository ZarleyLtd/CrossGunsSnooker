// Session passcode unlock for score entry (fixtures/results), separate from Admin Mode.

var ScorePasscode = {
  TOKEN_KEY: 'crossgunsScorePassToken',
  EXPIRES_KEY: 'crossgunsScorePassExpiresAt',
  NAME_KEY: 'crossgunsScorePassName',
  EVENT_NAME: 'crossguns-score-passcode-changed',
  _inited: false,
  _pendingRow: null,
  _onUnlocked: null,

  init: function () {
    if (this._inited) return;
    this._inited = true;
    this.ensureDialog();
  },

  isUnlocked: function () {
    var t = sessionStorage.getItem(this.TOKEN_KEY);
    if (!t) return false;
    var exp = sessionStorage.getItem(this.EXPIRES_KEY);
    if (exp) {
      var ms = new Date(exp).getTime();
      if (!isNaN(ms) && Date.now() >= ms) {
        this.lock(true);
        return false;
      }
    }
    return true;
  },

  getName: function () {
    if (!this.isUnlocked()) return '';
    return sessionStorage.getItem(this.NAME_KEY) || '';
  },

  getToken: function () {
    if (!this.isUnlocked()) return null;
    return sessionStorage.getItem(this.TOKEN_KEY);
  },

  dispatchChange: function () {
    window.dispatchEvent(new CustomEvent(this.EVENT_NAME));
  },

  lock: function (silent) {
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.EXPIRES_KEY);
    sessionStorage.removeItem(this.NAME_KEY);
    if (!silent) this.dispatchChange();
  },

  ensureDialog: function () {
    if (document.getElementById('score-passcode-dialog')) return;
    var dlg = document.createElement('dialog');
    dlg.id = 'score-passcode-dialog';
    dlg.className = 'admin-unlock-dialog';
    dlg.setAttribute('aria-labelledby', 'score-passcode-title');
    dlg.innerHTML =
      '<form class="admin-unlock-dialog__form">' +
      '<h2 id="score-passcode-title" class="admin-unlock-dialog__title">Enter Passcode</h2>' +
      '<p><label for="score-passcode-input">Passcode</label></p>' +
      '<p><input type="password" id="score-passcode-input" autocomplete="one-time-code" required class="admin-unlock-dialog__input" /></p>' +
      '<p id="score-passcode-msg" class="admin-unlock-dialog__msg" hidden></p>' +
      '<p class="admin-unlock-dialog__actions">' +
      '<button type="submit" class="btn" id="score-passcode-submit">Continue</button> ' +
      '<button type="button" class="btn" id="score-passcode-cancel">Cancel</button>' +
      '</p>' +
      '</form>';
    document.body.appendChild(dlg);

    var form = dlg.querySelector('form');
    var codeEl = document.getElementById('score-passcode-input');
    var msgEl = document.getElementById('score-passcode-msg');
    var self = this;

    dlg.querySelector('#score-passcode-cancel').addEventListener('click', function () {
      self._pendingRow = null;
      self._onUnlocked = null;
      dlg.close();
      if (codeEl) codeEl.value = '';
      if (msgEl) {
        msgEl.textContent = '';
        msgEl.hidden = true;
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!codeEl) return;
      var code = codeEl.value;
      if (msgEl) {
        msgEl.textContent = 'Checking…';
        msgEl.hidden = false;
        msgEl.classList.remove('msg--success');
        msgEl.classList.add('msg--warning');
      }
      ApiClient.post('verifyPasscode', { code: code })
        .then(function (r) {
          sessionStorage.setItem(self.TOKEN_KEY, r.token);
          if (r.expiresAt) sessionStorage.setItem(self.EXPIRES_KEY, r.expiresAt);
          if (r.passcodeName) sessionStorage.setItem(self.NAME_KEY, r.passcodeName);
          codeEl.value = '';
          if (msgEl) {
            msgEl.textContent = '';
            msgEl.hidden = true;
          }
          dlg.close();
          self.dispatchChange();
          var cb = self._onUnlocked;
          var row = self._pendingRow;
          self._onUnlocked = null;
          self._pendingRow = null;
          if (typeof cb === 'function') cb(row);
        })
        .catch(function (err) {
          if (msgEl) {
            msgEl.textContent = err.message || 'Invalid passcode';
            msgEl.hidden = false;
            msgEl.classList.add('msg--warning');
          }
        });
    });
  },

  /**
   * Prompt for passcode. On success, calls onUnlocked(pendingRow).
   * @param {HTMLElement|null} pendingRow
   * @param {function(HTMLElement|null):void} [onUnlocked]
   */
  openDialog: function (pendingRow, onUnlocked) {
    this.init();
    this._pendingRow = pendingRow || null;
    this._onUnlocked = typeof onUnlocked === 'function' ? onUnlocked : null;
    var dlg = document.getElementById('score-passcode-dialog');
    if (!dlg) return;
    var msgEl = document.getElementById('score-passcode-msg');
    var codeEl = document.getElementById('score-passcode-input');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.hidden = true;
    }
    if (codeEl) codeEl.value = '';
    if (typeof dlg.showModal === 'function') dlg.showModal();
    if (codeEl) {
      setTimeout(function () {
        codeEl.focus();
      }, 0);
    }
  },
};

document.addEventListener('DOMContentLoaded', function () {
  ScorePasscode.init();
});
