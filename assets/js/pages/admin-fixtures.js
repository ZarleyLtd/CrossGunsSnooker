// Admin — league + knockout fixtures: grouped list + modal add/edit.

var AdminFixturesPage = (function () {
  var self = {
    seasons: [],
    leagues: [],
    seasonPlayers: [],
    fixturesLoaded: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.root = document.getElementById('adminFixturesRoot');
      this.el.gate = document.getElementById('adminFixturesGate');
      this.el.panel = document.getElementById('adminFixturesPanel');
      this.el.seasonSelect = document.getElementById('adminFxSeason');
      this.el.list = document.getElementById('adminFxList');
      this.el.addBtn = document.getElementById('adminFxAddBtn');
      this.el.msg = document.getElementById('adminFxMsg');
      this.el.dialog = document.getElementById('admin-fixture-dialog');
      this.el.form = document.getElementById('adminFxDialogForm');
      this.el.fixtureId = document.getElementById('adminFxFixtureId');
      this.el.stage = document.getElementById('adminFxStage');
      this.el.leagueFields = document.getElementById('adminFxLeagueFields');
      this.el.koFields = document.getElementById('adminFxKoFields');
      this.el.league = document.getElementById('adminFxLeague');
      this.el.week = document.getElementById('adminFxWeek');
      this.el.round = document.getElementById('adminFxRound');
      this.el.roundCustom = document.getElementById('adminFxRoundCustom');
      this.el.pa = document.getElementById('adminFxPa');
      this.el.pb = document.getElementById('adminFxPb');
      this.el.deleteBtn = document.getElementById('adminFxDeleteBtn');
      this.el.dialogMsg = document.getElementById('adminFxDialogMsg');
    },

    flash: function (text, isErr) {
      if (!this.el.msg) return;
      this.el.msg.textContent = text || '';
      this.el.msg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.msg.hidden = !text;
    },

    dialogFlash: function (text, isErr) {
      if (!this.el.dialogMsg) return;
      this.el.dialogMsg.textContent = text || '';
      this.el.dialogMsg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.dialogMsg.hidden = !text;
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (ok) this.loadMeta();
    },

    leagueById: function (id) {
      var lid = String(id == null ? '' : id);
      for (var i = 0; i < (this.leagues || []).length; i++) {
        if (String(this.leagues[i].leagueId) === lid) return this.leagues[i];
      }
      return null;
    },

    leagueDisplayOrder: function (leagueId) {
      var L = this.leagueById(leagueId);
      return L && L.displayOrder != null ? Number(L.displayOrder) : 0;
    },

    fillSeasonSelect: function () {
      var ss = this.el.seasonSelect;
      if (!ss) return;
      ss.innerHTML = '';
      var cur = null;
      (this.seasons || []).forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.seasonId;
        o.textContent = s.name;
        if (s.isCurrent) cur = s.seasonId;
        ss.appendChild(o);
      });
      if (cur && ss.querySelector('option[value="' + cur + '"]')) ss.value = cur;
      else if (ss.options.length) ss.selectedIndex = 0;
    },

    fillLeagueSelect: function () {
      var ls = this.el.league;
      if (!ls) return;
      ls.innerHTML = '';
      (this.leagues || []).forEach(function (L) {
        var o = document.createElement('option');
        o.value = L.leagueId;
        o.textContent = L.name;
        ls.appendChild(o);
      });
      if (ls.options.length) ls.selectedIndex = 0;
    },

    fillRoundSelect: function () {
      var rs = this.el.round;
      if (!rs) return;
      rs.innerHTML = '';
      (KnockoutRounds.all() || []).forEach(function (r) {
        var o = document.createElement('option');
        o.value = r.code;
        o.textContent = r.label;
        rs.appendChild(o);
      });
      var custom = document.createElement('option');
      custom.value = '__custom__';
      custom.textContent = 'Custom…';
      rs.appendChild(custom);
    },

    currentSeasonId: function () {
      return this.el.seasonSelect && this.el.seasonSelect.value;
    },

    loadMeta: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;
      Promise.all([
        ApiClient.get({ action: 'getSeasons' }),
        ApiClient.get({ action: 'getLeagues' }),
      ])
        .then(function (rs) {
          me.seasons = rs[0].seasons || [];
          me.leagues = rs[1].leagues || [];
          me.fillSeasonSelect();
          me.fillLeagueSelect();
          me.fillRoundSelect();
          return me.reloadFixtures();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    reloadSeasonPlayers: function () {
      var me = this;
      var sid = me.currentSeasonId();
      if (!sid) {
        me.seasonPlayers = [];
        return Promise.resolve();
      }
      return ApiClient.get({ action: 'getPlayers', season: sid }).then(function (r) {
        me.seasonPlayers = r.players || [];
      });
    },

    reloadFixtures: function () {
      var me = this;
      var sid = me.currentSeasonId();
      if (!sid) return Promise.resolve();
      return Promise.all([
        ApiClient.get({ action: 'getFixtures', season: sid }),
        me.reloadSeasonPlayers(),
      ]).then(function (rs) {
        me.fixturesLoaded = rs[0].fixtures || [];
        me.renderList();
      });
    },

    sortedFixturesForDisplay: function () {
      var me = this;
      var leagueFx = [];
      var koFx = [];
      (this.fixturesLoaded || []).forEach(function (f) {
        if (f['Stage'] === 'knockout') koFx.push(f);
        else if (f['Stage'] === 'league') leagueFx.push(f);
      });

      leagueFx.sort(function (a, b) {
        var la = me.leagueDisplayOrder(a['League']);
        var lb = me.leagueDisplayOrder(b['League']);
        if (la !== lb) return la - lb;
        var wa = parseInt(String(a['Game Week']).trim(), 10);
        var wb = parseInt(String(b['Game Week']).trim(), 10);
        if (!Number.isFinite(wa)) wa = 0;
        if (!Number.isFinite(wb)) wb = 0;
        if (wa !== wb) return wa - wb;
        var na = String(a['Player A'] || '');
        var nb = String(b['Player A'] || '');
        return na.localeCompare(nb);
      });

      koFx.sort(function (a, b) {
        var sa = KnockoutRounds.sortKeyFor(a['Game Week']);
        var sb = KnockoutRounds.sortKeyFor(b['Game Week']);
        if (sa !== sb) return sa - sb;
        return String(a['Player A'] || '').localeCompare(String(b['Player A'] || ''));
      });

      return leagueFx.concat(koFx);
    },

    renderList: function () {
      var list = this.el.list;
      if (!list) return;
      list.innerHTML = '';
      var me = this;
      var items = this.sortedFixturesForDisplay();
      if (!items.length) {
        list.innerHTML = '<p class="admin-fixtures-empty"><em>No fixtures for this season.</em></p>';
        return;
      }

      var lastLeague = null;
      var lastWeek = null;
      var lastKoRound = null;

      items.forEach(function (f) {
        if (f['Stage'] === 'knockout') {
          var round = String(f['Game Week'] || '').trim();
          if (round !== lastKoRound) {
            lastKoRound = round;
            lastLeague = null;
            lastWeek = null;
            var h = document.createElement('h3');
            h.className = 'admin-fixtures-list__header';
            h.textContent = KnockoutRounds.labelFor(round);
            list.appendChild(h);
          }
        } else {
          lastKoRound = null;
          var lid = String(f['League'] || '');
          var week = String(f['Game Week'] || '').trim();
          var lg = me.leagueById(lid);
          var groupName = lg ? lg.name : 'Group ' + lid;
          if (lid !== lastLeague) {
            lastLeague = lid;
            lastWeek = null;
            var gh = document.createElement('h3');
            gh.className = 'admin-fixtures-list__header';
            gh.textContent = groupName;
            list.appendChild(gh);
          }
          if (week !== lastWeek) {
            lastWeek = week;
            var wh = document.createElement('h4');
            wh.className = 'admin-fixtures-list__subheader';
            var wn = parseInt(week, 10);
            wh.textContent = Number.isFinite(wn) ? 'Week ' + wn : week;
            list.appendChild(wh);
          }
        }

        var row = document.createElement('div');
        row.className = 'fixture-row admin-fixtures-list__row';
        row.dataset.fixtureId = f.fixtureId || '';

        var playerA = document.createElement('span');
        playerA.className = 'admin-fixtures-list__player-a';
        playerA.textContent = f['Player A'] || '';

        var center = document.createElement('button');
        center.type = 'button';
        center.className = 'fixture-vs-btn admin-fixtures-list__vs';
        center.textContent = 'V';
        center.setAttribute(
          'aria-label',
          'Edit fixture: ' + (f['Player A'] || '') + ' vs ' + (f['Player B'] || '')
        );
        center.addEventListener('click', function () {
          me.openDialogEdit(f);
        });

        var playerB = document.createElement('span');
        playerB.className = 'admin-fixtures-list__player-b';
        playerB.textContent = f['Player B'] || '';

        row.appendChild(playerA);
        row.appendChild(center);
        row.appendChild(playerB);
        list.appendChild(row);
      });
    },

    syncStageFields: function () {
      var stage = this.el.stage && this.el.stage.value;
      var isKo = stage === 'knockout';
      if (this.el.leagueFields) this.el.leagueFields.hidden = isKo;
      if (this.el.koFields) this.el.koFields.hidden = !isKo;
      if (this.el.league) this.el.league.required = !isKo;
      if (this.el.week) this.el.week.required = !isKo;
      if (this.el.round) this.el.round.required = isKo;
      this.fillPlayerSelects(
        this.el.pa && this.el.pa.value,
        this.el.pb && this.el.pb.value
      );
    },

    playersForDropdown: function () {
      var stage = this.el.stage && this.el.stage.value;
      var players = (this.seasonPlayers || []).slice();
      if (stage === 'league' && this.el.league && this.el.league.value) {
        var lid = String(this.el.league.value);
        players = players.filter(function (p) {
          return String(p.league || '') === lid;
        });
      }
      players.sort(function (a, b) {
        return String(a.playerName || '').localeCompare(String(b.playerName || ''));
      });
      return players;
    },

    fillPlayerSelects: function (selectedA, selectedB) {
      var pa = this.el.pa;
      var pb = this.el.pb;
      if (!pa || !pb) return;
      var players = this.playersForDropdown();
      pa.innerHTML = '<option value="">— Select —</option>';
      pb.innerHTML = '<option value="">— Select —</option>';
      players.forEach(function (p) {
        var oa = document.createElement('option');
        oa.value = p.playerId;
        oa.textContent = p.playerName;
        pa.appendChild(oa);
        var ob = document.createElement('option');
        ob.value = p.playerId;
        ob.textContent = p.playerName;
        pb.appendChild(ob);
      });
      if (selectedA) pa.value = selectedA;
      if (selectedB) pb.value = selectedB;
    },

    syncRoundCustom: function () {
      if (!this.el.roundCustom || !this.el.round) return;
      var custom = this.el.round.value === '__custom__';
      this.el.roundCustom.hidden = !custom;
      this.el.roundCustom.required = custom;
    },

    openDialogAdd: function () {
      if (this.el.fixtureId) this.el.fixtureId.value = '';
      if (this.el.stage) {
        this.el.stage.value = 'league';
        this.el.stage.disabled = false;
      }
      if (this.el.week) this.el.week.value = '';
      if (this.el.round) this.el.round.selectedIndex = 0;
      if (this.el.roundCustom) {
        this.el.roundCustom.value = '';
        this.el.roundCustom.hidden = true;
      }
      if (this.el.league && this.el.league.options.length) this.el.league.selectedIndex = 0;
      if (this.el.deleteBtn) this.el.deleteBtn.hidden = true;
      this.syncStageFields();
      this.fillPlayerSelects('', '');
      this.dialogFlash('', false);
      if (this.el.dialog && typeof this.el.dialog.showModal === 'function') {
        this.el.dialog.showModal();
      }
    },

    openDialogEdit: function (f) {
      if (this.el.fixtureId) this.el.fixtureId.value = f.fixtureId || '';
      var isKo = f['Stage'] === 'knockout';
      if (this.el.stage) {
        this.el.stage.value = isKo ? 'knockout' : 'league';
        this.el.stage.disabled = true;
      }
      if (isKo) {
        var code = String(f['Game Week'] || '').trim();
        if (KnockoutRounds.isKnownCode(code)) {
          if (this.el.round) this.el.round.value = code;
          if (this.el.roundCustom) {
            this.el.roundCustom.value = '';
            this.el.roundCustom.hidden = true;
          }
        } else {
          if (this.el.round) this.el.round.value = '__custom__';
          if (this.el.roundCustom) {
            this.el.roundCustom.value = code;
            this.el.roundCustom.hidden = false;
          }
        }
      } else {
        if (this.el.league) this.el.league.value = String(f['League'] || '');
        if (this.el.week) this.el.week.value = String(f['Game Week'] || '');
      }
      if (this.el.deleteBtn) this.el.deleteBtn.hidden = false;
      this.syncStageFields();
      this.fillPlayerSelects(f.playerAId || '', f.playerBId || '');
      this.dialogFlash('', false);
      if (this.el.dialog && typeof this.el.dialog.showModal === 'function') {
        this.el.dialog.showModal();
      }
    },

    closeDialog: function () {
      if (this.el.dialog && typeof this.el.dialog.close === 'function') {
        this.el.dialog.close();
      }
    },

    leagueSortOrder: function (leagueId, weekNum) {
      var ord = this.leagueDisplayOrder(leagueId);
      var w = Number.isFinite(weekNum) ? weekNum : 0;
      return ord * 1000 + w * 10;
    },

    saveDialog: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var seasonId = me.currentSeasonId();
      if (!seasonId) {
        me.dialogFlash('Select a season.', true);
        return;
      }
      var stage = me.el.stage && me.el.stage.value;
      var pa = me.el.pa && me.el.pa.value;
      var pb = me.el.pb && me.el.pb.value;
      if (!pa || !pb) {
        me.dialogFlash('Select both players.', true);
        return;
      }
      if (pa === pb) {
        me.dialogFlash('Players must be different.', true);
        return;
      }

      var payload = {
        seasonId: seasonId,
        stage: stage,
        playerAId: pa,
        playerBId: pb,
      };
      var fid = me.el.fixtureId && me.el.fixtureId.value.trim();
      if (fid) payload.fixtureId = fid;

      if (stage === 'knockout') {
        var roundVal = me.el.round && me.el.round.value;
        if (roundVal === '__custom__') {
          roundVal = (me.el.roundCustom && me.el.roundCustom.value.trim()) || '';
        }
        if (!roundVal) {
          me.dialogFlash('Select or enter a knockout round.', true);
          return;
        }
        payload.roundLabel = roundVal;
        payload.sortOrder = KnockoutRounds.sortOrderFor(roundVal);
      } else {
        var leagueId = me.el.league && me.el.league.value;
        var weekRaw = me.el.week && me.el.week.value.trim();
        var weekNum = parseInt(weekRaw, 10);
        if (!leagueId) {
          me.dialogFlash('Select a group.', true);
          return;
        }
        if (!weekRaw || !Number.isFinite(weekNum)) {
          me.dialogFlash('Enter a valid week number.', true);
          return;
        }
        payload.leagueId = leagueId;
        payload.roundLabel = String(weekNum);
        payload.sortOrder = me.leagueSortOrder(leagueId, weekNum);
      }

      ApiClient.post('upsertFixture', payload)
        .then(function () {
          me.flash('Fixture saved.', false);
          me.closeDialog();
          return me.reloadFixtures();
        })
        .catch(function (err) {
          me.dialogFlash(err.message || String(err), true);
        });
    },

    deleteFixture: function () {
      var me = this;
      var fid = me.el.fixtureId && me.el.fixtureId.value.trim();
      if (!fid) return;
      if (!window.confirm('Delete this fixture?')) return;
      ApiClient.post('deleteFixture', { fixtureId: fid })
        .then(function () {
          me.flash('Fixture deleted.', false);
          me.closeDialog();
          return me.reloadFixtures();
        })
        .catch(function (err) {
          me.dialogFlash(err.message || String(err), true);
        });
    },

    bind: function () {
      var me = this;
      if (this.el.seasonSelect) {
        this.el.seasonSelect.addEventListener('change', function () {
          me.reloadFixtures().catch(function (e) {
            me.flash(e.message || String(e), true);
          });
        });
      }
      if (this.el.addBtn) {
        this.el.addBtn.addEventListener('click', function () {
          me.openDialogAdd();
        });
      }
      if (this.el.stage) {
        this.el.stage.addEventListener('change', function () {
          me.syncStageFields();
        });
      }
      if (this.el.league) {
        this.el.league.addEventListener('change', function () {
          me.fillPlayerSelects(
            me.el.pa && me.el.pa.value,
            me.el.pb && me.el.pb.value
          );
        });
      }
      if (this.el.round) {
        this.el.round.addEventListener('change', function () {
          me.syncRoundCustom();
        });
      }
      if (this.el.form) {
        this.el.form.addEventListener('submit', function (e) {
          me.saveDialog(e);
        });
      }
      var cancel = document.getElementById('adminFxCancelBtn');
      if (cancel) {
        cancel.addEventListener('click', function () {
          me.closeDialog();
        });
      }
      if (this.el.deleteBtn) {
        this.el.deleteBtn.addEventListener('click', function () {
          me.deleteFixture();
        });
      }
    },

    init: function () {
      if (!document.getElementById('adminFixturesRoot')) return;
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
