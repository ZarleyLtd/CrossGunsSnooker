// Results Page — match results; edit via same dialog as Fixtures (Admin or passcode)

var ResultsPage = {
  KO_LABELS: {
    CS: 'Championship Semis',
    CF: 'Championship Final',
    PQ: 'Plate Quarters',
    PS: 'Plate Semis',
    PF: 'Plate Final',
  },

  _listenersBound: false,

  /** Cached fixtures from last network load (filtered client-side by group radios). */
  _leagueFixtures: null,
  _koFixtures: null,

  adminModeEvent: function () {
    return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
  },

  isAdmin: function () {
    return typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
  },

  selectedLeague: function () {
    return typeof LeagueGroupFilter !== 'undefined'
      ? LeagueGroupFilter.selected()
      : 'All';
  },

  refreshFilterAndLoad: async function () {
    if (typeof LeagueGroupFilter !== 'undefined') {
      await LeagueGroupFilter.sync();
    }
    return this.loadResults();
  },

  init: async function () {
    var container = document.getElementById('results-list');
    if (!container) return;

    var self = this;

    if (!this._listenersBound) {
      this._listenersBound = true;
      window.addEventListener(this.adminModeEvent(), function () {
        self.applyFilterAndRender();
      });

      window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
        self.refreshFilterAndLoad().catch(function (e) {
          console.error(e);
        });
      });

      if (typeof LeagueGroupFilter !== 'undefined') {
        LeagueGroupFilter.bindChange(function () {
          self.applyFilterAndRender();
        });
      }

      if (typeof FixturesPage !== 'undefined' && FixturesPage.RESULT_SAVED_EVENT) {
        window.addEventListener(FixturesPage.RESULT_SAVED_EVENT, function () {
          self.loadResults().catch(function (e) {
            console.error(e);
          });
        });
      }

    }

    if (typeof FixturesPage !== 'undefined') {
      FixturesPage.bindResultDialog();
      if (FixturesPage.ensureHandicapsLoaded) FixturesPage.ensureHandicapsLoaded();
    }

    await CurrentCompetition.whenReady(function () {
      return self.refreshFilterAndLoad();
    });
  },

  completedFixtures: function (fixtures) {
    return (fixtures || []).filter(function (r) {
      return r['Game Week'] && r['Player A'] && r['Player B'] && r['Result']
        && String(r['Result']).trim() !== '';
    });
  },

  loadResults: async function () {
    var container = document.getElementById('results-list');
    if (!container) return;

    try {
      var isKnockout = CurrentCompetition.isKnockout();
      var result = await ApiClient.get(
        Object.assign({ action: 'getFixtures' }, CurrentCompetition.apiParams())
      );
      var data = result.fixtures || [];

      this._leagueFixtures = data;
      this._koFixtures = [];

      if (isKnockout) {
        this._koFixtures = data;
      } else {
        var season = CurrentCompetition.get();
        var ko = CurrentCompetition.findAssociatedKnockout(season);
        if (ko) {
          var koId = ko.seasonId || ko.compId;
          if (koId) {
            var koResult = await ApiClient.get({ action: 'getFixtures', season: koId });
            this._koFixtures = koResult.fixtures || [];
          }
        }
      }

      this.applyFilterAndRender();
    } catch (error) {
      console.error('Failed to load results:', error);
      this._leagueFixtures = null;
      this._koFixtures = null;
      container.innerHTML = '<p><em>Error loading results.</em></p>';
    }
  },

  /** Re-render from cached fixtures using the current group radio (no network I/O). */
  applyFilterAndRender: function () {
    var container = document.getElementById('results-list');
    if (!container) return;

    if (!this._leagueFixtures && !this._koFixtures) {
      this.loadResults().catch(function (e) {
        console.error(e);
      });
      return;
    }

    var isKnockout = CurrentCompetition.isKnockout();
    var league = this.selectedLeague();
    var data = this._leagueFixtures || [];
    var koAllFixtures = this._koFixtures || [];

    var leagueRows = [];
    var koRows = [];

    if (isKnockout) {
      koRows = this.completedFixtures(koAllFixtures.length ? koAllFixtures : data);
    } else {
      leagueRows = this.completedFixtures(data).filter(function (r) {
        var stage = String(r['Stage'] || '').toLowerCase();
        if (stage === 'knockout') return false;
        if (league === 'All') return true;
        return String(r['League']) === league;
      });

      if (league === 'All') {
        koRows = this.completedFixtures(koAllFixtures);
      }
    }

    if (leagueRows.length === 0 && koRows.length === 0) {
      container.innerHTML = '<p><em>No results available yet.</em></p>';
      return;
    }

    container.innerHTML = '';

    if (leagueRows.length > 0) {
      var groupedWeeks = this.groupByGameWeek(leagueRows);
      this.renderGroups(container, groupedWeeks.grouped, groupedWeeks.orderedWeeks, {
        append: true,
      });
    }

    if (koRows.length > 0) {
      var koFixturesForWinners = isKnockout
        ? (koAllFixtures.length ? koAllFixtures : data)
        : koAllFixtures;
      var winnersByCode = typeof KnockoutRounds !== 'undefined'
        ? KnockoutRounds.buildRoundWinnersMap(koFixturesForWinners)
        : {};
      var winnerIdsByCode = typeof KnockoutRounds !== 'undefined' && KnockoutRounds.buildRoundWinnerIdsMap
        ? KnockoutRounds.buildRoundWinnerIdsMap(koFixturesForWinners)
        : {};
      var koGrouped;
      if (typeof KnockoutRounds !== 'undefined') {
        koGrouped = KnockoutRounds.groupForList(koRows);
      } else {
        var fallback = this.groupByGameWeek(koRows);
        koGrouped = {
          grouped: fallback.grouped,
          orderedKeys: fallback.orderedWeeks,
          labels: {},
        };
      }
      this.renderGroups(container, koGrouped.grouped, koGrouped.orderedKeys, {
        append: true,
        isKnockout: true,
        sectionLabels: koGrouped.labels,
        winnersByCode: winnersByCode,
        winnerIdsByCode: winnerIdsByCode,
      });
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

  knockoutPlayerLabel: function (match, slot, winnersByCode) {
    if (typeof FixturesPage !== 'undefined') {
      return FixturesPage.knockoutPlayerLabel(match, slot, winnersByCode);
    }
    if (typeof KnockoutRounds !== 'undefined') {
      return KnockoutRounds.resolvedPlayerName(match, slot, winnersByCode);
    }
    return slot === 'a' ? match['Player A'] || '' : match['Player B'] || '';
  },

  renderGroups: function (container, grouped, orderedWeeks, options) {
    var self = this;
    options = options || {};
    if (!options.append) {
      container.innerHTML = '';
    }
    var isKnockout = !!options.isKnockout;
    var winnersByCode = options.winnersByCode || {};
    var winnerIdsByCode = options.winnerIdsByCode || {};
    var sectionLabels = options.sectionLabels || {};

    orderedWeeks.forEach(function (week) {
      var h3 = document.createElement('h3');
      if (isKnockout) {
        h3.textContent = sectionLabels[week]
          || (typeof KnockoutRounds !== 'undefined' ? KnockoutRounds.labelFor(week) : null)
          || self.KO_LABELS[week]
          || week;
      } else {
        var num = parseInt(week, 10);
        h3.textContent = isNaN(num)
          ? self.KO_LABELS[week] || week
          : 'Game Week ' + week;
      }
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
        var slotIdA = String(match.playerAId || '').trim();
        var slotIdB = String(match.playerBId || '').trim();
        var pidA = slotIdA;
        var pidB = slotIdB;
        if (
          isKnockout &&
          typeof KnockoutRounds !== 'undefined' &&
          KnockoutRounds.resolvedPlayerId
        ) {
          pidA = KnockoutRounds.resolvedPlayerId(match, 'a', winnerIdsByCode) || slotIdA;
          pidB = KnockoutRounds.resolvedPlayerId(match, 'b', winnerIdsByCode) || slotIdB;
        }
        div.setAttribute('data-fixture-id', fid);
        div.setAttribute('data-player-a-id', pidA);
        div.setAttribute('data-player-b-id', pidB);
        var playerAName = isKnockout
          ? self.knockoutPlayerLabel(match, 'a', winnersByCode)
          : (match['Player A'] || '');
        var playerBName = isKnockout
          ? self.knockoutPlayerLabel(match, 'b', winnersByCode)
          : (match['Player B'] || '');
        div.setAttribute('data-player-a-name', playerAName);
        div.setAttribute('data-player-b-name', playerBName);
        div.setAttribute('data-match-date', match['Match Date'] || '');
        div.setAttribute(
          'data-best-of',
          String(
            typeof FixturesPage !== 'undefined' && FixturesPage.normalizeBestOf
              ? FixturesPage.normalizeBestOf(match.bestOf)
              : match.bestOf || 3
          )
        );
        div.setAttribute('data-had-result', '1');

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

        var enteredBy = String(match.resultEnteredBy || '').trim();
        if (enteredBy) div.setAttribute('data-result-entered-by', enteredBy);

        var matchDate = match['Match Date'] || '';
        var playerA =
          typeof FixturesPage !== 'undefined' && FixturesPage.makePlayerNameEl
            ? FixturesPage.makePlayerNameEl(
                playerAName,
                pidA,
                matchDate,
                'right'
              )
            : (function () {
                var el = document.createElement('span');
                el.textContent = playerAName;
                el.style.flex = '1';
                el.style.textAlign = 'right';
                return el;
              })();
        if (!isNaN(aScore) && !isNaN(bScore) && aScore > bScore) {
          playerA.style.fontWeight = 'bold';
        }

        var resultEl;
        if (fid && typeof FixturesPage !== 'undefined') {
          resultEl = document.createElement('button');
          resultEl.type = 'button';
          resultEl.className = 'results-score-btn';
          resultEl.textContent = '[' + resultStr + ']';
          resultEl.setAttribute(
            'aria-label',
            'Edit result ' +
              resultStr +
              ': ' +
              playerAName +
              ' vs ' +
              playerBName
          );
          resultEl.addEventListener('click', function () {
            FixturesPage.requestOpenResultDialog(div);
          });
        } else {
          resultEl = document.createElement('span');
          resultEl.textContent = '[' + resultStr + ']';
        }
        resultEl.style.flex = '0 0 auto';
        resultEl.style.fontWeight = 'bold';
        resultEl.style.minWidth = '3.5em';
        resultEl.style.textAlign = 'center';

        var playerB =
          typeof FixturesPage !== 'undefined' && FixturesPage.makePlayerNameEl
            ? FixturesPage.makePlayerNameEl(
                playerBName,
                pidB,
                matchDate,
                'left'
              )
            : (function () {
                var el = document.createElement('span');
                el.textContent = playerBName;
                el.style.flex = '1';
                el.style.textAlign = 'left';
                return el;
              })();
        if (!isNaN(aScore) && !isNaN(bScore) && bScore > aScore) {
          playerB.style.fontWeight = 'bold';
        }

        var wrap = document.createElement('div');
        wrap.className = 'fixture-row-wrap';
        div.appendChild(playerA);
        div.appendChild(resultEl);
        div.appendChild(playerB);
        wrap.appendChild(div);
        container.appendChild(wrap);
      });
    });
  },
};
