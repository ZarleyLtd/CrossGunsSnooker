// Admin — passcodes list (edit on separate page).

var AdminPasscodesPage = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var self = {
    passcodes: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminPasscodesGate');
      this.el.panel = document.getElementById('adminPasscodesPanel');
      this.el.msg = document.getElementById('adminPcMsg');
      this.el.list = document.getElementById('adminPcList');
      this.el.addBtn = document.getElementById('adminPcAddBtn');
    },

    flash: function (text, isErr) {
      if (!this.el.msg) return;
      this.el.msg.textContent = text || '';
      this.el.msg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.msg.hidden = !text;
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (ok) this.loadPasscodes();
    },

    renderActionList: function (container, items, options) {
      if (!container) return;
      var opts = options || {};
      if (!items.length) {
        container.innerHTML =
          '<p class="admin-player-picks__hint">' + esc(opts.emptyText || 'No items.') + '</p>' +
          (opts.emptyActionHtml || '');
        if (opts.onEmptyAction) {
          var actionBtn = container.querySelector('[data-empty-action]');
          if (actionBtn) actionBtn.addEventListener('click', opts.onEmptyAction);
        }
        return;
      }
      container.innerHTML = items
        .map(function (item) {
          return (
            '<button type="button" class="admin-player-picks__row admin-item-list__row" data-id="' +
            esc(item.id) +
            '">' +
            '<span class="admin-player-picks__name">' +
            esc(item.name) +
            '</span></button>'
          );
        })
        .join('');
      container.querySelectorAll('.admin-item-list__row').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          if (opts.onClick) opts.onClick(id);
        });
      });
    },

    loadPasscodes: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;
      if (this.el.list) {
        this.el.list.innerHTML = '<p class="admin-player-picks__hint"><em>Loading passcodes…</em></p>';
      }
      ApiClient.post('getPasscodes', {})
        .then(function (r) {
          me.passcodes = r.passcodes || [];
          me.renderList();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
          if (me.el.list) {
            me.el.list.innerHTML = '<p class="admin-player-picks__hint">Could not load passcodes.</p>';
          }
        });
    },

    renderList: function () {
      var box = this.el.list;
      if (!box) return;
      if (!this.passcodes.length) {
        this.renderActionList(box, [], {
          emptyText: 'No passcodes yet.',
          emptyActionHtml:
            '<p style="margin:0.75em 0 0;text-align:center;">' +
            '<button type="button" class="btn" data-empty-action>+ Add Passcode</button></p>',
          onEmptyAction: function () {
            window.location.href = 'admin-passcode.html';
          },
        });
        return;
      }
      var items = this.passcodes
        .map(function (p) {
          return {
            id: p.passcodeId,
            name: p.passcodeName || p.passcodeId,
          };
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
      this.renderActionList(box, items, {
        onClick: function (id) {
          window.location.href = 'admin-passcode.html?passcodeId=' + encodeURIComponent(id);
        },
      });
    },

    bind: function () {
      var me = this;
      if (this.el.addBtn) {
        this.el.addBtn.addEventListener('click', function () {
          window.location.href = 'admin-passcode.html';
        });
      }
    },

    init: function () {
      if (!document.getElementById('adminPasscodesRoot')) return;
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
