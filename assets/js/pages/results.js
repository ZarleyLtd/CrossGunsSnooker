// Results Page — match results; admin can edit via same dialog as Fixtures

var ResultsPage = {
  KO_LABELS: {
    CS: 'Championship Semis',
    CF: 'Championship Final',
    PQ: 'Plate Quarters',
    PS: 'Plate Semis',
    PF: 'Plate Final',
  },

  _listenersBound: false,

  adminModeEvent: function () {
    return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
  },

  isAdmin: function () {
    return typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
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

  bindLeagueFilter: function () {
    var self = this;
    document.querySelectorAll('input[name="league"]').forEach(function (rb) {
      rb.addEventListener('change', function () {
        self.highlightSelectedLeague();
        self.init().catch(function (e) { console.error(e); });
      });
    });
    this.highlightSelectedLeague();
  },

  init: async function () {
    var container = document.getElementById('results-list');
    if (!container) return;

    var self = this;

    if (!this._listenersBound) {
      this._listenersBound = true;
      window.addEventListener(this.adminModeEvent(), function () {
        self.init().catch(function (e) {
          console.error(e);
        });
      });

      if (typeof FixturesPage !== 'undefined' && FixturesPage.RESULT_SAVED_EVENT) {
        window.addEventListener(FixturesPage.RESULT_SAVED_EVENT, function () {
          self.init().catch(function (e) {
            console.error(e);
          });
        });
      }

      this.bindLeagueFilter();
    }

    if (typeof FixturesPage !== 'undefined') {
      FixturesPage.bindResultDialog();
    }

    try {
      var result = await ApiClient.get({ action: 'getFixtures' });
      var data = result.fixtures || [];

      var league = this.selectedLeague();
      var rows = data.filter(function (r) {
        var has = r['Game Week'] && r['Player A'] && r['Player B'] && r['Result']
          && String(r['Result']).trim() !== '';
        if (!has) return false;
        if (league === 'All') return true;
        return String(r['League']) === league;
      });

      if (rows.length === 0) {
        container.innerHTML = '<p><em>No results available yet.</em></p>';
        return;
      }

      var groupedWeeks = this.groupByGameWeek(rows);

      this.renderGroups(container, groupedWeeks.grouped, groupedWeeks.orderedWeeks);
    } catch (error) {
      console.error('Failed to load results:', error);
      container.innerHTML = '<p><em>Error loading results.</em></p>';
    }
  },

  groupByGameWeek: function (results) {
    var grouped = {};
    var orderedWeeks = [];

    results.forEach(function (r) {
      var week = String(r['Game Week']).trim();
      if (!grouped[week]) {
        grouped[week] = [];
        orderedWeeks.push(week);
      }
      grouped[week].push(r);
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
        div.style.display = 'flex';
        div.style.justifyContent = 'center';
        div.style.alignItems = 'center';
        div.style.gap = '0.5em';
        div.style.margin = '0.3em 0';
        div.style.fontSize = '1.05em';

        var fid = String(match.fixtureId || '').trim();
        div.setAttribute('data-fixture-id', fid);
        div.setAttribute('data-player-a-id', String(match.playerAId || '').trim());
        div.setAttribute('data-player-b-id', String(match.playerBId || '').trim());
        div.setAttribute('data-player-a-name', match['Player A'] || '');
        div.setAttribute('data-player-b-name', match['Player B'] || '');
        div.setAttribute('data-match-date', match['Match Date'] || '');

        var sa = match.scoreA != null && match.scoreA !== '' ? Number(match.scoreA) : 0;
        var sb = match.scoreB != null && match.scoreB !== '' ? Number(match.scoreB) : 0;
        if (!Number.isFinite(sa)) sa = 0;
        if (!Number.isFinite(sb)) sb = 0;
        div.setAttribute('data-prefill-score-a', String(sa));
        div.setAttribute('data-prefill-score-b', String(sb));

        var resultStr = String(match['Result']).trim();
        var parts = resultStr.split('-');
        var aScore = parseInt(parts[0] ? parts[0].trim() : '', 10);
        var bScore = parseInt(parts[1] ? parts[1].trim() : '', 10);

        var playerA = document.createElement('span');
        playerA.textContent = match['Player A'];
        playerA.style.flex = '1';
        playerA.style.textAlign = 'right';
        if (!isNaN(aScore) && !isNaN(bScore) && aScore > bScore) playerA.style.fontWeight = 'bold';

        var resultEl;
        if (self.isAdmin() && fid && typeof FixturesPage !== 'undefined') {
          resultEl = document.createElement('button');
          resultEl.type = 'button';
          resultEl.className = 'results-score-btn';
          resultEl.textContent = '[' + resultStr + ']';
          resultEl.setAttribute(
            'aria-label',
            'Edit result ' +
              resultStr +
              ': ' +
              match['Player A'] +
              ' vs ' +
              match['Player B']
          );
          resultEl.addEventListener('click', function () {
            FixturesPage.openResultDialog(div);
          });
        } else {
          resultEl = document.createElement('span');
          resultEl.textContent = '[' + resultStr + ']';
          resultEl.style.flex = '0 0 auto';
          resultEl.style.fontWeight = 'bold';
          resultEl.style.minWidth = '3.5em';
          resultEl.style.textAlign = 'center';
        }
        resultEl.style.flex = '0 0 auto';
        resultEl.style.fontWeight = 'bold';
        resultEl.style.minWidth = '3.5em';
        resultEl.style.textAlign = 'center';

        var playerB = document.createElement('span');
        playerB.textContent = match['Player B'];
        playerB.style.flex = '1';
        playerB.style.textAlign = 'left';
        if (!isNaN(aScore) && !isNaN(bScore) && bScore > aScore) playerB.style.fontWeight = 'bold';

        div.appendChild(playerA);
        div.appendChild(resultEl);
        div.appendChild(playerB);
        container.appendChild(div);
      });
    });
  },
};
