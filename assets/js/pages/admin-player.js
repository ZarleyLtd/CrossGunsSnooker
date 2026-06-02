// Admin — edit/create single player + handicap history.

var AdminPlayerPage = (function () {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normDate(v) {
    if (!v) return null;
    var s = String(v).trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return null;
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function qsPlayerId() {
    try {
      return new URL(window.location.href).searchParams.get('playerId') || '';
    } catch (_e) {
      return '';
    }
  }

  function todayIso() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function seasonTypeLabel(t) {
    return String(t || '').toLowerCase() === 'knockout' ? 'Knockout' : 'League';
  }

  var self = {
    playerId: '',
    player: null,
    handicaps: [],
    seasons: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminPlayerGate');
      this.el.panel = document.getElementById('adminPlayerPanel');
      this.el.msg = document.getElementById('adminPlayerMsg');
      this.el.title = document.getElementById('adminPlayerTitle');
      this.el.pForm = document.getElementById('adminPlayerForm');
      this.el.pName = document.getElementById('adminPlayerName');
      this.el.pDelete = document.getElementById('adminPlayerDelete');
      this.el.hcSection = document.getElementById('adminPlayerHcSection');
      this.el.hcAddBtn = document.getElementById('adminPlayerHcAddBtn');
      this.el.hcFormWrap = document.getElementById('adminPlayerHcFormWrap');
      this.el.hForm = document.getElementById('adminPlayerHcForm');
      this.el.hId = document.getElementById('adminPlayerHcId');
      this.el.hVal = document.getElementById('adminPlayerHcVal');
      this.el.hDate = document.getElementById('adminPlayerHcDate');
      this.el.hcCancel = document.getElementById('adminPlayerHcCancel');
      this.el.hcSave = document.getElementById('adminPlayerHcSave');
      this.el.hcList = document.getElementById('adminPlayerHcList');
      this.el.seasonsSection = document.getElementById('adminPlayerSeasonsSection');
      this.el.seasonsList = document.getElementById('adminPlayerSeasonsList');
    },

    flash: function (text, isErr) {
      if (!this.el.msg) return;
      this.el.msg.textContent = text || '';
      this.el.msg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.msg.hidden = !text;
    },

    isCreateMode: function () {
      return !this.playerId;
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (ok) {
        this.playerId = qsPlayerId();
        this.loadAll();
      }
    },

    setPageTitle: function () {
      if (!this.el.title) return;
      if (this.isCreateMode()) {
        this.el.title.textContent = 'Add Player';
        document.title = 'Add Player - CrossGuns Snooker League';
      } else if (this.player) {
        this.el.title.textContent = 'Edit Player';
        document.title = (this.player.playerName || this.playerId) + ' - CrossGuns Snooker League';
      } else {
        this.el.title.textContent = 'Edit Player';
      }
    },

    applyCreateUi: function () {
      if (this.el.pName) this.el.pName.value = '';
      if (this.el.pDelete) this.el.pDelete.hidden = true;
      if (this.el.hcSection) this.el.hcSection.hidden = true;
      if (this.el.seasonsSection) this.el.seasonsSection.hidden = true;
      this.hideHcForm();
      this.setPageTitle();
    },

    applyEditUi: function (p) {
      if (this.el.pName) this.el.pName.value = p.playerName || '';
      if (this.el.pDelete) this.el.pDelete.hidden = false;
      if (this.el.hcSection) this.el.hcSection.hidden = false;
      if (this.el.seasonsSection) this.el.seasonsSection.hidden = false;
      this.hideHcForm();
      this.setPageTitle();
    },

    loadPlayerSeasons: function () {
      var me = this;
      return ApiClient.get({ action: 'getPlayerSeasons', playerId: this.playerId })
        .then(function (r) {
          return r.seasons || [];
        })
        .catch(function () {
          return me.loadPlayerSeasonsFallback();
        });
    },

    loadPlayerSeasonsFallback: function () {
      var me = this;
      return ApiClient.get({ action: 'getSeasons' })
        .then(function (r) {
          var seasons = r.seasons || [];
          if (!seasons.length) return [];
          return Promise.all(
            seasons.map(function (s) {
              return ApiClient.get({ action: 'getPlayers', season: s.seasonId })
                .then(function (pr) {
                  var onRoster = (pr.players || []).some(function (p) {
                    return p.playerId === me.playerId;
                  });
                  if (onRoster) return s;
                  return ApiClient.get({ action: 'getFixtures', season: s.seasonId })
                    .then(function (fr) {
                      var inFixtures = (fr.fixtures || []).some(function (fx) {
                        return fx.playerAId === me.playerId || fx.playerBId === me.playerId;
                      });
                      return inFixtures ? s : null;
                    })
                    .catch(function () {
                      return null;
                    });
                })
                .catch(function () {
                  return null;
                });
            })
          ).then(function (found) {
            return found.filter(Boolean);
          });
        })
        .catch(function () {
          return [];
        });
    },

    loadAll: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;

      if (this.isCreateMode()) {
        this.player = null;
        this.handicaps = [];
        this.seasons = [];
        this.applyCreateUi();
        return;
      }

      Promise.all([
        ApiClient.get({ action: 'getPlayers' }),
        ApiClient.get({ action: 'getHandicaps' }),
        this.loadPlayerSeasons(),
      ])
        .then(function (rs) {
          var players = rs[0].players || [];
          me.player = players.find(function (p) {
            return p.playerId === me.playerId;
          });
          if (!me.player) {
            me.flash('Player not found: ' + me.playerId, true);
            me.applyCreateUi();
            return;
          }
          me.handicaps = (rs[1].handicaps || []).filter(function (h) {
            return h.playerId === me.playerId;
          });
          me.seasons = rs[2] || [];
          me.applyEditUi(me.player);
          me.renderHandicaps();
          me.renderSeasons();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    sortedHandicaps: function () {
      return (this.handicaps || []).slice().sort(function (a, b) {
        var da = a['Handicap Date'] || '';
        var db = b['Handicap Date'] || '';
        return db.localeCompare(da);
      });
    },

    renderHandicaps: function () {
      var box = this.el.hcList;
      if (!box) return;
      var me = this;
      var rows = this.sortedHandicaps();
      if (!rows.length) {
        box.innerHTML = '<p class="admin-player-picks__hint"><em>No handicap history.</em></p>';
        return;
      }
      box.innerHTML = rows
        .map(function (h, index) {
          var current = index === 0 ? ' admin-item-list__row--current' : '';
          return (
            '<div class="admin-hc-list__row">' +
            '<button type="button" class="admin-player-picks__row admin-item-list__row admin-hc-list__main' +
            current +
            '" data-id="' +
            esc(h.handicapId) +
            '">' +
            '<span class="admin-player-picks__name">' +
            esc(String(h['Handicap'])) +
            '</span>' +
            '<span class="admin-item-list__meta">' +
            esc(h['Handicap Date'] || '') +
            '</span></button>' +
            '<button type="button" class="btn btn-danger admin-hc-list__delete" data-id="' +
            esc(h.handicapId) +
            '">Delete</button></div>'
          );
        })
        .join('');
      box.querySelectorAll('.admin-hc-list__main').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var h = me.handicaps.find(function (x) {
            return x.handicapId === id;
          });
          if (h) me.showHcForm(h);
        });
      });
      box.querySelectorAll('.admin-hc-list__delete').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var id = btn.getAttribute('data-id');
          var h = me.handicaps.find(function (x) {
            return x.handicapId === id;
          });
          if (h) me.deleteHcRow(h);
        });
      });
    },

    renderSeasons: function () {
      var box = this.el.seasonsList;
      if (!box) return;
      var rows = (this.seasons || []).slice();
      if (!rows.length) {
        box.innerHTML = '<p class="admin-player-picks__hint"><em>Not on any comp roster.</em></p>';
        return;
      }
      box.innerHTML = rows
        .map(function (s) {
          var current = s.isCurrent ? ' admin-item-list__row--current' : '';
          return (
            '<div class="admin-item-list__row admin-item-list__row--static' +
            current +
            '">' +
            '<span class="admin-player-picks__name">' +
            esc(s.name || s.seasonId) +
            '</span>' +
            '<span class="admin-item-list__meta">' +
            esc(seasonTypeLabel(s.competitionType)) +
            '</span></div>'
          );
        })
        .join('');
    },

    showHcForm: function (h) {
      if (this.el.hcFormWrap) this.el.hcFormWrap.hidden = false;
      if (h) {
        if (this.el.hId) this.el.hId.value = h.handicapId || '';
        if (this.el.hVal) this.el.hVal.value = h['Handicap'] != null ? String(h['Handicap']) : '';
        if (this.el.hDate) this.el.hDate.value = h['Handicap Date'] || '';
      } else {
        this.clearHcForm();
        if (this.el.hDate) this.el.hDate.value = todayIso();
      }
      if (this.el.hVal) this.el.hVal.focus();
    },

    hideHcForm: function () {
      if (this.el.hcFormWrap) this.el.hcFormWrap.hidden = true;
      this.clearHcForm();
    },

    clearHcForm: function () {
      if (this.el.hId) this.el.hId.value = '';
      if (this.el.hVal) this.el.hVal.value = '';
      if (this.el.hDate) this.el.hDate.value = '';
    },

    savePlayer: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var name = (me.el.pName && me.el.pName.value.trim()) || '';
      if (!name) {
        me.flash('Player name required.', true);
        return;
      }
      var pid = me.playerId || PlayerSlug.slugify(name);
      ApiClient.post('upsertPlayer', { playerId: pid, playerName: name, active: true })
        .then(function () {
          if (me.isCreateMode()) {
            window.location.href = 'admin-player.html?playerId=' + encodeURIComponent(pid);
            return;
          }
          me.flash('Player saved.', false);
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    deletePlayer: function () {
      if (this.isCreateMode()) return;
      if (!window.confirm('Delete player ' + this.playerId + '? Fails if still on fixtures/breaks.')) return;
      var me = this;
      ApiClient.post('deletePlayer', { playerId: this.playerId })
        .then(function () {
          window.location.href = 'admin-players.html';
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    saveHc: function (e) {
      if (e && e.preventDefault) e.preventDefault();
      var me = this;
      var hid = (me.el.hId && me.el.hId.value.trim()) || '';
      var hvRaw = me.el.hVal && me.el.hVal.value.trim();
      var dt = normDate(me.el.hDate && me.el.hDate.value);
      if (!me.playerId) {
        me.flash('Save the player first.', true);
        return;
      }
      if (hvRaw === '' || !Number.isFinite(Number(hvRaw))) {
        me.flash('Handicap value required.', true);
        if (me.el.hVal) me.el.hVal.focus();
        return;
      }
      if (!dt) {
        me.flash('Effective date (YYYY-MM-DD) required.', true);
        if (me.el.hDate) me.el.hDate.focus();
        return;
      }
      var payload = { playerId: me.playerId, handicap: Number(hvRaw), effectiveDate: dt };
      if (hid) payload.handicapId = hid;
      ApiClient.post('upsertHandicap', payload)
        .then(function () {
          me.flash('Handicap saved.', false);
          me.hideHcForm();
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    deleteHcRow: function (h) {
      if (!window.confirm('Delete this handicap row?')) return;
      var me = this;
      ApiClient.post('deleteHandicap', { handicapId: h.handicapId })
        .then(function () {
          me.flash('Handicap deleted.', false);
          me.hideHcForm();
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    bind: function () {
      var me = this;
      if (this.el.pForm) this.el.pForm.addEventListener('submit', function (e) { me.savePlayer(e); });
      if (this.el.pDelete) this.el.pDelete.addEventListener('click', function () { me.deletePlayer(); });
      if (this.el.hForm) {
        this.el.hForm.addEventListener('submit', function (e) {
          e.preventDefault();
          me.saveHc(e);
        });
      }
      if (this.el.hcSave) {
        this.el.hcSave.addEventListener('click', function () {
          me.saveHc();
        });
      }
      if (this.el.hcAddBtn) {
        this.el.hcAddBtn.addEventListener('click', function () {
          me.showHcForm(null);
        });
      }
      if (this.el.hcCancel) {
        this.el.hcCancel.addEventListener('click', function () {
          me.hideHcForm();
        });
      }
    },

    init: function () {
      if (!document.getElementById('adminPlayerRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () { me.syncGate(); });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
