// Admin — league fixtures: CSV bulk + table CRUD (current season/league context).

var AdminFixturesPage = (function () {
  function esc(s) {
    var t = String(s == null ? '' : s);
    return t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
      this.el.leagueSelect = document.getElementById('adminFxLeague');
      this.el.tbody = document.getElementById('adminFxTbody');
      this.el.log = document.getElementById('adminFxLog');
      this.el.csv = document.getElementById('adminFxCsv');
      this.el.form = document.getElementById('adminFxForm');
      this.el.fixtureId = document.getElementById('adminFxFixtureId');
      this.el.round = document.getElementById('adminFxRound');
      this.el.pa = document.getElementById('adminFxPa');
      this.el.pb = document.getElementById('adminFxPb');
      this.el.md = document.getElementById('adminFxMd');
      this.el.so = document.getElementById('adminFxSo');
      this.el.datalist = document.getElementById('adminFxPlayersDatalist');
      this.el.msg = document.getElementById('adminFxMsg');
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

    fillDatalist: function () {
      var dl = this.el.datalist;
      if (!dl) return;
      dl.innerHTML = '';
      (this.playersAll || []).forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.playerName;
        dl.appendChild(o);
      });
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
          o.textContent = s.name + ' (' + s.seasonId + ')' + (s.isCurrent ? ' — current' : '');
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
          me.fillDatalist();
          return me.reloadFixtures();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    reloadFixtures: function () {
      var me = this;
      var sid = me.el.seasonSelect && me.el.seasonSelect.value;
      if (!sid) return Promise.resolve();
      return ApiClient.get({ action: 'getFixtures', season: sid }).then(function (r) {
        me.fixturesLoaded = r.fixtures || [];
        me.renderTable();
      });
    },

    renderTable: function () {
      var lid = this.el.leagueSelect && this.el.leagueSelect.value;
      var tb = this.el.tbody;
      if (!tb) return;
      tb.innerHTML = '';
      var me = this;
      (this.fixturesLoaded || []).forEach(function (f) {
        if (f['Stage'] !== 'league' || String(f['League'] || '') !== String(lid || '')) return;
        var tr = document.createElement('tr');
        tr.dataset.fixtureId = f.fixtureId;
        tr.innerHTML =
          '<td>' +
          esc(f['Game Week']) +
          '</td><td>' +
          esc(f['Player A']) +
          '</td><td>' +
          esc(f['Player B']) +
          '</td><td>' +
          esc(f['Match Date'] || '') +
          '</td><td>' +
          esc(String(f.sortOrder != null ? f.sortOrder : '')) +
          '</td><td><button type="button" class="btn admin-row-edit">Edit</button> <button type="button" class="btn admin-row-del">Delete</button></td>';
        tr.querySelector('.admin-row-edit').addEventListener('click', function () {
          me.openEdit(f);
        });
        tr.querySelector('.admin-row-del').addEventListener('click', function () {
          me.confirmDelete(f);
        });
        tb.appendChild(tr);
      });
    },

    openEdit: function (f) {
      if (this.el.fixtureId) this.el.fixtureId.value = f.fixtureId || '';
      if (this.el.round) this.el.round.value = f['Game Week'] || '';
      if (this.el.pa) this.el.pa.value = f['Player A'] || '';
      if (this.el.pb) this.el.pb.value = f['Player B'] || '';
      if (this.el.md) this.el.md.value = f['Match Date'] || '';
      if (this.el.so) this.el.so.value = f.sortOrder != null ? String(f.sortOrder) : '';
      this.flash('Editing fixture — save to apply.', false);
    },

    clearForm: function () {
      if (this.el.fixtureId) this.el.fixtureId.value = '';
      if (this.el.round) this.el.round.value = '';
      if (this.el.pa) this.el.pa.value = '';
      if (this.el.pb) this.el.pb.value = '';
      if (this.el.md) this.el.md.value = '';
      if (this.el.so) this.el.so.value = '';
    },

    confirmDelete: function (f) {
      if (!window.confirm('Delete this fixture?')) return;
      var me = this;
      ApiClient.post('deleteFixture', { fixtureId: f.fixtureId })
        .then(function () {
          me.flash('Fixture deleted.', false);
          return me.reloadFixtures();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
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

    saveForm: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var seasonId = me.currentSeasonId();
      var leagueId = me.currentLeagueId();
      var resolve = buildPlayerResolver(me.playersAll);
      var roundLabel = (me.el.round && me.el.round.value.trim()) || '';
      var paName = (me.el.pa && me.el.pa.value.trim()) || '';
      var pbName = (me.el.pb && me.el.pb.value.trim()) || '';
      if (!roundLabel || !paName || !pbName) {
        me.flash('Round / Player A / Player B required.', true);
        return;
      }
      var md = (me.el.md && me.el.md.value.trim()) || null;
      var soRaw = me.el.so && me.el.so.value.trim();
      var sortOrder = soRaw === '' ? 0 : parseInt(soRaw, 10);
      if (!Number.isFinite(sortOrder)) sortOrder = 0;

      var logLines = [];
      Promise.all([
        me.resolveOrCreatePlayer(paName, resolve, seasonId, leagueId, logLines),
        me.resolveOrCreatePlayer(pbName, resolve, seasonId, leagueId, logLines),
      ])
        .then(function (ids) {
          var payload = {
            seasonId: seasonId,
            stage: 'league',
            leagueId: leagueId,
            roundLabel: roundLabel,
            playerAId: ids[0],
            playerBId: ids[1],
            sortOrder: sortOrder,
          };
          if (md) payload.matchDate = md;
          var fid = me.el.fixtureId && me.el.fixtureId.value.trim();
          if (fid) payload.fixtureId = fid;
          return ApiClient.post('upsertFixture', payload).then(function () {
            if (logLines.length && me.el.log) me.el.log.textContent = logLines.join('\n');
            me.flash('Fixture saved.', false);
            me.clearForm();
            return me.reloadFixtures();
          });
        })
        .then(function () {
          return me.loadMeta();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        });
    },

    bind: function () {
      var me = this;
      if (this.el.seasonSelect) {
        this.el.seasonSelect.addEventListener('change', function () {
          me.reloadFixtures();
        });
      }
      if (this.el.leagueSelect) {
        this.el.leagueSelect.addEventListener('change', function () {
          me.renderTable();
        });
      }
      var bulk = document.getElementById('adminFxBulkRun');
      if (bulk) bulk.addEventListener('click', function () { me.runBulkCsv(); });
      if (this.el.form) this.el.form.addEventListener('submit', function (e) { me.saveForm(e); });
      var clr = document.getElementById('adminFxFormClear');
      if (clr) clr.addEventListener('click', function () { me.clearForm(); me.flash('', false); });
    },

    init: function () {
      if (!document.getElementById('adminFixturesRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () { me.syncGate(); });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
