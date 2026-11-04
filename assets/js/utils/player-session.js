// Player identity: one-time registration code, then handle + password on any device.
// The public site stays readable without a session.
// An account marked admin can open admin pages while that session is signed in.

var PlayerSession = {
  TOKEN_KEY: 'crossgunsSessionToken',
  ACCOUNT_KEY: 'crossgunsSessionAccount',
  EVENT_NAME: 'crossguns-player-session-changed',
  _inited: false,

  init: function () {
    if (this._inited) return;
    this._inited = true;
    this.ensureDialogs();
    this.bindNav();
    this.refreshNav();
    this.restore();
  },

  account: function () {
    try {
      var raw = localStorage.getItem(this.ACCOUNT_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.playerId || !parsed.handle) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  },

  token: function () {
    try {
      return localStorage.getItem(this.TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  },

  isSignedIn: function () {
    return !!(this.token() && this.account());
  },

  playerId: function () {
    var account = this.account();
    return account ? String(account.playerId) : '';
  },

  dispatchChange: function () {
    window.dispatchEvent(new CustomEvent(this.EVENT_NAME));
  },

  clearLocal: function () {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.ACCOUNT_KEY);
    } catch (e) {
      /* ignore */
    }
  },

  store: function (token, account) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.ACCOUNT_KEY, JSON.stringify(account));
    this.refreshNav();
    this.dispatchChange();
    this.syncAdminChrome();
  },

  syncAdminChrome: function () {
    if (typeof AdminMode === 'undefined') return;
    AdminMode.refreshNavLabel();
    AdminMode.dispatchChange();
  },

  refreshNav: function () {
    var account = this.isSignedIn() ? this.account() : null;
    document.querySelectorAll('.nav-account-signed-out').forEach(function (el) {
      el.hidden = !!account;
    });
    document.querySelectorAll('.nav-account-signed-in').forEach(function (el) {
      el.hidden = !account;
    });
    var label = '';
    if (account) {
      label = account.handle;
      if (account.playerName) label += ' · ' + account.playerName;
    }
    document.querySelectorAll('.nav-account-who').forEach(function (el) {
      el.textContent = label;
    });
  },

  restore: function () {
    var self = this;
    if (!this.token()) return;
    ApiClient.post('whoAmI', {})
      .then(function (r) {
        if (!r || !r.account) throw new Error('Session expired. Connect again.');
        localStorage.setItem(self.ACCOUNT_KEY, JSON.stringify(r.account));
        self.refreshNav();
        self.dispatchChange();
        self.syncAdminChrome();
      })
      .catch(function (err) {
        var msg = err && err.message ? String(err.message) : '';
        if (/session expired|connect again|disabled/i.test(msg)) {
          self.clearLocal();
          self.refreshNav();
          self.dispatchChange();
          self.syncAdminChrome();
        }
      });
  },

  signOut: function () {
    var self = this;
    var finish = function () {
      self.clearLocal();
      self.refreshNav();
      self.dispatchChange();
      self.syncAdminChrome();
    };
    if (!this.token()) {
      finish();
      return;
    }
    ApiClient.post('signOut', {}).then(finish).catch(finish);
  },

  setMsg: function (id, text, isErr, isSuccess) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
    el.className =
      'admin-unlock-dialog__msg' +
      (isErr ? ' msg--warning' : isSuccess ? ' msg--success' : '');
  },

  ensureDialogs: function () {
    if (document.getElementById('player-connect-dialog')) return;
    var connect = document.createElement('dialog');
    connect.id = 'player-connect-dialog';
    connect.className = 'admin-unlock-dialog';
    connect.setAttribute('aria-labelledby', 'player-connect-title');
    connect.innerHTML =
      '<button type="button" class="help-toggle help-toggle--corner" data-help-toggle aria-pressed="false" aria-label="Help: tap, then tap a control" title="Help">?</button>' +
      '<form class="admin-unlock-dialog__form" data-help="sheet.connect">' +
      '<h2 id="player-connect-title" class="admin-unlock-dialog__title">Connect</h2>' +
      '<p>Use the handle and password you chose when you registered, or register <button type="button" class="player-inline-link" id="player-connect-register" data-help="sheet.registerLink">Here</button> if you are not registered.</p>' +
      '<p><label for="player-connect-handle">Handle</label></p>' +
      '<p><input type="text" id="player-connect-handle" data-help="sheet.handle" class="admin-unlock-dialog__input" autocomplete="username" required /></p>' +
      '<p><label for="player-connect-password">Password</label></p>' +
      '<p><input type="password" id="player-connect-password" data-help="sheet.password" class="admin-unlock-dialog__input" autocomplete="current-password" required /></p>' +
      '<p id="player-connect-msg" class="admin-unlock-dialog__msg" hidden></p>' +
      '<p class="admin-unlock-dialog__actions">' +
      '<button type="submit" class="btn" data-help="sheet.connectSubmit">Connect</button> ' +
      '<button type="button" class="btn" data-close data-help="sheet.cancel">Cancel</button>' +
      '</p>' +
      '<p><button type="button" class="btn" id="player-connect-forgot" data-help="sheet.forgot">Forgot password</button></p>' +
      '</form>';
    document.body.appendChild(connect);

    var register = document.createElement('dialog');
    register.id = 'player-register-dialog';
    register.className = 'admin-unlock-dialog';
    register.setAttribute('aria-labelledby', 'player-register-title');
    register.innerHTML =
      '<button type="button" class="help-toggle help-toggle--corner" data-help-toggle aria-pressed="false" aria-label="Help: tap, then tap a control" title="Help">?</button>' +
      '<form class="admin-unlock-dialog__form" data-help="sheet.register">' +
      '<h2 id="player-register-title" class="admin-unlock-dialog__title">Register</h2>' +
      '<p>An admin gives you a one-time code. Choose a handle and password, and pick which player you are.</p>' +
      '<p><label for="player-register-code">Registration code</label></p>' +
      '<p><input type="text" id="player-register-code" data-help="sheet.regCode" class="admin-unlock-dialog__input" autocomplete="one-time-code" required /></p>' +
      '<p><label for="player-register-handle">Handle</label></p>' +
      '<p><input type="text" id="player-register-handle" data-help="sheet.handle" class="admin-unlock-dialog__input" autocomplete="username" required pattern="[A-Za-z0-9]{3,20}" title="3 to 20 letters or digits" /></p>' +
      '<p><label for="player-register-password">Password</label></p>' +
      '<p><input type="password" id="player-register-password" data-help="sheet.password" class="admin-unlock-dialog__input" autocomplete="new-password" required minlength="8" /></p>' +
      '<p><label for="player-register-password2">Confirm password</label></p>' +
      '<p><input type="password" id="player-register-password2" data-help="sheet.password2" class="admin-unlock-dialog__input" autocomplete="new-password" required minlength="8" /></p>' +
      '<p><label for="player-register-player">You are</label></p>' +
      '<p><select id="player-register-player" data-help="sheet.playerPick" class="admin-unlock-dialog__input" required><option value="">Loading players…</option></select></p>' +
      '<p id="player-register-msg" class="admin-unlock-dialog__msg" hidden></p>' +
      '<p class="admin-unlock-dialog__actions">' +
      '<button type="submit" class="btn" data-help="sheet.registerSubmit">Register</button> ' +
      '<button type="button" class="btn" data-close data-help="sheet.cancel">Cancel</button>' +
      '</p></form>';
    document.body.appendChild(register);

    var reset = document.createElement('dialog');
    reset.id = 'player-reset-dialog';
    reset.className = 'admin-unlock-dialog';
    reset.setAttribute('aria-labelledby', 'player-reset-title');
    reset.innerHTML =
      '<button type="button" class="help-toggle help-toggle--corner" data-help-toggle aria-pressed="false" aria-label="Help: tap, then tap a control" title="Help">?</button>' +
      '<form class="admin-unlock-dialog__form" data-help="sheet.reset">' +
      '<h2 id="player-reset-title" class="admin-unlock-dialog__title">Reset password</h2>' +
      '<p>Ask an admin for a one-time reset code, then choose a new password and connect again.</p>' +
      '<p><label for="player-reset-handle">Handle</label></p>' +
      '<p><input type="text" id="player-reset-handle" data-help="sheet.handle" class="admin-unlock-dialog__input" autocomplete="username" required /></p>' +
      '<p><label for="player-reset-code">Reset code</label></p>' +
      '<p><input type="text" id="player-reset-code" data-help="sheet.resetCode" class="admin-unlock-dialog__input" autocomplete="one-time-code" required /></p>' +
      '<p><label for="player-reset-password">New password</label></p>' +
      '<p><input type="password" id="player-reset-password" data-help="sheet.password" class="admin-unlock-dialog__input" autocomplete="new-password" required minlength="8" /></p>' +
      '<p id="player-reset-msg" class="admin-unlock-dialog__msg" hidden></p>' +
      '<p class="admin-unlock-dialog__actions">' +
      '<button type="submit" class="btn" data-help="sheet.resetSubmit">Update password</button> ' +
      '<button type="button" class="btn" data-close data-help="sheet.cancel">Cancel</button>' +
      '</p></form>';
    document.body.appendChild(reset);

    var self = this;
    document.querySelectorAll('#player-connect-dialog, #player-register-dialog, #player-reset-dialog').forEach(function (dlg) {
      dlg.querySelector('[data-close]').addEventListener('click', function () {
        dlg.close();
      });
    });

    connect.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      self.setMsg('player-connect-msg', 'Checking…', false);
      ApiClient.post('connect', {
        handle: document.getElementById('player-connect-handle').value,
        password: document.getElementById('player-connect-password').value,
      })
        .then(function (r) {
          document.getElementById('player-connect-password').value = '';
          self.setMsg('player-connect-msg', '', false);
          self.store(r.sessionToken, r.account);
          connect.close();
        })
        .catch(function (err) {
          self.setMsg('player-connect-msg', err.message || 'Connect failed', true);
        });
    });

    document.getElementById('player-connect-register').addEventListener('click', function () {
      connect.close();
      self.openRegister();
    });

    document.getElementById('player-connect-forgot').addEventListener('click', function () {
      var handle = document.getElementById('player-connect-handle').value;
      connect.close();
      self.openReset(handle);
    });

    register.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var password = document.getElementById('player-register-password').value;
      var confirmPassword = document.getElementById('player-register-password2').value;
      if (password !== confirmPassword) {
        self.setMsg('player-register-msg', 'Passwords do not match.', true);
        return;
      }
      self.setMsg('player-register-msg', 'Registering…', false);
      ApiClient.post('register', {
        inviteCode: document.getElementById('player-register-code').value,
        handle: document.getElementById('player-register-handle').value,
        password: password,
        playerId: document.getElementById('player-register-player').value,
      })
        .then(function (r) {
          document.getElementById('player-register-password').value = '';
          document.getElementById('player-register-password2').value = '';
          document.getElementById('player-register-code').value = '';
          self.setMsg('player-register-msg', '', false);
          self.store(r.sessionToken, r.account);
          register.close();
        })
        .catch(function (err) {
          self.setMsg('player-register-msg', err.message || 'Registration failed', true);
        });
    });

    reset.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      self.setMsg('player-reset-msg', 'Updating…', false);
      ApiClient.post('resetPassword', {
        handle: document.getElementById('player-reset-handle').value,
        resetCode: document.getElementById('player-reset-code').value,
        newPassword: document.getElementById('player-reset-password').value,
      })
        .then(function () {
          var handleEl = document.getElementById('player-reset-handle');
          var handle = handleEl ? handleEl.value : '';
          document.getElementById('player-reset-password').value = '';
          document.getElementById('player-reset-code').value = '';
          self.setMsg('player-reset-msg', '', false);
          var resetDlg = document.getElementById('player-reset-dialog');
          if (resetDlg) resetDlg.close();
          self.openConnect(handle, 'Password was successfully reset.');
        })
        .catch(function (err) {
          self.setMsg('player-reset-msg', err.message || 'Reset failed', true);
        });
    });
  },

  openDialog: function (dlg) {
    if (!dlg) return;
    if (typeof dlg.showModal === 'function') dlg.showModal();
  },

  openConnect: function (handle, notice) {
    this.setMsg('player-connect-msg', notice || '', false, !!notice);
    this.openDialog(document.getElementById('player-connect-dialog'));
    var handleEl = document.getElementById('player-connect-handle');
    if (handleEl && handle) handleEl.value = handle;
    var focusEl = handle ? document.getElementById('player-connect-password') : handleEl;
    if (focusEl) focusEl.focus();
  },

  openRegister: function () {
    var self = this;
    this.setMsg('player-register-msg', '', false);
    var select = document.getElementById('player-register-player');
    if (select) {
      select.innerHTML = '<option value="">Loading players…</option>';
    }
    this.openDialog(document.getElementById('player-register-dialog'));
    ApiClient.get({ action: 'getPlayers' })
      .then(function (r) {
        var players = (r.players || []).filter(function (p) {
          return p && p.playerId && !p.claimed;
        });
        if (!select) return;
        if (!players.length) {
          select.innerHTML = '<option value="">No unclaimed players</option>';
          return;
        }
        select.innerHTML =
          '<option value="">Choose your name</option>' +
          players
            .map(function (p) {
              return (
                '<option value="' +
                String(p.playerId).replace(/"/g, '&quot;') +
                '">' +
                String(p.playerName || p.playerId)
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;') +
                '</option>'
              );
            })
            .join('');
      })
      .catch(function (err) {
        self.setMsg('player-register-msg', err.message || 'Could not load players', true);
        if (select) select.innerHTML = '<option value="">Could not load players</option>';
      });
  },

  openReset: function (handle) {
    this.setMsg('player-reset-msg', '', false);
    var input = document.getElementById('player-reset-handle');
    if (input && handle) input.value = handle;
    this.openDialog(document.getElementById('player-reset-dialog'));
  },

  bindNav: function () {
    if (this._navBound) return;
    this._navBound = true;
    var self = this;
    document.addEventListener('click', function (e) {
      if (e.target.closest('.nav-account-connect')) {
        e.preventDefault();
        self.openConnect();
        return;
      }
      if (e.target.closest('.nav-account-register')) {
        e.preventDefault();
        self.openRegister();
        return;
      }
      if (e.target.closest('.nav-account-signout')) {
        e.preventDefault();
        self.signOut();
      }
    });
  },
};

document.addEventListener('DOMContentLoaded', function () {
  PlayerSession.init();
});
