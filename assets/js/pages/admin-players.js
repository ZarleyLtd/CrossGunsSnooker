// Admin — players + handicaps: CSV bulk + CRUD.

var AdminPlayersPage = (function () {
  function esc(s) {
    var t = String(s == null ? '' : s);
    return t
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

  var self = {
    players: [],
    handicaps: [],
    seasons: [],
    leagues: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminPlayersGate');
      this.el.panel = document.getElementById('adminPlayersPanel');
      this.el.msg = document.getElementById('adminPlMsg');
      this.el.log = document.getElementById('adminPlLog');
      this.el.csv = document.getElementById('adminPlCsv');
      this.el.rosterSeason = document.getElementById('adminPlRosterSeason');
      this.el.rosterLeague = document.getElementById('adminPlRosterLeague');
      this.el.rosterChk = document.getElementById('adminPlRosterChk');
      this.el.ptbody = document.getElementById('adminPlPlayersTbody');
      this.el.htbody = document.getElementById('adminPlHandicapsTbody');
      this.el.pForm = document.getElementById('adminPlPlayerForm');
      this.el.pId = document.getElementById('adminPlPlayerId');
      this.el.pName = document.getElementById('adminPlPlayerName');
      this.el.pActive = document.getElementById('adminPlPlayerActive');
      this.el.hForm = document.getElementById('adminPlHcForm');
      this.el.hId = document.getElementById('adminPlHcId');
      this.el.hPid = document.getElementById('adminPlHcPlayerId');
      this.el.hVal = document.getElementById('adminPlHcVal');
      this.el.hDate = document.getElementById('adminPlHcDate');
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
      if (ok) this.loadAll();
    },

    fillRosterSelects: function () {
      var rs = this.el.rosterSeason;
      var rl = this.el.rosterLeague;
      if (rs) {
        rs.innerHTML = '';
        (this.seasons || []).forEach(function (s) {
          var o = document.createElement('option');
          o.value = s.seasonId;
          o.textContent = s.name + ' (' + s.seasonId + ')';
          rs.appendChild(o);
        });
        var cur = null;
        (this.seasons || []).forEach(function (s) {
          if (s.isCurrent) cur = s.seasonId;
        });
        if (cur && rs.querySelector('option[value="' + cur + '"]')) rs.value = cur;
      }
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

    loadAll: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;
      Promise.all([
        ApiClient.get({ action: 'getPlayers' }),
        ApiClient.get({ action: 'getHandicaps' }),
        ApiClient.get({ action: 'getSeasons' }),
        ApiClient.get({ action: 'getLeagues' }),
      ])
        .then(function (rs) {
          me.players = rs[0].players || [];
          me.handicaps = rs[1].handicaps || [];
          me.seasons = rs[2].seasons || [];
          me.leagues = rs[3].leagues || [];
          me.fillRosterSelects();
          me.renderPlayers();
          me.renderHandicaps();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    renderPlayers: function () {
      var tb = this.el.ptbody;
      if (!tb) return;
      tb.innerHTML = '';
      var me = this;
      (this.players || []).forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td><code>' +
          esc(p.playerId) +
          '</code></td><td>' +
          esc(p.playerName) +
          '</td><td>' +
          (p.active ? 'Yes' : 'No') +
          '</td><td><button type="button" class="btn admin-pl-pe">Edit</button> <button type="button" class="btn admin-pl-pd">Delete</button></td>';
        tr.querySelector('.admin-pl-pe').addEventListener('click', function () {
          me.openPlayer(p);
        });
        tr.querySelector('.admin-pl-pd').addEventListener('click', function () {
          me.deletePlayerRow(p);
        });
        tb.appendChild(tr);
      });
    },

    renderHandicaps: function () {
      var tb = this.el.htbody;
      if (!tb) return;
      tb.innerHTML = '';
      var me = this;
      (this.handicaps || []).forEach(function (h) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td>' +
          esc(h['Player Name'] || h.playerId) +
          '</td><td>' +
          esc(String(h['Handicap'])) +
          '</td><td>' +
          esc(h['Handicap Date'] || '') +
          '</td><td><button type="button" class="btn admin-pl-he">Edit</button> <button type="button" class="btn admin-pl-hd">Delete</button></td>';
        tr.querySelector('.admin-pl-he').addEventListener('click', function () {
          me.openHc(h);
        });
        tr.querySelector('.admin-pl-hd').addEventListener('click', function () {
          me.deleteHcRow(h);
        });
        tb.appendChild(tr);
      });
    },

    openPlayer: function (p) {
      if (this.el.pId) {
        this.el.pId.value = p.playerId;
        this.el.pId.readOnly = true;
      }
      if (this.el.pName) this.el.pName.value = p.playerName || '';
      if (this.el.pActive) this.el.pActive.checked = p.active !== false;
    },

    clearPlayerForm: function () {
      if (this.el.pId) {
        this.el.pId.value = '';
        this.el.pId.readOnly = false;
      }
      if (this.el.pName) this.el.pName.value = '';
      if (this.el.pActive) this.el.pActive.checked = true;
    },

    savePlayer: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var name = (me.el.pName && me.el.pName.value.trim()) || '';
      if (!name) {
        me.flash('Player name required.', true);
        return;
      }
      var pid = (me.el.pId && me.el.pId.value.trim()) || PlayerSlug.slugify(name);
      var active = me.el.pActive ? me.el.pActive.checked : true;
      ApiClient.post('upsertPlayer', { playerId: pid, playerName: name, active: active })
        .then(function () {
          me.flash('Player saved.', false);
          me.clearPlayerForm();
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    deletePlayerRow: function (p) {
      if (!window.confirm('Delete player ' + p.playerId + '? Fails if still on fixtures/breaks.')) return;
      var me = this;
      ApiClient.post('deletePlayer', { playerId: p.playerId })
        .then(function () {
          me.flash('Player deleted.', false);
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    openHc: function (h) {
      if (this.el.hId) this.el.hId.value = h.handicapId || '';
      if (this.el.hPid) this.el.hPid.value = h.playerId || '';
      if (this.el.hVal) this.el.hVal.value = h['Handicap'] != null ? String(h['Handicap']) : '';
      if (this.el.hDate) this.el.hDate.value = h['Handicap Date'] || '';
    },

    clearHcForm: function () {
      if (this.el.hId) this.el.hId.value = '';
      if (this.el.hPid) this.el.hPid.value = '';
      if (this.el.hVal) this.el.hVal.value = '';
      if (this.el.hDate) this.el.hDate.value = '';
    },

    saveHc: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var hid = (me.el.hId && me.el.hId.value.trim()) || '';
      var pid = (me.el.hPid && me.el.hPid.value.trim()) || '';
      var hv = me.el.hVal && me.el.hVal.value.trim();
      var dt = normDate(me.el.hDate && me.el.hDate.value);
      if (!pid || hv === '' || !dt) {
        me.flash('Player id, handicap, and effective date (YYYY-MM-DD) required.', true);
        return;
      }
      var payload = { playerId: pid, handicap: Number(hv), effectiveDate: dt };
      if (hid) payload.handicapId = hid;
      ApiClient.post('upsertHandicap', payload)
        .then(function () {
          me.flash('Handicap saved.', false);
          me.clearHcForm();
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
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    runBulk: function () {
      var me = this;
      var raw = (this.el.csv && this.el.csv.value) || '';
      var lines = CsvParse.splitLines(raw);
      if (!lines.length) {
        me.flash('Paste CSV first.', true);
        return;
      }
      var delim = CsvParse.sniffDelimiter(lines[0]);
      var start = 0;
      var head = CsvParse.splitRow(lines[0], delim);
      if (head.length >= 3 && /playername/i.test(head[0])) start = 1;

      var addRoster = me.el.rosterChk && me.el.rosterChk.checked;
      var seasonId = me.el.rosterSeason && me.el.rosterSeason.value;
      var leagueId = me.el.rosterLeague && me.el.rosterLeague.value;
      if (addRoster && (!seasonId || !leagueId)) {
        me.flash('Select season and league for roster checkbox, or turn off roster.', true);
        return;
      }

      var logLines = [];

      function runRow(i) {
        if (i >= lines.length) {
          if (me.el.log) me.el.log.textContent = logLines.join('\n');
          me.flash('Bulk finished.', false);
          return me.loadAll();
        }
        var parts = CsvParse.splitRow(lines[i], delim);
        if (parts.length < 3) {
          logLines.push('Line ' + (i + 1) + ': need 3 columns');
          return runRow(i + 1);
        }
        var pname = parts[0];
        var hc = Number(parts[1]);
        var ed = normDate(parts[2]);
        if (!ed) {
          logLines.push('Line ' + (i + 1) + ': bad date');
          return runRow(i + 1);
        }
        if (!Number.isFinite(hc)) {
          logLines.push('Line ' + (i + 1) + ': bad handicap');
          return runRow(i + 1);
        }
        var pid = PlayerSlug.slugify(pname);
        ApiClient.post('upsertPlayer', { playerId: pid, playerName: String(pname).trim(), active: true })
          .then(function () {
            return ApiClient.post('upsertHandicap', {
              playerId: pid,
              handicap: hc,
              effectiveDate: ed,
            }).then(function () {
              if (addRoster) {
                return ApiClient.post('upsertSeasonPlayer', {
                  seasonId: seasonId,
                  playerId: pid,
                  leagueId: leagueId,
                });
              }
            });
          })
          .then(function () {
            logLines.push('Line ' + (i + 1) + ': OK');
            runRow(i + 1);
          })
          .catch(function (e) {
            logLines.push('Line ' + (i + 1) + ': ' + (e.message || String(e)));
            runRow(i + 1);
          });
      }

      runRow(start);
    },

    bind: function () {
      var me = this;
      if (this.el.pForm) this.el.pForm.addEventListener('submit', function (e) { me.savePlayer(e); });
      var pc = document.getElementById('adminPlPlayerClear');
      if (pc) pc.addEventListener('click', function () { me.clearPlayerForm(); me.flash('', false); });
      if (this.el.hForm) this.el.hForm.addEventListener('submit', function (e) { me.saveHc(e); });
      var hc = document.getElementById('adminPlHcClear');
      if (hc) hc.addEventListener('click', function () { me.clearHcForm(); me.flash('', false); });
      var bk = document.getElementById('adminPlBulkRun');
      if (bk) bk.addEventListener('click', function () { me.runBulk(); });
    },

    init: function () {
      if (!document.getElementById('adminPlayersRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () { me.syncGate(); });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
