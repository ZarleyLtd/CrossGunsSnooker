// Admin — players list (edit on separate page).

var AdminPlayersPage = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPlayerMeta(p) {
    var seasons = Number(p.seasonCount) || 0;
    var matches = Number(p.matchCount) || 0;
    return (
      seasons +
      ' season' +
      (seasons === 1 ? '' : 's') +
      ' · ' +
      matches +
      ' match' +
      (matches === 1 ? '' : 'es')
    );
  }

  var self = {
    players: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminPlayersGate');
      this.el.panel = document.getElementById('adminPlayersPanel');
      this.el.msg = document.getElementById('adminPlMsg');
      this.el.list = document.getElementById('adminPlList');
      this.el.addBtn = document.getElementById('adminPlAddBtn');
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
      if (ok) this.loadPlayers();
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
            '</span>' +
            '<span class="admin-item-list__meta">' +
            esc(item.meta || '') +
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

    loadPlayers: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;
      if (this.el.list) {
        this.el.list.innerHTML = '<p class="admin-player-picks__hint"><em>Loading players…</em></p>';
      }
      ApiClient.get({ action: 'getPlayers' })
        .then(function (r) {
          me.players = r.players || [];
          me.renderList();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
          if (me.el.list) {
            me.el.list.innerHTML = '<p class="admin-player-picks__hint">Could not load players.</p>';
          }
        });
    },

    renderList: function () {
      var box = this.el.list;
      if (!box) return;
      var me = this;
      if (!this.players.length) {
        this.renderActionList(box, [], {
          emptyText: 'No players yet.',
          emptyActionHtml:
            '<p style="margin:0.75em 0 0;text-align:center;">' +
            '<button type="button" class="btn" data-empty-action>+ Add Player</button></p>',
          onEmptyAction: function () {
            window.location.href = 'admin-player.html';
          },
        });
        return;
      }
      var items = this.players
        .map(function (p) {
          return {
            id: p.playerId,
            name: p.playerName || p.playerId,
            meta: formatPlayerMeta(p),
          };
        })
        .sort(function (a, b) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
      this.renderActionList(box, items, {
        onClick: function (id) {
          window.location.href = 'admin-player.html?playerId=' + encodeURIComponent(id);
        },
      });
    },

    bind: function () {
      var me = this;
      if (this.el.addBtn) {
        this.el.addBtn.addEventListener('click', function () {
          window.location.href = 'admin-player.html';
        });
      }
    },

    init: function () {
      if (!document.getElementById('adminPlayersRoot')) return;
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
