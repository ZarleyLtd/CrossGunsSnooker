// Fixtures Page — upcoming list + Admin Mode result entry

var FixturesPage = {
  /** Dispatched on successful Save from the Enter result dialog (fixtures or results page). */
  RESULT_SAVED_EVENT: 'crossguns-fixture-result-saved',

  /** Default match length when fixture has no bestOf (odd 1–9). */
  DEFAULT_BEST_OF: 3,
  _currentBestOf: 3,
  _loadedBreakIds: [],
  /** Per-player frame scores in the result dialog. */
  _playerScores: { a: 0, b: 0 },
  /** True when dialog was opened for a fixture that already had a recorded result. */
  _dialogOpenedWithResult: false,
  _resultDialogBindingsDone: false,
  CLEAR_RESULT_CONFIRM_MSG:
    'Remove this result from the database?\n\nFrames are 0–0, so the recorded score will be cleared and this fixture will show as having no result. Any breaks already saved for this match will be deleted.',
  CLEAR_RESULT_INLINE_MSG:
    'Frames are 0–0 — saving will remove this result from the database and delete any breaks already saved for this match.',

  normalizeBestOf: function (raw) {
    var n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1 || n > 9 || n % 2 === 0) return this.DEFAULT_BEST_OF;
    return n;
  },

  framesToWin: function () {
    return Math.ceil(this._currentBestOf / 2);
  },

  initPlayerScores: function () {
    this._playerScores = { a: 0, b: 0 };
  },

  playerScore: function (side) {
    return this._playerScores[side] || 0;
  },

  adjustPlayerScore: function (side, delta) {
    if (side !== 'a' && side !== 'b') return;
    var framesToWin = this.framesToWin();
    var myScore = this.playerScore(side);
    var next = myScore + delta;
    if (next < 0 || next > framesToWin) return;
    if (delta > 0 && !this.canIncrementScore(side)) return;
    this._playerScores[side] = next;
    this.refreshMatchFrameUI();
  },

  canIncrementScore: function (side) {
    var framesToWin = this.framesToWin();
    var myScore = this.playerScore(side);
    var total = this.playerScore('a') + this.playerScore('b');
    if (myScore >= framesToWin) return false;
    if (total + 1 > this._currentBestOf) return false;
    return true;
  },

  adminModeEvent: function () {
    return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
  },

  isAdmin: function () {
    return typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
  },

  localISODate: function () {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  },

  init: async function () {
    var container = document.getElementById('fixtures-list');
    if (!container) return;

    var self = this;
    window.addEventListener(this.adminModeEvent(), function () {
      self.render().catch(function (e) {
        console.error(e);
      });
    });

    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      self.refreshFilterAndRender().catch(function (e) {
        console.error(e);
      });
    });

    if (typeof LeagueGroupFilter !== 'undefined') {
      LeagueGroupFilter.bindChange(function () {
        self.render().catch(function (e) {
          console.error(e);
        });
      });
    }
    this.bindResultDialog();
    await CurrentCompetition.whenReady(function () {
      return self.refreshFilterAndRender();
    });
  },

  unplayedFixtures: function (fixtures) {
    return (fixtures || []).filter(function (r) {
      var notPlayed = !r['Result'] || String(r['Result']).trim() === '';
      return notPlayed && r['Game Week'] && r['Player A'] && r['Player B'];
    });
  },

  knockoutFixturesWithParticipants: function (fixtures) {
    return (fixtures || []).filter(function (r) {
      return r['Game Week'] && r['Player A'] && r['Player B'];
    });
  },

  /**
   * When the league stage has no unplayed fixtures but a linked knockout comp has
   * fixtures, show that knockout as the Now Showing comp (fixtures page only).
   * @returns {Promise<boolean>} true if season was switched (caller should re-render)
   */
  maybePromoteToAssociatedKnockout: async function () {
    var season = CurrentCompetition.get();
    if (!season || CurrentCompetition.isKnockout()) return false;

    var ko = CurrentCompetition.findAssociatedKnockout(season);
    if (!ko) return false;

    var leagueId = CurrentCompetition.getSeasonId();
    if (!leagueId) return false;

    var koId = ko.seasonId || ko.compId;
    if (!koId) return false;

    try {
      var leagueResult = await ApiClient.get({ action: 'getFixtures', season: leagueId });
      if (this.unplayedFixtures(leagueResult.fixtures || []).length > 0) {
        return false;
      }

      var koResult = await ApiClient.get({ action: 'getFixtures', season: koId });
      if (this.knockoutFixturesWithParticipants(koResult.fixtures || []).length === 0) {
        return false;
      }

      return CurrentCompetition.setSeasonId(koId, { allowKnockoutStage: true });
    } catch (e) {
      console.error('maybePromoteToAssociatedKnockout failed:', e);
      return false;
    }
  },

  refreshFilterAndRender: async function () {
    if (typeof LeagueGroupFilter !== 'undefined') {
      await LeagueGroupFilter.sync();
    }
    return this.render();
  },

  selectedLeague: function () {
    return typeof LeagueGroupFilter !== 'undefined'
      ? LeagueGroupFilter.selected()
      : 'All';
  },

  bindResultDialog: function () {
    if (this._resultDialogBindingsDone) return;
    var dlg = document.getElementById('fixture-result-dialog');
    if (!dlg) return;

    var self = this;
    self.ensureFrameRacksBuilt();
    if (!self._frameRackDelegationBound) {
      self._frameRackDelegationBound = true;
      dlg.addEventListener('click', function (e) {
        var rack = e.target.closest('.fixture-frame-rack');
        if (!rack || !dlg.contains(rack)) return;
        var host = rack.closest('[data-frame-racks-for]');
        if (!host) return;
        var side = host.getAttribute('data-frame-racks-for');
        var action = rack.getAttribute('data-rack-action');
        if (side && (action === 'inc' || action === 'dec')) {
          self.adjustPlayerScore(side, action === 'inc' ? 1 : -1);
        }
      });
    }

    var cancelBtn = document.getElementById('fixture-result-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        dlg.close();
      });
    }

    var form = document.getElementById('fixture-result-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      self.submitResultDialog().catch(function (err) {
        var msg = document.getElementById('fixture-result-msg');
        if (msg) {
          msg.textContent = err.message || String(err);
          msg.hidden = false;
          msg.classList.add('msg--warning');
        }
      });
    });
    this._resultDialogBindingsDone = true;
  },

  /** window.confirm() can render behind an open modal <dialog>; close first, then restore if cancelled. */
  confirmClearingResult: function () {
    var dlg = document.getElementById('fixture-result-dialog');
    var dialogWasOpen = !!(dlg && dlg.open);
    if (dialogWasOpen && typeof dlg.close === 'function') {
      dlg.close();
    }
    var confirmed = window.confirm(this.CLEAR_RESULT_CONFIRM_MSG);
    if (!confirmed && dialogWasOpen && dlg && typeof dlg.showModal === 'function') {
      dlg.showModal();
      var self = this;
      window.setTimeout(function () {
        self.focusResultDialogRoot();
      }, 0);
    }
    return confirmed;
  },

  updateClearingResultWarning: function (scoreA, scoreB) {
    var msg = document.getElementById('fixture-result-msg');
    if (!msg) return;
    if (this._dialogOpenedWithResult && scoreA === 0 && scoreB === 0) {
      msg.textContent = this.CLEAR_RESULT_INLINE_MSG;
      msg.hidden = false;
      msg.classList.remove('msg--success');
      msg.classList.add('msg--warning');
      return;
    }
    if (msg.classList.contains('msg--warning') && !msg.classList.contains('msg--success')) {
      msg.textContent = '';
      msg.hidden = true;
      msg.classList.remove('msg--warning');
    }
  },

  createFrameRackSvg: function () {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '10 5.5 36 36');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'fixture-frame-rack-svg');
    svg.setAttribute('aria-hidden', 'true');
    var ballR = 3.35;
    var rowSpacing = 7.15;
    var colSpacing = 7.15;
    var cx0 = 28;
    var cy0 = 9;
    var r;
    var c;
    for (r = 0; r < 5; r++) {
      var n = r + 1;
      var y = cy0 + r * rowSpacing;
      for (c = 0; c < n; c++) {
        var x = cx0 + (c - (n - 1) / 2) * colSpacing;
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(x));
        circle.setAttribute('cy', String(y));
        circle.setAttribute('r', String(ballR));
        circle.setAttribute('fill', '#c42032');
        circle.setAttribute('stroke', '#8f1422');
        circle.setAttribute('stroke-width', '0.55');
        svg.appendChild(circle);
      }
    }
    return svg;
  },

  ensureFrameRacksBuilt: function () {
    var self = this;
    ['a', 'b'].forEach(function (side) {
      var host = document.getElementById('fixture-frame-racks-' + side);
      if (!host) return;
      if (host.getAttribute('data-racks-built') === 'controls-v2') return;
      host.innerHTML = '';
      var col = document.createElement('div');
      col.className = 'fixture-frame-racks-col';
      [
        { action: 'inc', inverted: false, label: 'Increase score' },
        { action: 'dec', inverted: true, label: 'Decrease score' },
      ].forEach(function (spec) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fixture-frame-rack';
        if (spec.inverted) btn.classList.add('fixture-frame-rack--inverted');
        btn.setAttribute('data-rack-action', spec.action);
        btn.setAttribute('aria-label', spec.label);
        var icon = document.createElement('span');
        icon.className = 'fixture-frame-rack-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.appendChild(self.createFrameRackSvg());
        btn.appendChild(icon);
        col.appendChild(btn);
      });
      host.appendChild(col);
      host.setAttribute('data-racks-built', 'controls-v2');
    });
  },

  applyCanonicalFrameAssignment: function (scoreA, scoreB) {
    var cap = this.framesToWin();
    this._playerScores = {
      a: Math.max(0, Math.min(Math.trunc(scoreA), cap)),
      b: Math.max(0, Math.min(Math.trunc(scoreB), cap)),
    };
  },

  refreshMatchFrameUI: function () {
    var scoreA = this.playerScore('a');
    var scoreB = this.playerScore('b');
    var framesToWin = this.framesToWin();
    document.getElementById('fixture-result-score-a').value = String(scoreA);
    document.getElementById('fixture-result-score-b').value = String(scoreB);
    var dispA = document.getElementById('fixture-result-score-a-display');
    var dispB = document.getElementById('fixture-result-score-b-display');
    if (dispA) dispA.textContent = String(scoreA);
    if (dispB) dispB.textContent = String(scoreB);

    var labelA = document.getElementById('fixture-result-label-a');
    var labelB = document.getElementById('fixture-result-label-b');
    if (labelA && labelB) {
      labelA.classList.remove(
        'fixture-result-player-name--winner',
        'fixture-result-player-name--loser'
      );
      labelB.classList.remove(
        'fixture-result-player-name--winner',
        'fixture-result-player-name--loser'
      );
      if (scoreA >= framesToWin) {
        labelA.classList.add('fixture-result-player-name--winner');
        labelB.classList.add('fixture-result-player-name--loser');
      } else if (scoreB >= framesToWin) {
        labelB.classList.add('fixture-result-player-name--winner');
        labelA.classList.add('fixture-result-player-name--loser');
      }
    }

    var self = this;
    ['a', 'b'].forEach(function (side) {
      var host = document.getElementById('fixture-frame-racks-' + side);
      if (!host) return;
      var myScore = self.playerScore(side);
      host.querySelectorAll('.fixture-frame-rack').forEach(function (rack) {
        var action = rack.getAttribute('data-rack-action');
        var disable =
          action === 'inc' ? !self.canIncrementScore(side) : action === 'dec' ? myScore <= 0 : true;
        rack.classList.remove('fixture-frame-rack--on', 'fixture-frame-rack--lost');
        rack.disabled = disable;
        rack.setAttribute('aria-label', self.frameRackAriaLabel(action, side));
      });
    });
    this.updateClearingResultWarning(scoreA, scoreB);
  },

  frameRackAriaLabel: function (action, side) {
    var score = this.playerScore(side);
    if (action === 'inc') {
      return 'Increase score (currently ' + score + ')';
    }
    if (action === 'dec') {
      return 'Decrease score (currently ' + score + ')';
    }
    return 'Adjust score';
  },

  focusResultDialogRoot: function () {
    var titleEl = document.getElementById('fixture-result-title');
    if (!titleEl) return;
    titleEl.setAttribute('tabindex', '-1');
    titleEl.focus({ preventScroll: true });
  },

  render: async function () {
    var container = document.getElementById('fixtures-list');
    if (!container) return;

    try {
      if (await this.maybePromoteToAssociatedKnockout()) {
        return;
      }

      var result = await ApiClient.get(
        Object.assign({ action: 'getFixtures' }, CurrentCompetition.apiParams())
      );
      var data = result.fixtures || [];

      var isKnockout =
        typeof CurrentCompetition !== 'undefined' && CurrentCompetition.isKnockout();
      if (typeof NavCompetition !== 'undefined') {
        NavCompetition.syncLeagueFilters(isKnockout);
      }

      var league = isKnockout ? 'All' : this.selectedLeague();
      var upcoming = this.unplayedFixtures(data).filter(function (r) {
        if (!isKnockout) {
          var stage = String(r['Stage'] || '').toLowerCase();
          if (stage === 'knockout') return false;
        }
        if (league === 'All') return true;
        return String(r['League']) === league;
      });

      if (upcoming.length === 0) {
        container.innerHTML = '<p><em>No upcoming fixtures found.</em></p>';
        return;
      }

      var winnersByCode = {};
      var sectionLabels = null;
      var grouped;
      if (isKnockout && typeof KnockoutRounds !== 'undefined') {
        winnersByCode = KnockoutRounds.buildRoundWinnersMap(data);
        var koGroup = KnockoutRounds.groupForList(upcoming);
        grouped = { grouped: koGroup.grouped, orderedWeeks: koGroup.orderedKeys };
        sectionLabels = koGroup.labels;
      } else {
        grouped = this.groupByGameWeek(upcoming);
      }
      this.renderGroups(container, grouped.grouped, grouped.orderedWeeks, {
        isKnockout: isKnockout,
        winnersByCode: winnersByCode,
        sectionLabels: sectionLabels,
      });
    } catch (error) {
      console.error('Failed to load fixtures:', error);
      container.innerHTML = '<p><em>Error loading fixtures.</em></p>';
    }
  },

  groupByGameWeek: function (fixtures) {
    var grouped = {};
    var orderedWeeks = [];
    fixtures.forEach(function (f) {
      var week = String(f['Game Week']).trim();
      if (!grouped[week]) {
        grouped[week] = [];
        orderedWeeks.push(week);
      }
      grouped[week].push(f);
    });
    return { grouped: grouped, orderedWeeks: orderedWeeks };
  },

  knockoutWeekLabel: function (week) {
    if (typeof KnockoutRounds !== 'undefined') {
      return KnockoutRounds.labelFor(week);
    }
    return week;
  },

  knockoutPlayerLabel: function (match, slot, winnersByCode) {
    if (typeof KnockoutRounds !== 'undefined') {
      return KnockoutRounds.resolvedPlayerName(match, slot, winnersByCode);
    }
    return slot === 'a' ? match['Player A'] || '' : match['Player B'] || '';
  },

  fixtureResultReady: function (match, isKnockout, winnersByCode) {
    if (!isKnockout) return true;
    if (typeof KnockoutRounds === 'undefined') return true;
    winnersByCode = winnersByCode || {};

    function slotReady(slot) {
      var id = slot === 'a' ? match.playerAId : match.playerBId;
      if (!KnockoutRounds.isWinnerOfPlayerId(id)) return true;
      var code = KnockoutRounds.roundCodeFromWinnerOfId(id);
      return !!(code && winnersByCode[code]);
    }

    var labelA = String(this.knockoutPlayerLabel(match, 'a', winnersByCode)).trim();
    var labelB = String(this.knockoutPlayerLabel(match, 'b', winnersByCode)).trim();
    return slotReady('a') && slotReady('b') && !!labelA && !!labelB;
  },

  renderGroups: function (container, grouped, orderedWeeks, options) {
    var self = this;
    options = options || {};
    var isKnockout = !!options.isKnockout;
    var winnersByCode = options.winnersByCode || {};
    container.innerHTML = '';

    orderedWeeks.forEach(function (week) {
      var h3 = document.createElement('h3');
      if (isKnockout && options.sectionLabels) {
        h3.textContent = options.sectionLabels[week] || self.knockoutWeekLabel(week);
      } else if (isKnockout) {
        h3.textContent = self.knockoutWeekLabel(week);
      } else {
        var num = parseInt(week, 10);
        h3.textContent =
          !isNaN(num) && String(num) === week ? 'Game Week ' + week : week;
      }
      h3.style.marginTop = '1.5em';
      h3.style.marginBottom = '0.5em';
      h3.style.fontWeight = 'bold';
      h3.style.textAlign = 'center';
      container.appendChild(h3);

      grouped[week].forEach(function (match) {
        var div = document.createElement('div');
        div.className = 'fixture-row';
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.style.gap = '1em';
        div.style.margin = '0.3em 0';
        div.style.fontSize = '1.05em';

        var fid = String(match.fixtureId || '').trim();
        div.setAttribute('data-fixture-id', fid);
        div.setAttribute('data-player-a-id', String(match.playerAId || '').trim());
        div.setAttribute('data-player-b-id', String(match.playerBId || '').trim());
        var nameA = self.knockoutPlayerLabel(match, 'a', winnersByCode);
        var nameB = self.knockoutPlayerLabel(match, 'b', winnersByCode);
        if (!isKnockout) {
          nameA = match['Player A'] || '';
          nameB = match['Player B'] || '';
        }
        div.setAttribute('data-player-a-name', nameA);
        div.setAttribute('data-player-b-name', nameB);
        div.setAttribute('data-match-date', match['Match Date'] || '');
        div.setAttribute('data-best-of', String(self.normalizeBestOf(match.bestOf)));
        var resultReady = self.fixtureResultReady(match, isKnockout, winnersByCode);
        div.setAttribute('data-result-ready', resultReady ? 'true' : 'false');

        var playerA = document.createElement('span');
        playerA.textContent = nameA;
        playerA.style.flex = '1';
        playerA.style.textAlign = 'right';

        var center;
        if (self.isAdmin() && fid && resultReady) {
          center = document.createElement('button');
          center.type = 'button';
          center.className = 'fixture-vs-btn';
          center.textContent = 'V';
          center.setAttribute(
            'aria-label',
            'Enter result for ' + nameA + ' vs ' + nameB
          );
          center.addEventListener('click', function () {
            self.openResultDialog(div);
          });
        } else {
          center = document.createElement('span');
          center.className = 'fixture-vs-static';
          center.textContent = 'V';
          if (self.isAdmin() && fid && !resultReady) {
            center.setAttribute(
              'title',
              'Result entry is available once both players are known'
            );
          }
        }
        center.style.flex = '0 0 auto';

        var playerB = document.createElement('span');
        playerB.textContent = nameB;
        playerB.style.flex = '1';
        playerB.style.textAlign = 'left';

        div.appendChild(playerA);
        div.appendChild(center);
        div.appendChild(playerB);
        container.appendChild(div);
      });
    });
  },

  normalizePlayerId: function (id) {
    return String(id == null ? '' : id).trim().toLowerCase();
  },

  /** Merge GET getBreaksForFixture into breaks fields + _loadedBreakIds (player ids normalized). */
  applyBreaksResponseToDialogFields: function (res) {
    var breaks = (res && res.breaks) || [];
    var hidA = document.getElementById('fixture-result-player-a-id');
    var hidB = document.getElementById('fixture-result-player-b-id');
    var cmpA = this.normalizePlayerId(hidA ? hidA.value : '');
    var cmpB = this.normalizePlayerId(hidB ? hidB.value : '');
    var valsA = [];
    var valsB = [];
    var self = this;
    breaks.forEach(function (b) {
      if (!b) return;
      var bid = b.breakId != null ? b.breakId : b.break_id;
      if (bid) self._loadedBreakIds.push(String(bid));
      var rawPid = b.playerId != null ? b.playerId : b.player_id;
      var cmpP = self.normalizePlayerId(rawPid);
      var val = Number(b.value);
      if (!Number.isFinite(val)) return;
      if (cmpP && cmpA && cmpP === cmpA) valsA.push(val);
      else if (cmpP && cmpB && cmpP === cmpB) valsB.push(val);
    });
    valsA.sort(function (x, y) {
      return x - y;
    });
    valsB.sort(function (x, y) {
      return x - y;
    });
    var fa = document.getElementById('fixture-breaks-field-a');
    var fb = document.getElementById('fixture-breaks-field-b');
    if (fa) fa.value = valsA.join(', ');
    if (fb) fb.value = valsB.join(', ');
  },

  clearBreakContainers: function () {
    var a = document.getElementById('fixture-breaks-field-a');
    var b = document.getElementById('fixture-breaks-field-b');
    if (a) a.value = '';
    if (b) b.value = '';
    this._loadedBreakIds = [];
  },

  /** Split break list using common delimiters (spaces, commas, slashes, etc.). Valid snooker break 1–155. */
  parseBreaksListString: function (raw) {
    if (!raw || !String(raw).trim()) return [];
    var parts = String(raw).split(/[\s,;/|:\\-]+/);
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var t = parts[i].trim();
      if (!t) continue;
      var n = parseInt(t, 10);
      if (!isNaN(n) && n >= 1 && n <= 155) out.push(n);
    }
    return out;
  },

  collectBreakRowsForSubmit: function (playerId, side) {
    var el = document.getElementById('fixture-breaks-field-' + side);
    if (!el || !playerId) return [];
    var nums = this.parseBreaksListString(el.value);
    return nums.map(function (value) {
      return { playerId: playerId, value: value };
    });
  },

  openResultDialog: function (rowEl) {
    var dlg = document.getElementById('fixture-result-dialog');
    if (!dlg) return;

    var fid = String(rowEl.getAttribute('data-fixture-id') || '').trim();
    var pidA = String(rowEl.getAttribute('data-player-a-id') || '').trim();
    var pidB = String(rowEl.getAttribute('data-player-b-id') || '').trim();
    var nameA = rowEl.getAttribute('data-player-a-name');
    var nameB = rowEl.getAttribute('data-player-b-name');
    var prevDate = rowEl.getAttribute('data-match-date');
    var bestOf = this.normalizeBestOf(rowEl.getAttribute('data-best-of'));
    this._currentBestOf = bestOf;

    document.getElementById('fixture-result-fixture-id').value = fid;
    document.getElementById('fixture-result-player-a-id').value = pidA;
    document.getElementById('fixture-result-player-b-id').value = pidB;

    document.getElementById('fixture-result-label-a').textContent = nameA;
    document.getElementById('fixture-result-label-b').textContent = nameB;

    var dateEl = document.getElementById('fixture-result-date');
    dateEl.value = prevDate && String(prevDate).trim() ? prevDate : this.localISODate();

    this.ensureFrameRacksBuilt();
    this.initPlayerScores();
    this._dialogOpenedWithResult = false;
    var hadResult = rowEl.getAttribute('data-had-result');
    if (hadResult === '1' || hadResult === 'true') {
      this._dialogOpenedWithResult = true;
    }

    var preA = rowEl.getAttribute('data-prefill-score-a');
    var preB = rowEl.getAttribute('data-prefill-score-b');
    if (preA != null && preB != null && preA !== '' && preB !== '') {
      var na = parseInt(preA, 10);
      var nb = parseInt(preB, 10);
      if (!isNaN(na) && !isNaN(nb) && na >= 0 && nb >= 0) {
        if (na > 0 || nb > 0) {
          this._dialogOpenedWithResult = true;
        }
        this.applyCanonicalFrameAssignment(na, nb);
      }
    }
    this.refreshMatchFrameUI();

    var racksA = document.getElementById('fixture-frame-racks-a');
    var racksB = document.getElementById('fixture-frame-racks-b');
    if (racksA) racksA.setAttribute('aria-label', 'Frames scored — ' + nameA);
    if (racksB) racksB.setAttribute('aria-label', 'Frames scored — ' + nameB);

    var msg = document.getElementById('fixture-result-msg');
    if (msg) {
      msg.textContent = '';
      msg.hidden = true;
      msg.classList.remove('msg--warning', 'msg--success');
    }

    this.clearBreakContainers();

    var self = this;
    function openDlg() {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      window.setTimeout(function () {
        self.focusResultDialogRoot();
      }, 0);
    }

    if (!fid) {
      openDlg();
      return;
    }

    ApiClient.get({ action: 'getBreaksForFixture', fixtureId: fid })
      .then(function (res) {
        self.applyBreaksResponseToDialogFields(res);
        openDlg();
      })
      .catch(function (err) {
        var loadMsg = document.getElementById('fixture-result-msg');
        if (loadMsg) {
          var base =
            err && err.message ? String(err.message) : 'Could not load breaks for this match.';
          var extra =
            base.indexOf('Unknown action') !== -1 || base.indexOf('getBreaksForFixture') !== -1
              ? ' Deploy the latest `crossguns-api` Edge Function (see docs/SUPABASE_SETUP.md).'
              : '';
          loadMsg.textContent = base + extra;
          loadMsg.hidden = false;
          loadMsg.classList.remove('msg--success');
          loadMsg.classList.add('msg--warning');
        }
        openDlg();
      });
  },

  submitResultDialog: async function () {
    var dlg = document.getElementById('fixture-result-dialog');
    var msg = document.getElementById('fixture-result-msg');
    var fixtureId = document.getElementById('fixture-result-fixture-id').value;
    var pidA = document.getElementById('fixture-result-player-a-id').value;
    var pidB = document.getElementById('fixture-result-player-b-id').value;
    var scoreA = parseInt(document.getElementById('fixture-result-score-a').value, 10) || 0;
    var scoreB = parseInt(document.getElementById('fixture-result-score-b').value, 10) || 0;
    var matchDate = document.getElementById('fixture-result-date').value;
    var framesToWin = this.framesToWin();

    if (!fixtureId) throw new Error('Missing fixture');

    if (typeof AdminMode !== 'undefined' && !AdminMode.isUnlocked()) {
      throw new Error(
        'Admin Mode is locked or expired. Use Unlock Admin Mode in the menu, then save again.'
      );
    }

    var clearing = scoreA === 0 && scoreB === 0;
    if (clearing && this._dialogOpenedWithResult) {
      if (!this.confirmClearingResult()) return;
    } else if (clearing) {
      if (msg) {
        msg.textContent = 'There must be a winner!';
        msg.hidden = false;
        msg.classList.remove('msg--success');
        msg.classList.add('msg--warning');
      }
      return;
    }

    if (!clearing && scoreA < framesToWin && scoreB < framesToWin) {
      if (msg) {
        msg.textContent = 'There must be a winner!';
        msg.hidden = false;
        msg.classList.remove('msg--success');
        msg.classList.add('msg--warning');
      }
      return;
    }

    var breaksA = this.collectBreakRowsForSubmit(pidA, 'a');
    var breaksB = this.collectBreakRowsForSubmit(pidB, 'b');

    if (msg) {
      msg.textContent = 'Saving…';
      msg.hidden = false;
      msg.classList.remove('msg--warning', 'msg--success');
    }

    await ApiClient.post(
      'updateFixtureResult',
      clearing
        ? { fixtureId: fixtureId, scoreA: null, scoreB: null, matchDate: matchDate }
        : { fixtureId: fixtureId, scoreA: scoreA, scoreB: scoreB, matchDate: matchDate }
    );

    var idsToDelete = this._loadedBreakIds.slice();
    for (var i = 0; i < idsToDelete.length; i++) {
      await ApiClient.post('deleteBreak', { breakId: idsToDelete[i] });
    }

    if (!clearing) {
      var combined = breaksA.concat(breaksB);
      for (var j = 0; j < combined.length; j++) {
        var row = combined[j];
        await ApiClient.post('upsertBreak', {
          fixtureId: fixtureId,
          playerId: row.playerId,
          value: row.value,
        });
      }
    }

    if (msg) {
      msg.textContent = clearing ? 'Result cleared.' : 'Saved.';
      msg.classList.add('msg--success');
    }
    if (dlg) dlg.close();
    window.dispatchEvent(
      new CustomEvent(this.RESULT_SAVED_EVENT, { detail: { fixtureId: fixtureId } })
    );
    await this.render();
  },
};
