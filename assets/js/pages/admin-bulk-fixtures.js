// Admin — bulk CSV import for league fixtures.

var AdminBulkFixturesPage = (function () {
  function buildPlayerResolver(players) {
    var exact = {};
    var lowerToIds = {};
    (players || []).forEach(function (p) {
      var n = String(p.playerName || '').trim();
      if (!n) return;
      exact[n] = p.playerId;
      var L = n.toLowerCase();
      if (!lowerToIds[L]) lowerToIds[L] = [];
      lowerToIds[L].push({ id: p.playerId, name: n });
    });
    return function (raw) {
      var t = String(raw || '').trim();
      if (!t) return { err: 'Empty player name' };
      if (exact[t]) return { id: exact[t] };
      var L = t.toLowerCase();
      var arr = lowerToIds[L] || [];
      var uniq = [];
      arr.forEach(function (x) {
        if (uniq.indexOf(x.id) < 0) uniq.push(x.id);
      });
      if (uniq.length === 1) return { id: uniq[0] };
      if (uniq.length > 1) return { err: 'Ambiguous name: ' + t };
      return { err: 'Unknown player: ' + t };
    };
  }

  var self = {
    seasons: [],
    leagues: [],
    playersAll: [],
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.gate = document.getElementById('adminBulkFxGate');
      this.el.panel = document.getElementById('adminBulkFxPanel');
      this.el.msg = document.getElementById('adminBulkFxMsg');
      this.el.seasonSelect = document.getElementById('adminBulkFxSeason');
      this.el.leagueSelect = document.getElementById('adminBulkFxLeague');
      this.el.csv = document.getElementById('adminBulkFxCsv');
      this.el.log = document.getElementById('adminBulkFxLog');
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

    fillSeasonLeague: function () {
      var ss = this.el.seasonSelect;
      var ls = this.el.leagueSelect;
      if (ss) {
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
      }
      if (ls) {
        ls.innerHTML = '';
        (this.leagues || []).forEach(function (L) {
          var o = document.createElement('option');
          o.value = L.leagueId;
          o.textContent = L.name + ' (' + L.leagueId + ')';
          ls.appendChild(o);
        });
        if (ls.options.length) ls.selectedIndex = 0;
      }
    },

    loadMeta: function () {
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
          me.playersAll = rs[2].players || [];
          me.fillSeasonLeague();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    currentSeasonId: function () {
      return this.el.seasonSelect && this.el.seasonSelect.value;
    },

    currentLeagueId: function () {
      return this.el.leagueSelect && this.el.leagueSelect.value;
    },

    resolveOrCreatePlayer: function (name, resolve, seasonId, leagueId, logLines) {
      var r = resolve(name);
      if (r.id) return Promise.resolve(r.id);
      if (r.err && !/^Unknown player:/i.test(r.err)) return Promise.reject(new Error(r.err));
      var slug = PlayerSlug.slugify(name);
      var me = this;
      return ApiClient.post('upsertPlayer', { playerId: slug, playerName: String(name).trim(), active: true })
        .then(function () {
          logLines.push('Created player ' + slug + ' for "' + String(name).trim() + '"');
          me.playersAll.push({ playerId: slug, playerName: String(name).trim(), active: true });
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: seasonId,
            playerId: slug,
            leagueId: leagueId,
          }).then(function () {
            return slug;
          });
        });
    },

    runBulkCsv: function () {
      var me = this;
      var raw = (this.el.csv && this.el.csv.value) || '';
      var lines = CsvParse.splitLines(raw);
      if (!lines.length) {
        this.flash('Paste CSV rows first.', true);
        return;
      }
      var delim = CsvParse.sniffDelimiter(lines[0]);
      var start = 0;
      var head = CsvParse.splitRow(lines[0], delim);
      if (head.length >= 3 && /gameweek/i.test(head[0])) start = 1;

      var seasonId = me.currentSeasonId();
      var leagueId = me.currentLeagueId();
      if (!seasonId || !leagueId) {
        me.flash('Select season and league.', true);
        return;
      }

      var logLines = [];

      function runRow(i) {
        if (i >= lines.length) {
          me.el.log.textContent = logLines.join('\n');
          me.flash('Bulk import finished.', false);
          return me.loadMeta();
        }
        var resolve = buildPlayerResolver(me.playersAll);
        var parts = CsvParse.splitRow(lines[i], delim);
        if (parts.length < 3) {
          logLines.push('Line ' + (i + 1) + ': need 3 columns');
          return runRow(i + 1);
        }
        var gw = parts[0];
        var na = parts[1];
        var nb = parts[2];
        var so = parseInt(gw, 10);
        if (!Number.isFinite(so)) so = 0;

        Promise.all([
          me.resolveOrCreatePlayer(na, resolve, seasonId, leagueId, logLines),
          me.resolveOrCreatePlayer(nb, resolve, seasonId, leagueId, logLines),
        ])
          .then(function (ids) {
            var pa = ids[0];
            var pb = ids[1];
            if (pa === pb) throw new Error('Same player twice');
            return ApiClient.post('upsertFixture', {
              seasonId: seasonId,
              stage: 'league',
              leagueId: leagueId,
              roundLabel: String(gw).trim(),
              playerAId: pa,
              playerBId: pb,
              sortOrder: so,
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
      var bulk = document.getElementById('adminBulkFxRun');
      if (bulk) bulk.addEventListener('click', function () { me.runBulkCsv(); });
    },

    init: function () {
      if (!document.getElementById('adminBulkFixturesRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () { me.syncGate(); });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
