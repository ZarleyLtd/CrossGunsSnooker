// Fixtures Page — upcoming list + Admin Mode result entry

var FixturesPage = {
  /** Dispatched on successful Save from the Enter result dialog (fixtures or results page). */
  RESULT_SAVED_EVENT: 'crossguns-fixture-result-saved',

  KO_LABELS: {
    CS: 'Championship Semis',
    CF: 'Championship Final',
    PQ: 'Plate Quarters',
    PS: 'Plate Semis',
    PF: 'Plate Final',
  },

  /** Frames in a match (one rack icon per frame per player; each frame awarded once). */
  FRAME_RACK_COUNT: 3,
  _loadedBreakIds: [],
  /** Per-frame winner for current dialog: index 0..2 → null | 'a' | 'b' */
  _matchFrameWinners: [],
  /** True when dialog was opened for a fixture that already had a recorded result. */
  _dialogOpenedWithResult: false,
  _resultDialogBindingsDone: false,
  CLEAR_RESULT_CONFIRM_MSG:
    'Remove this result from the database?\n\nFrames are 0–0, so the recorded score will be cleared and this fixture will show as having no result. Any breaks already saved for this match will be deleted.',
  CLEAR_RESULT_INLINE_MSG:
    'Frames are 0–0 — saving will remove this result from the database and delete any breaks already saved for this match.',

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
      self.render().catch(function (e) {
        console.error(e);
      });
    });

    this.bindLeagueFilter();
    this.bindResultDialog();
    await CurrentCompetition.whenReady(function () {
      return self.render();
    });
  },

  bindLeagueFilter: function () {
    var self = this;
    document.querySelectorAll('input[name="league"]').forEach(function (rb) {
      rb.addEventListener('change', function () {
        self.highlightSelectedLeague();
        self.render().catch(function (e) { console.error(e); });
      });
    });
    this.highlightSelectedLeague();
  },

  highlightSelectedLeague: function () {
    var selected = document.querySelector('input[name="league"]:checked');
    if (!selected) return;
    document.querySelectorAll('.league-label').forEach(function (label) {
      var input = label.querySelector('input[name="league"]');
      if (input && input.value === selected.value) {
        label.style.fontWeight = 'bold';
        label.style.border = '3px solid green';
        label.style.borderRadius = '4px';
      } else {
        label.style.fontWeight = 'normal';
        label.style.border = '1px solid transparent';
      }
    });
  },

  selectedLeague: function () {
    var el = document.querySelector('input[name="league"]:checked');
    return el ? el.value : 'All';
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
        var idx = parseInt(rack.getAttribute('data-rack-index'), 10);
        if (side && !isNaN(idx)) self.toggleMatchFrame(idx, side);
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
    svg.setAttribute('viewBox', '0 0 56 50');
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
    var countStr = String(self.FRAME_RACK_COUNT);
    ['a', 'b'].forEach(function (side) {
      var host = document.getElementById('fixture-frame-racks-' + side);
      if (!host) return;
      if (host.getAttribute('data-racks-built-count') === countStr) return;
      host.innerHTML = '';
      var rowsWrap = document.createElement('div');
      rowsWrap.className = 'fixture-frame-racks-rows';
      var row = document.createElement('div');
      row.className = 'fixture-frame-racks-row';
      var i;
      for (i = 0; i < self.FRAME_RACK_COUNT; i++) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fixture-frame-rack';
        btn.setAttribute('data-rack-index', String(i));
        btn.setAttribute(
          'aria-label',
          'Frame ' + (i + 1) + ' of ' + self.FRAME_RACK_COUNT + ', assign to this player'
        );
        btn.setAttribute('aria-pressed', 'false');
        btn.appendChild(self.createFrameRackSvg());
        row.appendChild(btn);
      }
      rowsWrap.appendChild(row);
      host.appendChild(rowsWrap);
      host.setAttribute('data-racks-built-count', countStr);
    });
  },

  toggleMatchFrame: function (frameIndex, side) {
    var w = this._matchFrameWinners[frameIndex];
    if (w === side) {
      this._matchFrameWinners[frameIndex] = null;
    } else {
      var maxWins = Math.ceil(this.FRAME_RACK_COUNT / 2);
      var currentCount = 0;
      for (var i = 0; i < this.FRAME_RACK_COUNT; i++) {
        if (this._matchFrameWinners[i] === side) currentCount++;
      }
      if (currentCount >= maxWins) return;
      this._matchFrameWinners[frameIndex] = side;
    }
    this.refreshMatchFrameUI();
  },

  /**
   * Fill frame winners from aggregate scores (order not stored in DB).
   * First `scoreA` frames → A, next `scoreB` → B; extras stay unassigned.
   */
  applyCanonicalFrameAssignment: function (scoreA, scoreB) {
    var idx = 0;
    var i;
    var sa = Math.max(0, Math.min(Math.trunc(scoreA), this.FRAME_RACK_COUNT));
    var sb = Math.max(0, Math.min(Math.trunc(scoreB), this.FRAME_RACK_COUNT));
    for (i = 0; i < sa && idx < this.FRAME_RACK_COUNT; i++) {
      this._matchFrameWinners[idx++] = 'a';
    }
    for (i = 0; i < sb && idx < this.FRAME_RACK_COUNT; i++) {
      this._matchFrameWinners[idx++] = 'b';
    }
    while (idx < this.FRAME_RACK_COUNT) {
      this._matchFrameWinners[idx++] = null;
    }
  },

  refreshMatchFrameUI: function () {
    var winners = this._matchFrameWinners;
    var scoreA = 0;
    var scoreB = 0;
    var i;
    for (i = 0; i < this.FRAME_RACK_COUNT; i++) {
      if (winners[i] === 'a') scoreA++;
      if (winners[i] === 'b') scoreB++;
    }
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
      if (scoreA >= 2) {
        labelA.classList.add('fixture-result-player-name--winner');
        labelB.classList.add('fixture-result-player-name--loser');
      } else if (scoreB >= 2) {
        labelB.classList.add('fixture-result-player-name--winner');
        labelA.classList.add('fixture-result-player-name--loser');
      }
    }

    var self = this;
    var maxWins = Math.ceil(this.FRAME_RACK_COUNT / 2);
    var sideAtMax = { a: scoreA >= maxWins, b: scoreB >= maxWins };
    ['a', 'b'].forEach(function (side) {
      var host = document.getElementById('fixture-frame-racks-' + side);
      if (!host) return;
      host.querySelectorAll('.fixture-frame-rack').forEach(function (rack) {
        var idx = parseInt(rack.getAttribute('data-rack-index'), 10);
        var win = winners[idx];
        var mine = win === side;
        var lost = win !== null && win !== side;
        var disable = sideAtMax[side] && !mine;
        rack.classList.toggle('fixture-frame-rack--on', mine);
        rack.classList.toggle('fixture-frame-rack--lost', lost);
        rack.disabled = disable;
        rack.setAttribute('aria-pressed', mine ? 'true' : 'false');
        rack.setAttribute('aria-label', self.frameRackAriaLabel(idx, win, side));
      });
    });
    this.updateClearingResultWarning(scoreA, scoreB);
  },

  frameRackAriaLabel: function (idx, win, side) {
    var n = idx + 1;
    if (win === null) {
      return 'Frame ' + n + ': not awarded — tap to give to this player';
    }
    if (win === side) {
      return 'Frame ' + n + ': awarded to this player — tap to clear';
    }
    return 'Frame ' + n + ': awarded to opponent — tap to give this frame to this player';
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
      var result = await ApiClient.get(
        Object.assign({ action: 'getFixtures' }, CurrentCompetition.apiParams())
      );
      var data = result.fixtures || [];

      var league = this.selectedLeague();
      var upcoming = data.filter(function (r) {
        var notPlayed = !r['Result'] || String(r['Result']).trim() === '';
        var hasParticipants = r['Game Week'] && r['Player A'] && r['Player B'];
        if (!notPlayed || !hasParticipants) return false;
        if (league === 'All') return true;
        return String(r['League']) === league;
      });

      if (upcoming.length === 0) {
        container.innerHTML = '<p><em>No upcoming fixtures found.</em></p>';
        return;
      }

      var grouped = this.groupByGameWeek(upcoming);
      this.renderGroups(container, grouped.grouped, grouped.orderedWeeks);
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

  renderGroups: function (container, grouped, orderedWeeks) {
    var self = this;
    container.innerHTML = '';

    orderedWeeks.forEach(function (week) {
      var h3 = document.createElement('h3');
      var num = parseInt(week, 10);
      h3.textContent = isNaN(num)
        ? self.KO_LABELS[week] || week
        : 'Game Week ' + week;
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
        div.setAttribute('data-player-a-name', match['Player A'] || '');
        div.setAttribute('data-player-b-name', match['Player B'] || '');
        div.setAttribute('data-match-date', match['Match Date'] || '');

        var playerA = document.createElement('span');
        playerA.textContent = match['Player A'];
        playerA.style.flex = '1';
        playerA.style.textAlign = 'right';

        var center;
        if (self.isAdmin() && fid) {
          center = document.createElement('button');
          center.type = 'button';
          center.className = 'fixture-vs-btn';
          center.textContent = 'V';
          center.setAttribute(
            'aria-label',
            'Enter result for ' + match['Player A'] + ' vs ' + match['Player B']
          );
          center.addEventListener('click', function () {
            self.openResultDialog(div);
          });
        } else {
          center = document.createElement('span');
          center.className = 'fixture-vs-static';
          center.textContent = 'V';
        }
        center.style.flex = '0 0 auto';

        var playerB = document.createElement('span');
        playerB.textContent = match['Player B'];
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

    document.getElementById('fixture-result-fixture-id').value = fid;
    document.getElementById('fixture-result-player-a-id').value = pidA;
    document.getElementById('fixture-result-player-b-id').value = pidB;

    document.getElementById('fixture-result-label-a').textContent = nameA;
    document.getElementById('fixture-result-label-b').textContent = nameB;

    var dateEl = document.getElementById('fixture-result-date');
    dateEl.value = prevDate && String(prevDate).trim() ? prevDate : this.localISODate();

    this.ensureFrameRacksBuilt();
    var k;
    this._matchFrameWinners = [];
    for (k = 0; k < this.FRAME_RACK_COUNT; k++) {
      this._matchFrameWinners[k] = null;
    }
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

    if (!clearing && scoreA < 2 && scoreB < 2) {
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
