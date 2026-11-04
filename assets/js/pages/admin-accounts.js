// Admin — player accounts, registration codes, and password reset codes.

var AdminAccountsPage = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatWhen(value) {
    if (!value) return '';
    var d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    try {
      return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    } catch (e) {
      return d.toLocaleString();
    }
  }

  function codeBlock(code, purpose, handle, expiresAt) {
    var kind = purpose === 'reset' ? 'password reset' : 'registration';
    var lead = purpose === 'reset'
      ? 'Shown once. Send this password reset code for ' + (handle || 'the account') + ', then it cannot be looked up again.'
      : 'Shown once. Send this registration code, then it cannot be looked up again.';
    return (
      '<p class="admin-ac-code__lead">' + esc(lead) + '</p>' +
      '<p class="account-code">' + esc(code) + '</p>' +
      '<p class="admin-ac-code__actions">' +
      '<button type="button" class="btn admin-ac-btn" data-copy-code="' + esc(code) + '">Copy</button>' +
      (typeof navigator !== 'undefined' && navigator.share
        ? '<button type="button" class="btn admin-ac-btn" data-share-code="' + esc(code) +
          '" data-share-purpose="' + esc(purpose) +
          '" data-share-handle="' + esc(handle || '') +
          '">Share</button>'
        : '') +
      '</p>' +
      '<p class="admin-ac-code__expires">Expires ' + esc(formatWhen(expiresAt)) + '. This ' + esc(kind) + ' code is used once.</p>'
    );
  }

  var self = {
    accounts: [],
    openAccountId: '',

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    init: function () {
      this.cacheEls();
      var me = this;
      window.addEventListener(this.adminEvt(), function () {
        me.syncGate();
      });
      document.getElementById('adminAcIssue').addEventListener('click', function () {
        me.issue();
      });
      document.addEventListener('click', function (e) {
        var copyBtn = e.target.closest('[data-copy-code]');
        if (copyBtn) {
          e.preventDefault();
          me.copyCode(copyBtn.getAttribute('data-copy-code'), copyBtn);
          return;
        }
        var shareBtn = e.target.closest('[data-share-code]');
        if (shareBtn) {
          e.preventDefault();
          me.shareCode(shareBtn);
        }
      });
      if (this.el.accountClose) {
        this.el.accountClose.addEventListener('click', function () {
          me.closeAccount();
        });
      }
      if (this.el.accountModal) {
        this.el.accountModal.addEventListener('click', function (e) {
          if (e.target === me.el.accountModal) me.closeAccount();
        });
      }
      if (this.el.toggleAdmin) {
        this.el.toggleAdmin.addEventListener('click', function () {
          me.toggleAdmin();
        });
      }
      if (this.el.toggleApprover) {
        this.el.toggleApprover.addEventListener('click', function () {
          me.toggleApprover();
        });
      }
      if (this.el.resetBtn) {
        this.el.resetBtn.addEventListener('click', function () {
          me.issueReset();
        });
      }
      if (this.el.disableBtn) {
        this.el.disableBtn.addEventListener('click', function () {
          me.disableOpen();
        });
      }
      this.syncGate();
    },

    cacheEls: function () {
      this.el = {
        gate: document.getElementById('adminAccountsGate'),
        panel: document.getElementById('adminAccountsPanel'),
        msg: document.getElementById('adminAcMsg'),
        label: document.getElementById('adminAcLabel'),
        codeBox: document.getElementById('adminAcCodeBox'),
        invites: document.getElementById('adminAcInvites'),
        accounts: document.getElementById('adminAcAccounts'),
        accountModal: document.getElementById('adminAcAccountModal'),
        accountTitle: document.getElementById('adminAcAccountTitle'),
        accountMeta: document.getElementById('adminAcAccountMeta'),
        accountClose: document.getElementById('adminAcAccountClose'),
        accountMsg: document.getElementById('adminAcAccountMsg'),
        accountHint: document.getElementById('adminAcAccountHint'),
        toggleAdmin: document.getElementById('adminAcToggleAdmin'),
        toggleApprover: document.getElementById('adminAcToggleApprover'),
        resetBtn: document.getElementById('adminAcReset'),
        disableBtn: document.getElementById('adminAcDisable'),
        resetBox: document.getElementById('adminAcResetBox'),
      };
    },

    flash: function (text, isErr) {
      if (!this.el.msg) return;
      this.el.msg.textContent = text || '';
      this.el.msg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.msg.hidden = !text;
    },

    dialogMsg: function (text, isErr) {
      if (!this.el.accountMsg) return;
      this.el.accountMsg.textContent = text || '';
      this.el.accountMsg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.accountMsg.hidden = !text;
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (!ok) this.closeAccount();
      if (ok) this.load();
    },

    load: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return Promise.resolve();
      return Promise.all([
        ApiClient.post('listAccounts', {}),
        ApiClient.post('listInvites', {}),
      ])
        .then(function (results) {
          me.flash('', false);
          me.accounts = results[0].accounts || [];
          me.renderAccounts(me.accounts);
          me.renderInvites(results[1].invites || []);
          if (me.openAccountId) me.refreshOpenAccount(true);
        })
        .catch(function (err) {
          me.flash(err.message || 'Could not load accounts', true);
        });
    },

    accountById: function (id) {
      return this.accounts.find(function (row) {
        return row.id === id;
      });
    },

    renderAccounts: function (accounts) {
      var me = this;
      var host = this.el.accounts;
      if (!host) return;
      if (!accounts.length) {
        host.innerHTML = '<p class="admin-player-picks__hint"><em>No player accounts yet.</em></p>';
        return;
      }
      host.innerHTML = accounts
        .map(function (account) {
          var meta = [];
          if (account.playerName) meta.push(account.playerName);
          if (account.disabled) meta.push('disabled');
          if (account.lastSeenAt) meta.push('last seen ' + formatWhen(account.lastSeenAt));
          var badge = account.isAdmin
            ? 'Admin'
            : account.isApprover
              ? 'Approver'
              : (account.disabled ? 'Disabled' : '');
          return (
            '<button type="button" class="admin-ac-row" data-account="' + esc(account.id) + '">' +
            '<span class="admin-ac-row__text">' +
            '<span class="admin-ac-row__title">' + esc(account.handle) + '</span>' +
            '<span class="admin-ac-row__meta">' + esc(meta.join(' · ')) + '</span>' +
            '</span>' +
            (badge ? '<span class="admin-ac-row__badge">' + esc(badge) + '</span>' : '') +
            '</button>'
          );
        })
        .join('');
      host.querySelectorAll('[data-account]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          me.openAccount(btn.getAttribute('data-account'));
        });
      });
    },

    renderInvites: function (invites) {
      var me = this;
      var host = this.el.invites;
      if (!host) return;
      if (!invites.length) {
        host.innerHTML = '<p class="admin-player-picks__hint"><em>No unused codes.</em></p>';
        return;
      }
      host.innerHTML = invites
        .map(function (invite) {
          var title = invite.purpose === 'reset' ? 'Password reset' : 'Registration';
          var meta = [];
          if (invite.purpose === 'reset' && invite.handle) meta.push('for ' + invite.handle);
          if (invite.label) meta.push(invite.label);
          meta.push('expires ' + formatWhen(invite.expiresAt));
          return (
            '<div class="admin-ac-row">' +
            '<span class="admin-ac-row__text">' +
            '<span class="admin-ac-row__title">' + esc(title) + '</span>' +
            '<span class="admin-ac-row__meta">' + esc(meta.join(' · ')) + '</span>' +
            '</span>' +
            '<button type="button" class="btn admin-ac-btn" data-revoke="' + esc(invite.id) + '">Revoke</button>' +
            '</div>'
          );
        })
        .join('');
      host.querySelectorAll('[data-revoke]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          ApiClient.post('revokeInvite', { inviteId: btn.getAttribute('data-revoke') })
            .then(function () {
              me.flash('Code revoked.', false);
              me.load();
            })
            .catch(function (err) {
              me.flash(err.message || 'Could not revoke code', true);
            });
        });
      });
    },

    openAccount: function (id) {
      var account = this.accountById(id);
      if (!account || !this.el.accountModal) return;
      this.openAccountId = id;
      this.fillDialog(account, false);
      this.el.accountModal.hidden = false;
      this.el.accountModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    closeAccount: function () {
      this.openAccountId = '';
      if (!this.el.accountModal) return;
      this.el.accountModal.classList.remove('is-open');
      this.el.accountModal.hidden = true;
      document.body.style.overflow = '';
    },

    refreshOpenAccount: function (keepCode) {
      if (!this.openAccountId || !this.el.accountModal || this.el.accountModal.hidden) return;
      var account = this.accountById(this.openAccountId);
      if (!account) {
        this.closeAccount();
        return;
      }
      this.fillDialog(account, keepCode);
    },

    fillDialog: function (account, keepCode) {
      if (this.el.accountTitle) this.el.accountTitle.textContent = account.handle;
      var bits = [];
      if (account.playerName) bits.push(account.playerName);
      bits.push(account.isAdmin ? 'Admin' : account.isApprover ? 'Approver' : 'Player');
      if (account.disabled) bits.push('Disabled');
      if (account.lastSeenAt) bits.push('last seen ' + formatWhen(account.lastSeenAt));
      if (this.el.accountMeta) this.el.accountMeta.textContent = bits.join(' · ');
      if (this.el.accountHint) {
        this.el.accountHint.textContent = account.disabled
          ? 'This account is disabled. They are signed out and cannot connect.'
          : 'Admin accounts can manage the league while they are signed in. Approver accounts can enter, edit, and approve scores for any match. Those scores are approved immediately. They cannot use the other admin tools. A password reset code is used once and lasts 24 hours.';
      }
      if (this.el.toggleAdmin) {
        this.el.toggleAdmin.textContent = account.isAdmin ? 'Remove admin' : 'Make admin';
        this.el.toggleAdmin.hidden = !!account.disabled;
      }
      if (this.el.toggleApprover) {
        this.el.toggleApprover.textContent = account.isApprover ? 'Remove approver' : 'Make approver';
        this.el.toggleApprover.hidden = !!account.disabled;
      }
      if (this.el.resetBtn) this.el.resetBtn.hidden = !!account.disabled;
      if (this.el.disableBtn) this.el.disableBtn.hidden = !!account.disabled;
      if (!keepCode && this.el.resetBox) {
        this.el.resetBox.hidden = true;
        this.el.resetBox.innerHTML = '';
      }
      if (!keepCode) this.dialogMsg('', false);
    },

    toggleAdmin: function () {
      var me = this;
      var account = this.accountById(this.openAccountId);
      if (!account) return;
      var next = !account.isAdmin;
      var prompt = next
        ? 'Make ' + account.handle + ' an admin? They will be able to manage the league while signed in.'
        : 'Remove admin from ' + account.handle + '? They will keep their player account.';
      if (next && account.isApprover) {
        prompt = 'Make ' + account.handle + ' an admin instead of an approver? They will be able to manage the league while signed in.';
      }
      if (!window.confirm(prompt)) return;
      this.dialogMsg(next ? 'Updating admin…' : 'Removing admin…', false);
      ApiClient.post('setAccountAdmin', { accountId: account.id, isAdmin: next })
        .then(function () {
          return me.load();
        })
        .then(function () {
          var text = next
            ? account.handle + ' is now an admin.'
            : account.handle + ' is no longer an admin.';
          me.dialogMsg(text, false);
          me.flash(text, false);
        })
        .catch(function (err) {
          me.dialogMsg(err.message || 'Could not update admin', true);
        });
    },

    toggleApprover: function () {
      var me = this;
      var account = this.accountById(this.openAccountId);
      if (!account) return;
      var next = !account.isApprover;
      var prompt = next
        ? 'Make ' + account.handle + ' an approver? They will be able to enter, edit, and approve scores for any match. Those scores are approved immediately. They will not be able to use the other admin tools.'
        : 'Remove approver from ' + account.handle + '? They will keep their player account.';
      if (next && account.isAdmin) {
        prompt = 'Make ' + account.handle + ' an approver instead of an admin? They will be able to enter, edit, and approve scores, and will lose the other admin tools.';
      }
      if (!window.confirm(prompt)) return;
      this.dialogMsg(next ? 'Updating approver…' : 'Removing approver…', false);
      ApiClient.post('setAccountApprover', { accountId: account.id, isApprover: next })
        .then(function () {
          return me.load();
        })
        .then(function () {
          var text = next
            ? account.handle + ' is now an approver.'
            : account.handle + ' is no longer an approver.';
          me.dialogMsg(text, false);
          me.flash(text, false);
        })
        .catch(function (err) {
          me.dialogMsg(err.message || 'Could not update approver', true);
        });
    },

    issueReset: function () {
      var me = this;
      var account = this.accountById(this.openAccountId);
      if (!account) return;
      this.dialogMsg('Issuing reset code…', false);
      ApiClient.post('issueInvite', { purpose: 'reset', accountId: account.id })
        .then(function (r) {
          me.el.resetBox.hidden = false;
          me.el.resetBox.innerHTML = codeBlock(r.code, 'reset', account.handle, r.expiresAt);
          return me.load();
        })
        .then(function () {
          me.dialogMsg('Reset code created.', false);
        })
        .catch(function (err) {
          me.dialogMsg(err.message || 'Could not issue reset code', true);
        });
    },

    disableOpen: function () {
      var me = this;
      var account = this.accountById(this.openAccountId);
      if (!account) return;
      if (!window.confirm('Disable ' + account.handle + '? They will be signed out and will not be able to connect.')) {
        return;
      }
      this.dialogMsg('Disabling…', false);
      ApiClient.post('disableAccount', { accountId: account.id })
        .then(function () {
          me.flash('Account disabled.', false);
          me.closeAccount();
          me.load();
        })
        .catch(function (err) {
          me.dialogMsg(err.message || 'Could not disable account', true);
        });
    },

    issue: function () {
      var me = this;
      this.flash('Issuing code…', false);
      ApiClient.post('issueInvite', {
        purpose: 'register',
        label: this.el.label.value,
      })
        .then(function (r) {
          me.el.codeBox.hidden = false;
          me.el.codeBox.innerHTML = codeBlock(r.code, 'register', '', r.expiresAt);
          me.el.label.value = '';
          me.flash('Code created.', false);
          me.load();
        })
        .catch(function (err) {
          me.flash(err.message || 'Could not issue code', true);
        });
    },

    copyCode: function (code, anchor) {
      var text = String(code || '');
      if (!text) return;
      function done() {
        if (typeof BriefMessage !== 'undefined') BriefMessage.show('Copied', anchor, { durationMs: 1200 });
      }
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } catch (e) {
          if (typeof BriefMessage !== 'undefined') BriefMessage.show('Could not copy the code', anchor);
        }
        document.body.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(legacy);
      } else {
        legacy();
      }
    },

    shareCode: function (btn) {
      var me = this;
      var code = btn.getAttribute('data-share-code') || '';
      var purpose = btn.getAttribute('data-share-purpose') || 'register';
      var handle = btn.getAttribute('data-share-handle') || '';
      var text = purpose === 'reset'
        ? 'Password reset code for ' + (handle || 'account') + ': ' + code
        : 'Registration code: ' + code;
      if (navigator.share) {
        navigator.share({ title: 'ierne snooker', text: text }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          me.copyCode(code, btn);
        });
        return;
      }
      this.copyCode(code, btn);
    },
  };

  return self;
})();
