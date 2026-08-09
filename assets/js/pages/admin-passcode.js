// Admin — edit/create a single passcode.

var AdminPasscodePage = (function () {
  function qsPasscodeId() {
    try {
      return new URL(window.location.href).searchParams.get('passcodeId') || '';
    } catch (_e) {
      return '';
    }
  }

  function slugify(name) {
    if (typeof PlayerSlug !== 'undefined' && PlayerSlug.slugify) {
      return PlayerSlug.slugify(name);
    }
    var s = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return s || 'passcode';
  }

  var self = {
    passcodeId: '',
    passcode: null,
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminPasscodeGate');
      this.el.panel = document.getElementById('adminPasscodePanel');
      this.el.msg = document.getElementById('adminPasscodeMsg');
      this.el.title = document.getElementById('adminPasscodeTitle');
      this.el.form = document.getElementById('adminPasscodeForm');
      this.el.name = document.getElementById('adminPasscodeName');
      this.el.code = document.getElementById('adminPasscodeCode');
      this.el.deleteBtn = document.getElementById('adminPasscodeDelete');
    },

    flash: function (text, isErr) {
      if (!this.el.msg) return;
      this.el.msg.textContent = text || '';
      this.el.msg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.msg.hidden = !text;
    },

    isCreateMode: function () {
      return !this.passcodeId;
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (ok) {
        this.passcodeId = qsPasscodeId();
        this.loadAll();
      }
    },

    setPageTitle: function () {
      if (!this.el.title) return;
      if (this.isCreateMode()) {
        this.el.title.textContent = 'Add Passcode';
        document.title = 'Add Passcode - CrossGuns Snooker League';
      } else if (this.passcode) {
        this.el.title.textContent = 'Edit Passcode';
        document.title =
          (this.passcode.passcodeName || this.passcodeId) + ' - CrossGuns Snooker League';
      } else {
        this.el.title.textContent = 'Edit Passcode';
      }
    },

    applyCreateUi: function () {
      if (this.el.name) this.el.name.value = '';
      if (this.el.code) this.el.code.value = '';
      if (this.el.deleteBtn) this.el.deleteBtn.hidden = true;
      this.setPageTitle();
    },

    applyEditUi: function (p) {
      if (this.el.name) this.el.name.value = p.passcodeName || '';
      if (this.el.code) this.el.code.value = p.passcodeCode || '';
      if (this.el.deleteBtn) this.el.deleteBtn.hidden = false;
      this.setPageTitle();
    },

    loadAll: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;

      if (this.isCreateMode()) {
        this.passcode = null;
        this.applyCreateUi();
        return;
      }

      ApiClient.post('getPasscodes', {})
        .then(function (r) {
          var list = r.passcodes || [];
          me.passcode = list.find(function (p) {
            return p.passcodeId === me.passcodeId;
          });
          if (!me.passcode) {
            me.flash('Passcode not found: ' + me.passcodeId, true);
            me.applyCreateUi();
            return;
          }
          me.applyEditUi(me.passcode);
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    save: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var name = (me.el.name && me.el.name.value.trim()) || '';
      var code = (me.el.code && me.el.code.value.trim()) || '';
      if (!name) {
        me.flash('Passcode Name required.', true);
        return;
      }
      if (!code) {
        me.flash('Passcode Code required.', true);
        return;
      }
      var pid = me.passcodeId || slugify(name);
      ApiClient.post('upsertPasscode', {
        passcodeId: pid,
        passcodeName: name,
        passcodeCode: code,
        active: true,
      })
        .then(function () {
          if (me.isCreateMode()) {
            window.location.href = 'admin-passcode.html?passcodeId=' + encodeURIComponent(pid);
            return;
          }
          me.flash('Passcode saved.', false);
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    deletePasscode: function () {
      if (this.isCreateMode()) return;
      if (!window.confirm('Delete passcode ' + this.passcodeId + '?')) return;
      var me = this;
      ApiClient.post('deletePasscode', { passcodeId: this.passcodeId })
        .then(function () {
          window.location.href = 'admin-passcodes.html';
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    bind: function () {
      var me = this;
      if (this.el.form) {
        this.el.form.addEventListener('submit', function (e) {
          me.save(e);
        });
      }
      if (this.el.deleteBtn) {
        this.el.deleteBtn.addEventListener('click', function () {
          me.deletePasscode();
        });
      }
    },

    init: function () {
      if (!document.getElementById('adminPasscodeRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () {
        me.syncGate();
      });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
