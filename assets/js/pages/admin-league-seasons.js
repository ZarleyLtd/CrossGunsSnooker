// Admin — seasons, leagues, season_players roster.

var AdminLeagueSeasonsPage = (function () {
  function esc(s) {
    var t = String(s == null ? '' : s);
    return t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var self = {
    seasons: [],
    leagues: [],
    rosterPlayers: [],
    allPlayers: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminLsGate');
      this.el.panel = document.getElementById('adminLsPanel');
      this.el.msg = document.getElementById('adminLsMsg');
      this.el.stbody = document.getElementById('adminLsSeasonsTbody');
      this.el.ltbody = document.getElementById('adminLsLeaguesTbody');
      this.el.rtbody = document.getElementById('adminLsRosterTbody');
      this.el.rSeason = document.getElementById('adminLsRosterSeason');
      this.el.sForm = document.getElementById('adminLsSeasonForm');
      this.el.sId = document.getElementById('adminLsSeasonId');
      this.el.sName = document.getElementById('adminLsSeasonName');
      this.el.sStart = document.getElementById('adminLsSeasonStart');
      this.el.sEnd = document.getElementById('adminLsSeasonEnd');
      this.el.sCur = document.getElementById('adminLsSeasonCurrent');
      this.el.sType = document.getElementById('adminLsSeasonType');
      this.el.lForm = document.getElementById('adminLsLeagueForm');
      this.el.lId = document.getElementById('adminLsLeagueId');
      this.el.lName = document.getElementById('adminLsLeagueName');
      this.el.lOrd = document.getElementById('adminLsLeagueOrder');
      this.el.rAddPid = document.getElementById('adminLsRosterPlayerId');
      this.el.rAddLid = document.getElementById('adminLsRosterLeagueId');
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
      if (ok) this.loadBase();
    },

    fillPlayerDatalist: function () {
      var dl = document.getElementById('adminLsPlayersDatalist');
      if (!dl) return;
      dl.innerHTML = '';
      (this.allPlayers || []).forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.playerId;
        o.label = p.playerName;
        dl.appendChild(o);
      });
    },

    loadBase: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;
      Promise.all([
        ApiClient.get({ action: 'getSeasons' }),
        ApiClient.get({ action: 'getLeagues' }),
        ApiClient.get({ action: 'getPlayers' }),
      ])
        .then(function (rs) {
          me.seasons = rs[0].seasons || [];
          me.leagues = rs[1].leagues || [];
          me.allPlayers = rs[2].players || [];
          me.fillRosterSeasonSelect();
          me.fillPlayerDatalist();
          me.renderSeasons();
          me.renderLeagues();
          return me.reloadRoster();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    fillRosterSeasonSelect: function () {
      var rs = this.el.rSeason;
      var rl = this.el.rAddLid;
      if (!rs) return;
      rs.innerHTML = '';
      var cur = null;
      (this.seasons || []).forEach(function (s) {
        var o = document.createElement('option');
        o.value = s.seasonId;
        o.textContent = s.name + ' (' + s.seasonId + ')';
        if (s.isCurrent && !cur) cur = s.seasonId;
        if (s.isCurrent && s.competitionType === 'league') cur = s.seasonId;
        rs.appendChild(o);
      });
      if (cur && rs.querySelector('option[value="' + cur + '"]')) rs.value = cur;
      if (rl) {
        rl.innerHTML = '';
        (this.leagues || []).forEach(function (L) {
          var o = document.createElement('option');
          o.value = L.leagueId;
          o.textContent = L.name;
          rl.appendChild(o);
        });
        if (rl.options.length) rl.selectedIndex = 0;
      }
    },

    reloadRoster: function () {
      var me = this;
      var sid = me.el.rSeason && me.el.rSeason.value;
      if (!sid) return Promise.resolve();
      return ApiClient.get({ action: 'getPlayers', season: sid }).then(function (r) {
        me.rosterPlayers = r.players || [];
        me.renderRoster();
      });
    },

    renderSeasons: function () {
      var tb = this.el.stbody;
      if (!tb) return;
      tb.innerHTML = '';
      var me = this;
      (this.seasons || []).forEach(function (s) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' +
          esc(s.seasonId) +
          '</code></td><td>' +
          esc(s.name) +
          '</td><td>' +
          esc(s.startsOn || '') +
          '</td><td>' +
          esc(s.endsOn || '') +
          '</td><td>' +
          (s.isCurrent ? 'Yes' : 'No') +
          '</td><td>' +
          esc(s.competitionType || 'league') +
          '</td><td><button type="button" class="btn admin-ls-se">Edit</button> <button type="button" class="btn admin-ls-sd">Delete</button></td>';
        tr.querySelector('.admin-ls-se').addEventListener('click', function () {
          me.openSeason(s);
        });
        tr.querySelector('.admin-ls-sd').addEventListener('click', function () {
          me.deleteSeason(s);
        });
        tb.appendChild(tr);
      });
    },

    renderLeagues: function () {
      var tb = this.el.ltbody;
      if (!tb) return;
      tb.innerHTML = '';
      var me = this;
      (this.leagues || []).forEach(function (L) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' +
          esc(L.leagueId) +
          '</code></td><td>' +
          esc(L.name) +
          '</td><td>' +
          esc(String(L.displayOrder)) +
          '</td><td><button type="button" class="btn admin-ls-le">Edit</button> <button type="button" class="btn admin-ls-ld">Delete</button></td>';
        tr.querySelector('.admin-ls-le').addEventListener('click', function () {
          me.openLeague(L);
        });
        tr.querySelector('.admin-ls-ld').addEventListener('click', function () {
          me.deleteLeague(L);
        });
        tb.appendChild(tr);
      });
    },

    renderRoster: function () {
      var tb = this.el.rtbody;
      if (!tb) return;
      tb.innerHTML = '';
      var me = this;
      (this.rosterPlayers || []).forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' +
          esc(p.playerId) +
          '</code></td><td>' +
          esc(p.playerName) +
          '</td><td>' +
          esc(p.league || '') +
          '</td><td><select class="admin-ls-rch">' +
          me.leagueOptionsHtml(p.league) +
          '</select> <button type="button" class="btn admin-ls-ru">Save league</button> <button type="button" class="btn admin-ls-rr">Remove</button></td>';
        tr.querySelector('.admin-ls-ru').addEventListener('click', function () {
          var sel = tr.querySelector('.admin-ls-rch');
          var lid = sel && sel.value;
          if (!lid) return;
          me.updateRosterMember(p.playerId, lid);
        });
        tr.querySelector('.admin-ls-rr').addEventListener('click', function () {
          me.removeRosterMember(p.playerId);
        });
        tb.appendChild(tr);
      });
    },

    leagueOptionsHtml: function (current) {
      var h = '';
      (this.leagues || []).forEach(function (L) {
        var sel = String(L.leagueId) === String(current || '') ? ' selected' : '';
        h += '<option value="' + esc(L.leagueId) + '"' + sel + '>' + esc(L.name) + '</option>';
      });
      return h;
    },

    openSeason: function (s) {
      if (this.el.sId) {
        this.el.sId.value = s.seasonId;
        this.el.sId.readOnly = true;
      }
      if (this.el.sName) this.el.sName.value = s.name || '';
      if (this.el.sStart) this.el.sStart.value = s.startsOn || '';
      if (this.el.sEnd) this.el.sEnd.value = s.endsOn || '';
      if (this.el.sCur) this.el.sCur.checked = !!s.isCurrent;
      if (this.el.sType) {
        this.el.sType.value = s.competitionType === 'knockout' ? 'knockout' : 'league';
      }
    },

    clearSeasonForm: function () {
      if (this.el.sId) {
        this.el.sId.value = '';
        this.el.sId.readOnly = false;
      }
      if (this.el.sName) this.el.sName.value = '';
      if (this.el.sStart) this.el.sStart.value = '';
      if (this.el.sEnd) this.el.sEnd.value = '';
      if (this.el.sCur) this.el.sCur.checked = false;
      if (this.el.sType) this.el.sType.value = 'league';
    },

    saveSeason: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var id = (me.el.sId && me.el.sId.value.trim()) || '';
      var name = (me.el.sName && me.el.sName.value.trim()) || '';
      if (!id || !name) {
        me.flash('Season id and name required.', true);
        return;
      }
      var payload = {
        seasonId: id,
        name: name,
        isCurrent: me.el.sCur ? me.el.sCur.checked : false,
        competitionType: me.el.sType ? me.el.sType.value : 'league',
      };
      var a = me.el.sStart && me.el.sStart.value.trim();
      var b = me.el.sEnd && me.el.sEnd.value.trim();
      if (a) payload.startsOn = a;
      if (b) payload.endsOn = b;
      ApiClient.post('upsertSeason', payload)
        .then(function () {
          me.flash('Season saved.', false);
          me.clearSeasonForm();
          return me.loadBase();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    deleteSeason: function (s) {
      if (!window.confirm('Delete season ' + s.seasonId + '? Only allowed when no fixtures exist.')) return;
      var me = this;
      ApiClient.post('deleteSeason', { seasonId: s.seasonId })
        .then(function () {
          me.flash('Season deleted.', false);
          return me.loadBase();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    openLeague: function (L) {
      if (this.el.lId) {
        this.el.lId.value = L.leagueId;
        this.el.lId.readOnly = true;
      }
      if (this.el.lName) this.el.lName.value = L.name || '';
      if (this.el.lOrd) this.el.lOrd.value = L.displayOrder != null ? String(L.displayOrder) : '0';
    },

    clearLeagueForm: function () {
      if (this.el.lId) {
        this.el.lId.value = '';
        this.el.lId.readOnly = false;
      }
      if (this.el.lName) this.el.lName.value = '';
      if (this.el.lOrd) this.el.lOrd.value = '0';
    },

    saveLeague: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var id = (me.el.lId && me.el.lId.value.trim()) || '';
      var name = (me.el.lName && me.el.lName.value.trim()) || '';
      var ord = parseInt((me.el.lOrd && me.el.lOrd.value) || '0', 10);
      if (!id || !name) {
        me.flash('League id and name required.', true);
        return;
      }
      if (!Number.isFinite(ord)) ord = 0;
      ApiClient.post('upsertLeague', { leagueId: id, name: name, displayOrder: ord })
        .then(function () {
          me.flash('League saved.', false);
          me.clearLeagueForm();
          return me.loadBase();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    deleteLeague: function (L) {
      if (!window.confirm('Delete league ' + L.leagueId + '?')) return;
      var me = this;
      ApiClient.post('deleteLeague', { leagueId: L.leagueId })
        .then(function () {
          me.flash('League deleted.', false);
          return me.loadBase();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    updateRosterMember: function (playerId, leagueId) {
      var me = this;
      var sid = me.el.rSeason && me.el.rSeason.value;
      if (!sid) return;
      ApiClient.post('upsertSeasonPlayer', { seasonId: sid, playerId: playerId, leagueId: leagueId })
        .then(function () {
          me.flash('Roster updated.', false);
          return me.reloadRoster();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    removeRosterMember: function (playerId) {
      if (!window.confirm('Remove this player from the season roster?')) return;
      var me = this;
      var sid = me.el.rSeason && me.el.rSeason.value;
      if (!sid) return;
      ApiClient.post('upsertSeasonPlayer', { seasonId: sid, playerId: playerId, remove: true })
        .then(function () {
          me.flash('Removed from roster.', false);
          return me.reloadRoster();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    addRosterMember: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var sid = me.el.rSeason && me.el.rSeason.value;
      var pid = (me.el.rAddPid && me.el.rAddPid.value.trim()) || '';
      var lid = (me.el.rAddLid && me.el.rAddLid.value) || '';
      if (!sid || !pid || !lid) {
        me.flash('Season, player id, and league required.', true);
        return;
      }
      ApiClient.post('upsertSeasonPlayer', { seasonId: sid, playerId: pid, leagueId: lid })
        .then(function () {
          me.flash('Player added to roster.', false);
          if (me.el.rAddPid) me.el.rAddPid.value = '';
          return me.reloadRoster();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    bind: function () {
      var me = this;
      if (this.el.sForm) this.el.sForm.addEventListener('submit', function (e) { me.saveSeason(e); });
      var sc = document.getElementById('adminLsSeasonClear');
      if (sc) sc.addEventListener('click', function () { me.clearSeasonForm(); me.flash('', false); });
      if (this.el.lForm) this.el.lForm.addEventListener('submit', function (e) { me.saveLeague(e); });
      var lc = document.getElementById('adminLsLeagueClear');
      if (lc) lc.addEventListener('click', function () { me.clearLeagueForm(); me.flash('', false); });
      if (this.el.rSeason) this.el.rSeason.addEventListener('change', function () { me.reloadRoster(); });
      var ra = document.getElementById('adminLsRosterAddForm');
      if (ra) ra.addEventListener('submit', function (e) { me.addRosterMember(e); });
    },

    init: function () {
      if (!document.getElementById('adminLeagueSeasonsRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () { me.syncGate(); });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
