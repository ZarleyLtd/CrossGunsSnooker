// Admin — league + knockout fixtures: grouped list + modal add/edit.

var AdminFixturesPage = (function () {
  var KNOCKOUT_GROUP_ID = 'ko';

  function compIdOf(c) {
    return c ? String(c.compId || c.seasonId || '') : '';
  }

  function playerLeague(p) {
    if (!p) return '';
    return p.league != null ? p.league : p.leagueId || p.groupId || p.group;
  }

  var self = {
    seasons: [],
    leagues: [],
    seasonPlayers: [],
    fixturesLoaded: [],
    currentCompType: 'league',
    _internalMatchNum: 1,
    _isEditMode: false,
    el: {},

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el.root = document.getElementById('adminFixturesRoot');
      this.el.gate = document.getElementById('adminFixturesGate');
      this.el.panel = document.getElementById('adminFixturesPanel');
      this.el.compSelect = document.getElementById('adminFxSeason');
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
      this.el.bestOfLeague = document.getElementById('adminFxBestOfLeague');
      this.el.bestOfKo = document.getElementById('adminFxBestOfKo');
      this.el.coherenceWarn = document.getElementById('adminFxCoherenceWarn');
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

    displayFixturePlayerName: function (f, slot) {
      var id = slot === 'b' ? f.playerBId : f.playerAId;
      var fallback = slot === 'b' ? f['Player B'] : f['Player A'];
      if (KnockoutRounds.isWinnerOfPlayerId(id)) {
        return KnockoutRounds.winnerOfDisplayLabel(KnockoutRounds.roundCodeFromWinnerOfId(id));
      }
      return fallback || '';
    },

    fillCompSelect: function () {
      var ss = this.el.compSelect;
      if (!ss) return;
      ss.innerHTML = '';
      var cur = null;
      (this.seasons || []).forEach(function (c) {
        var o = document.createElement('option');
        o.value = compIdOf(c);
        o.textContent = c.name;
        if (c.isCurrent) cur = compIdOf(c);
        ss.appendChild(o);
      });
      if (cur && ss.querySelector('option[value="' + cur + '"]')) ss.value = cur;
      else if (ss.options.length) ss.selectedIndex = 0;
    },

    leaguesForLeagueSelect: function () {
      return (this.leagues || []).filter(function (L) {
        return String(L.leagueId) !== KNOCKOUT_GROUP_ID;
      });
    },

    fillLeagueSelect: function (selectedLeagueId) {
      var ls = this.el.league;
      if (!ls) return;
      var keep = selectedLeagueId != null ? String(selectedLeagueId) : ls.value;
      ls.innerHTML = '';
      this.leaguesForLeagueSelect().forEach(function (L) {
        var o = document.createElement('option');
        o.value = L.leagueId;
        o.textContent = L.name;
        ls.appendChild(o);
      });
      if (keep && ls.querySelector('option[value="' + keep + '"]')) ls.value = keep;
      else if (ls.options.length) ls.selectedIndex = 0;
    },

    knockoutPlayerCount: function () {
      return (this.seasonPlayers || []).filter(function (p) {
        return p && p.playerId && !KnockoutRounds.isWinnerOfPlayerId(p.playerId);
      }).length;
    },

    fillRoundSelect: function (selectedStageId) {
      var rs = this.el.round;
      if (!rs) return;
      var keep = selectedStageId != null ? String(selectedStageId) : rs.value;
      rs.innerHTML = '';
      (KnockoutRounds.adminStagesForPlayerCount(this.knockoutPlayerCount()) || []).forEach(
        function (stage) {
          var o = document.createElement('option');
          o.value = stage.id;
          o.textContent = stage.label;
          rs.appendChild(o);
        }
      );
      if (keep && rs.querySelector('option[value="' + keep + '"]')) rs.value = keep;
      else if (rs.options.length) rs.selectedIndex = 0;
    },

    activeBestOfInput: function () {
      var stage = this.el.stage && this.el.stage.value;
      return stage === 'knockout' ? this.el.bestOfKo : this.el.bestOfLeague;
    },

    normalizeBestOf: function (raw) {
      var n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n < 1 || n > 9 || n % 2 === 0) return 3;
      return n;
    },

    setBestOfFields: function (value) {
      var v = String(this.normalizeBestOf(value));
      if (this.el.bestOfLeague) this.el.bestOfLeague.value = v;
      if (this.el.bestOfKo) this.el.bestOfKo.value = v;
    },

    readBestOfFromDialog: function () {
      var input = this.activeBestOfInput();
      return this.normalizeBestOf(input && input.value);
    },

    usedMatchNumbersForStage: function (stageId, excludeFixtureId) {
      var used = {};
      (this.fixturesLoaded || []).forEach(function (f) {
        if (excludeFixtureId && String(f.fixtureId) === String(excludeFixtureId)) return;
        if (f['Stage'] !== 'knockout') return;
        var parsed = KnockoutRounds.parseStageMatch(f['Game Week']);
        if (parsed.stageId === stageId && parsed.matchNum) {
          used[parsed.matchNum] = true;
        }
      });
      return used;
    },

    countKnockoutFixturesInStage: function (stageId, excludeFixtureId) {
      var count = 0;
      (this.fixturesLoaded || []).forEach(function (f) {
        if (excludeFixtureId && String(f.fixtureId) === String(excludeFixtureId)) return;
        if (f['Stage'] !== 'knockout') return;
        var parsed = KnockoutRounds.parseStageMatch(f['Game Week']);
        if (parsed.stageId === stageId) count++;
      });
      return count;
    },

    nextAvailableMatchNum: function (stageId, excludeFixtureId) {
      var stage = KnockoutRounds.adminStageById(stageId);
      if (!stage) return null;
      var used = this.usedMatchNumbersForStage(stageId, excludeFixtureId);
      for (var n = 1; n <= stage.matchCount; n++) {
        if (!used[n]) return n;
      }
      return null;
    },

    assignInternalMatchNum: function (excludeFixtureId) {
      var stageId = this.el.round && this.el.round.value;
      if (!stageId) {
        this._internalMatchNum = null;
        return;
      }
      this._internalMatchNum = this.nextAvailableMatchNum(stageId, excludeFixtureId);
    },

    validateKnockoutDialog: function (excludeFixtureId) {
      var stageId = this.el.round && this.el.round.value;
      if (!stageId) {
        return { ok: false, message: 'Select a round.' };
      }
      var stage = KnockoutRounds.adminStageById(stageId);
      if (!stage) {
        return { ok: false, message: 'Unknown round.' };
      }

      var excludeId = excludeFixtureId ? String(excludeFixtureId) : '';
      var isNew = !excludeId;

      if (isNew) {
        this.assignInternalMatchNum(null);
      }

      var matchNum = this._internalMatchNum;
      if (matchNum == null || !KnockoutRounds.isValidStageMatchNum(stageId, matchNum)) {
        if (isNew && this.countKnockoutFixturesInStage(stageId, null) >= stage.matchCount) {
          return {
            ok: false,
            message:
              stage.label +
              ' already has the maximum of ' +
              stage.matchCount +
              ' fixture' +
              (stage.matchCount === 1 ? '' : 's') +
              '.',
          };
        }
        return {
          ok: false,
          message:
            stage.label +
            ' only allows match numbers 1–' +
            stage.matchCount +
            '.',
        };
      }

      var roundCode = KnockoutRounds.codeForStageMatch(stageId, matchNum);
      if (!roundCode) {
        return { ok: false, message: 'Could not build a round code for this match.' };
      }

      var used = this.usedMatchNumbersForStage(stageId, excludeId);
      if (used[matchNum]) {
        return {
          ok: false,
          message: stage.label + ' match ' + matchNum + ' is already used (' + roundCode + ').',
        };
      }

      var dupCode = (this.fixturesLoaded || []).some(function (f) {
        if (excludeId && String(f.fixtureId) === excludeId) return false;
        return f['Stage'] === 'knockout' && String(f['Game Week'] || '').trim() === roundCode;
      });
      if (dupCode) {
        return { ok: false, message: 'A fixture already exists for ' + roundCode + '.' };
      }

      if (isNew && this.countKnockoutFixturesInStage(stageId, null) >= stage.matchCount) {
        return {
          ok: false,
          message:
            stage.label +
            ' already has the maximum of ' +
            stage.matchCount +
            ' fixture' +
            (stage.matchCount === 1 ? '' : 's') +
            '.',
        };
      }

      return { ok: true, roundCode: roundCode };
    },

    currentSeasonId: function () {
      return this.el.compSelect && this.el.compSelect.value;
    },

    compTypeFromList: function (compId) {
      var cid = compId != null ? compId : this.currentSeasonId();
      var c = (this.seasons || []).find(function (x) {
        return String(compIdOf(x)) === String(cid);
      });
      if (!c) return 'league';
      return String(c.competitionType || 'league').toLowerCase() === 'knockout'
        ? 'knockout'
        : 'league';
    },

    isKnockoutComp: function () {
      return String(this.currentCompType || '').toLowerCase() === 'knockout';
    },

    loadSeasonGroups: function () {
      var me = this;
      var sid = me.currentSeasonId();
      if (!sid) {
        me.leagues = [];
        me.currentCompType = 'league';
        me.fillLeagueSelect();
        return Promise.resolve();
      }
      return ApiClient.get({ action: 'getSeasonGroups', seasonId: sid }).then(function (r) {
        var groups = r.groups || [];
        var seasonMeta = r.season || r.competition;
        var isKoComp =
          seasonMeta && String(seasonMeta.competitionType || '').toLowerCase() === 'knockout';
        me.currentCompType = isKoComp ? 'knockout' : me.compTypeFromList(sid);
        if (!isKoComp) {
          groups = groups.filter(function (g) {
            return String(g.leagueId) !== KNOCKOUT_GROUP_ID;
          });
        }
        me.leagues = groups;
        me.fillLeagueSelect();
      });
    },

    syncStageOptions: function () {
      if (!this.el.stage) return;
      var koComp = this.isKnockoutComp();
      var stageEl = this.el.stage;
      var stageWrap = stageEl.closest('p');
      stageEl.innerHTML = '';
      if (koComp) {
        var koOpt = document.createElement('option');
        koOpt.value = 'knockout';
        koOpt.textContent = 'Knockout';
        stageEl.appendChild(koOpt);
        stageEl.value = 'knockout';
        if (stageWrap) stageWrap.hidden = true;
      } else {
        [
          { value: 'league', label: 'League' },
          { value: 'knockout', label: 'Knockout' },
        ].forEach(function (opt) {
          var o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          stageEl.appendChild(o);
        });
        if (stageWrap) stageWrap.hidden = false;
      }
    },

    loadMeta: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return;
      ApiClient.get({ action: 'getSeasons' })
        .then(function (r) {
          me.seasons = r.seasons || r.competitions || [];
          me.fillCompSelect();
          me.fillRoundSelect();
          return me.loadSeasonGroups();
        })
        .then(function () {
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
        me.updateCoherenceWarning();
      });
    },

    fixtureCoherenceIssues: function () {
      var me = this;
      if (!me.isKnockoutComp()) return [];

      var roster = {};
      (me.seasonPlayers || []).forEach(function (p) {
        if (p && p.playerId && !KnockoutRounds.isWinnerOfPlayerId(p.playerId)) {
          roster[p.playerId] = p.playerName || p.playerId;
        }
      });

      var appearances = {};
      (me.fixturesLoaded || []).forEach(function (f) {
        if (f['Stage'] !== 'knockout') return;
        ['playerAId', 'playerBId'].forEach(function (key) {
          var pid = f[key];
          if (!pid || KnockoutRounds.isWinnerOfPlayerId(pid)) return;
          appearances[pid] = (appearances[pid] || 0) + 1;
        });
      });

      var issues = [];
      Object.keys(roster).forEach(function (pid) {
        if (!appearances[pid]) {
          issues.push(roster[pid] + ' is not in any fixture');
        }
      });
      Object.keys(appearances).forEach(function (pid) {
        if (appearances[pid] > 1) {
          issues.push((roster[pid] || pid) + ' appears in more than one fixture');
        }
      });
      return issues;
    },

    updateCoherenceWarning: function () {
      var el = this.el.coherenceWarn;
      if (!el) return;
      if (!this.isKnockoutComp()) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      var issues = this.fixtureCoherenceIssues();
      if (!issues.length) {
        el.hidden = true;
        el.textContent = '';
        return;
      }
      el.hidden = false;
      el.textContent = 'Fixtures are incoherent: ' + issues.join('; ') + '.';
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
        var na = me.displayFixturePlayerName(a, 'a');
        var nb = me.displayFixturePlayerName(b, 'a');
        return na.localeCompare(nb);
      });

      koFx.sort(function (a, b) {
        var sa = KnockoutRounds.sortKeyFor(a['Game Week']);
        var sb = KnockoutRounds.sortKeyFor(b['Game Week']);
        if (sa !== sb) return sa - sb;
        return me.displayFixturePlayerName(a, 'a').localeCompare(me.displayFixturePlayerName(b, 'a'));
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
        list.innerHTML = '<p class="admin-fixtures-empty"><em>No fixtures for this comp.</em></p>';
        return;
      }

      var lastLeague = null;
      var lastWeek = null;
      var lastKoStage = null;

      items.forEach(function (f) {
        if (f['Stage'] === 'knockout') {
          var round = String(f['Game Week'] || '').trim();
          var stageKey = KnockoutRounds.stageKeyFor(round);
          if (stageKey !== lastKoStage) {
            lastKoStage = stageKey;
            lastLeague = null;
            lastWeek = null;
            var h = document.createElement('h3');
            h.className = 'admin-fixtures-list__header';
            h.textContent = KnockoutRounds.stageLabelFor(round);
            list.appendChild(h);
          }
        } else {
          lastKoStage = null;
          var lid = String(f['League'] || '');
          var week = String(f['Game Week'] || '').trim();
          var lg = me.leagueById(lid);
          var leagueName = lg ? lg.name : 'League ' + lid;
          if (lid !== lastLeague) {
            lastLeague = lid;
            lastWeek = null;
            var gh = document.createElement('h3');
            gh.className = 'admin-fixtures-list__header';
            gh.textContent = leagueName;
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

        var nameA = me.displayFixturePlayerName(f, 'a');
        var nameB = me.displayFixturePlayerName(f, 'b');

        var playerA = document.createElement('span');
        playerA.className = 'admin-fixtures-list__player-a';
        playerA.textContent = nameA;

        var center = document.createElement('button');
        center.type = 'button';
        center.className = 'fixture-vs-btn admin-fixtures-list__vs';
        center.textContent = 'V';
        center.setAttribute('aria-label', 'Edit fixture: ' + nameA + ' vs ' + nameB);
        center.addEventListener('click', function () {
          me.openDialogEdit(f);
        });

        var playerB = document.createElement('span');
        playerB.className = 'admin-fixtures-list__player-b';
        playerB.textContent = nameB;

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
      this.fillLeagueSelect(this.el.league && this.el.league.value);
      this.fillPlayerSelects(
        this.el.pa && this.el.pa.value,
        this.el.pb && this.el.pb.value
      );
    },

    playersForDropdown: function () {
      var stage = this.el.stage && this.el.stage.value;
      var players = (this.seasonPlayers || []).slice();
      players = players.filter(function (p) {
        return !KnockoutRounds.isWinnerOfPlayerId(p.playerId);
      });
      if (stage === 'league' && this.el.league && this.el.league.value) {
        var lid = String(this.el.league.value);
        players = players.filter(function (p) {
          return String(playerLeague(p) || '') === lid;
        });
      }
      players.sort(function (a, b) {
        return String(a.playerName || '').localeCompare(String(b.playerName || ''));
      });
      return players;
    },

    currentKoRoundCode: function () {
      var stage = this.el.stage && this.el.stage.value;
      if (stage !== 'knockout') return '';
      var stageId = this.el.round && this.el.round.value;
      var matchNum = this._internalMatchNum;
      if (!stageId || !matchNum) return '';
      return KnockoutRounds.codeForStageMatch(stageId, matchNum);
    },

    earlierKoRoundCodes: function () {
      var stageId = this.el.round && this.el.round.value;
      if (!stageId) return [];
      var currentStage = KnockoutRounds.adminStageById(stageId);
      if (!currentStage) return [];
      var currentCode = this.currentKoRoundCode();
      var codes = {};
      (this.fixturesLoaded || []).forEach(function (f) {
        if (f['Stage'] !== 'knockout') return;
        var code = String(f['Game Week'] || '').trim();
        if (!code || code === currentCode) return;
        var parsed = KnockoutRounds.parseStageMatch(code);
        if (!parsed.stageId) return;
        var fixtureStage = KnockoutRounds.adminStageById(parsed.stageId);
        if (!fixtureStage || fixtureStage.sortKey >= currentStage.sortKey) return;
        codes[code] = true;
      });
      return Object.keys(codes).sort(function (a, b) {
        return KnockoutRounds.sortKeyFor(a) - KnockoutRounds.sortKeyFor(b);
      });
    },

    winnerOfOptions: function () {
      return this.earlierKoRoundCodes().map(function (code) {
        return {
          playerId: KnockoutRounds.winnerOfPlayerId(code),
          playerName: KnockoutRounds.winnerOfDisplayLabel(code),
        };
      });
    },

    appendPlayerSelectOptions: function (select, players, winnerOpts) {
      if (!select) return;
      if (winnerOpts && winnerOpts.length) {
        var ogWin = document.createElement('optgroup');
        ogWin.label = 'Winner of earlier round';
        winnerOpts.forEach(function (w) {
          var o = document.createElement('option');
          o.value = w.playerId;
          o.textContent = w.playerName;
          ogWin.appendChild(o);
        });
        select.appendChild(ogWin);
      }
      if (players.length) {
        var ogPlayers = document.createElement('optgroup');
        ogPlayers.label = 'Players';
        players.forEach(function (p) {
          var o = document.createElement('option');
          o.value = p.playerId;
          o.textContent = p.playerName;
          ogPlayers.appendChild(o);
        });
        select.appendChild(ogPlayers);
      }
    },

    ensureWinnerOfOption: function (select, playerId) {
      if (!select || !playerId || !KnockoutRounds.isWinnerOfPlayerId(playerId)) return;
      var opts = select.options;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].value === playerId) return;
      }
      var code = KnockoutRounds.roundCodeFromWinnerOfId(playerId);
      var o = document.createElement('option');
      o.value = playerId;
      o.textContent = KnockoutRounds.winnerOfDisplayLabel(code);
      select.appendChild(o);
    },

    fillPlayerSelects: function (selectedA, selectedB) {
      var pa = this.el.pa;
      var pb = this.el.pb;
      if (!pa || !pb) return;
      var players = this.playersForDropdown();
      var winnerOpts =
        this.el.stage && this.el.stage.value === 'knockout' ? this.winnerOfOptions() : [];
      pa.innerHTML = '<option value="">— Select —</option>';
      pb.innerHTML = '<option value="">— Select —</option>';
      this.appendPlayerSelectOptions(pa, players, winnerOpts);
      this.appendPlayerSelectOptions(pb, players, winnerOpts);
      this.ensureWinnerOfOption(pa, selectedA);
      this.ensureWinnerOfOption(pb, selectedB);
      if (selectedA) pa.value = selectedA;
      if (selectedB) pb.value = selectedB;
    },

    openDialogAdd: function () {
      this._isEditMode = false;
      if (this.el.fixtureId) this.el.fixtureId.value = '';
      this.syncStageOptions();
      if (this.el.stage) {
        this.el.stage.disabled = false;
      }
      if (this.el.week) this.el.week.value = '';
      this.setBestOfFields(3);
      this.fillRoundSelect();
      if (this.el.round) this.el.round.selectedIndex = 0;
      this.assignInternalMatchNum();
      if (this.el.deleteBtn) this.el.deleteBtn.hidden = true;
      this.fillLeagueSelect();
      this.syncStageFields();
      this.fillPlayerSelects('', '');
      if (this.isKnockoutComp() && this._internalMatchNum == null) {
        var addStage = KnockoutRounds.adminStageById(this.el.round && this.el.round.value);
        this.dialogFlash(
          addStage
            ? addStage.label + ' is full — delete a fixture in this round before adding another.'
            : 'This round is full.',
          true
        );
      } else {
        this.dialogFlash('', false);
      }
      if (this.el.dialog && typeof this.el.dialog.showModal === 'function') {
        this.el.dialog.showModal();
      }
    },

    openDialogEdit: function (f) {
      this._isEditMode = true;
      if (this.el.fixtureId) this.el.fixtureId.value = f.fixtureId || '';
      this.syncStageOptions();
      if (this.el.stage) {
        this.el.stage.value = f['Stage'] === 'knockout' ? 'knockout' : 'league';
        this.el.stage.disabled = true;
      }
      if (f['Stage'] === 'knockout') {
        var code = String(f['Game Week'] || '').trim();
        var parsed = KnockoutRounds.parseStageMatch(code);
        if (parsed.stageId) {
          this.fillRoundSelect(parsed.stageId);
          if (this.el.round) this.el.round.value = parsed.stageId;
          if (
            KnockoutRounds.isValidStageMatchNum(parsed.stageId, parsed.matchNum) &&
            !this.usedMatchNumbersForStage(parsed.stageId, f.fixtureId)[parsed.matchNum]
          ) {
            this._internalMatchNum = parsed.matchNum;
          } else {
            this.assignInternalMatchNum(f.fixtureId);
          }
        } else {
          this.fillRoundSelect();
          if (this.el.round) this.el.round.selectedIndex = 0;
          this.assignInternalMatchNum(f.fixtureId);
        }
      } else {
        this.fillLeagueSelect(String(f['League'] || ''));
        if (this.el.week) this.el.week.value = String(f['Game Week'] || '');
      }
      this.setBestOfFields(f.bestOf != null ? f.bestOf : 3);
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
        me.dialogFlash('Select a comp.', true);
        return;
      }
      var stage = me.el.stage && me.el.stage.value;
      if (stage === 'knockout' && !me.isKnockoutComp()) {
        me.dialogFlash('Knockout stage is only allowed for knockout comps.', true);
        return;
      }
      if (stage === 'league' && me.isKnockoutComp()) {
        me.dialogFlash('League stage is not used for knockout comps.', true);
        return;
      }
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
        bestOf: me.readBestOfFromDialog(),
      };
      var fid = me.el.fixtureId && me.el.fixtureId.value.trim();
      if (fid) payload.fixtureId = fid;

      if (stage === 'knockout') {
        var koCheck = me.validateKnockoutDialog(fid);
        if (!koCheck.ok) {
          me.dialogFlash(koCheck.message, true);
          return;
        }
        payload.roundLabel = koCheck.roundCode;
        payload.sortOrder = KnockoutRounds.sortOrderFor(koCheck.roundCode);
      } else {
        var leagueId = me.el.league && me.el.league.value;
        var weekRaw = me.el.week && me.el.week.value.trim();
        var weekNum = parseInt(weekRaw, 10);
        if (!leagueId) {
          me.dialogFlash('Select a league.', true);
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
      if (this.el.compSelect) {
        this.el.compSelect.addEventListener('change', function () {
          me.loadSeasonGroups()
            .then(function () {
              return me.reloadFixtures();
            })
            .catch(function (e) {
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
          var excludeId =
            me._isEditMode && me.el.fixtureId ? me.el.fixtureId.value.trim() : null;
          me.assignInternalMatchNum(excludeId);
          me.fillPlayerSelects(
            me.el.pa && me.el.pa.value,
            me.el.pb && me.el.pb.value
          );
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
