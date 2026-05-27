// Admin — bulk CSV import for players + handicaps.

var AdminBulkPlayersPage = (function () {
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
    seasons: [],
    leagues: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminBulkPlGate');
      this.el.panel = document.getElementById('adminBulkPlPanel');
      this.el.msg = document.getElementById('adminBulkPlMsg');
      this.el.log = document.getElementById('adminBulkPlLog');
      this.el.csv = document.getElementById('adminBulkPlCsv');
      this.el.rosterSeason = document.getElementById('adminBulkPlRosterSeason');
      this.el.rosterLeague = document.getElementById('adminBulkPlRosterLeague');
      this.el.rosterChk = document.getElementById('adminBulkPlRosterChk');
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
      if (ok) this.loadMeta();
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

    loadMeta: function () {
      var me = this;
      Promise.all([ApiClient.get({ action: 'getSeasons' }), ApiClient.get({ action: 'getLeagues' })])
        .then(function (rs) {
          me.seasons = rs[0].seasons || [];
          me.leagues = rs[1].leagues || [];
          me.fillRosterSelects();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
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
          return;
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
      var bk = document.getElementById('adminBulkPlRun');
      if (bk) bk.addEventListener('click', function () { me.runBulk(); });
    },

    init: function () {
      if (!document.getElementById('adminBulkPlayersRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () { me.syncGate(); });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
