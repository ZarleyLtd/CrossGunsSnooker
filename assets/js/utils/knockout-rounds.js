// Knockout round codes, display labels, and sort order for fixtures UI.

var KnockoutRounds = (function () {
  var WINNER_OF_PREFIX = 'wo:';

  var ADMIN_STAGES = [
    { id: 'L32', label: 'Last 32', matchCount: 16, sortKey: 1 },
    { id: 'L16', label: 'Last 16', matchCount: 8, sortKey: 2 },
    { id: 'QF', label: 'Quarter Final', matchCount: 4, sortKey: 3 },
    { id: 'SF', label: 'Semi Final', matchCount: 2, sortKey: 4 },
    { id: 'F', label: 'Final', matchCount: 1, sortKey: 5 },
  ];

  var LEGACY_ROUNDS = [
    { code: 'PO1', label: 'Play-off 1', sortKey: 1 },
    { code: 'PO2', label: 'Play-off 2', sortKey: 2 },
    { code: 'PO3', label: 'Play-off 3', sortKey: 3 },
    { code: 'PO4', label: 'Play-off 4', sortKey: 4 },
    { code: 'PQ', label: 'Plate Quarters', sortKey: 20 },
    { code: 'PS', label: 'Plate Semis', sortKey: 21 },
    { code: 'PF', label: 'Plate Final', sortKey: 22 },
    { code: 'CS', label: 'Championship Semis', sortKey: 23 },
    { code: 'CF', label: 'Championship Final', sortKey: 24 },
    { code: 'KO Pre-16', label: 'Preliminary', sortKey: 101 },
    { code: 'KO Last 16', label: 'Last 16', sortKey: 102 },
    { code: 'KO Last 8', label: 'Quarter-finals', sortKey: 103 },
    { code: 'KO Last 4', label: 'Semi-finals', sortKey: 104 },
    { code: 'KO Last 2', label: 'Final', sortKey: 105 },
    { code: 'F-P', label: 'Plate Final', sortKey: 15 },
    { code: 'F-C', label: 'Championship Final', sortKey: 16 },
  ];

  function codeForStageMatchInternal(stageId, matchNum) {
    var stage = String(stageId || '').trim();
    var n = parseInt(matchNum, 10);
    if (!stage || !Number.isFinite(n) || n < 1) return '';
    if (stage === 'F') return 'F';
    if (stage === 'SF') return 'SF' + n;
    if (stage === 'QF') return 'QF' + n;
    if (stage === 'L16') return 'L16-' + n;
    if (stage === 'L32') return 'L32-' + n;
    return '';
  }

  function labelForCode(code) {
    var c = String(code == null ? '' : code).trim();
    if (!c) return '';
    if (byCode[c]) return byCode[c].label;

    var l32 = c.match(/^L32-(\d+)$/i);
    if (l32) return 'Last 32 — match ' + l32[1];

    var l16 = c.match(/^L16-(\d+)$/i);
    if (l16) return 'Last 16 — match ' + l16[1];

    var prefixed = c.match(/^(QF|SF)(\d+)$/i);
    if (prefixed) {
      var stageName = prefixed[1].toUpperCase() === 'QF' ? 'Quarter-final' : 'Semi-final';
      return stageName + ' ' + prefixed[2];
    }
    if (c === 'F') return 'Final';

    var koLast = c.match(/^KO Last (\d+)$/i);
    if (koLast) {
      var n = parseInt(koLast[1], 10);
      if (n === 2) return 'Final';
      if (n === 4) return 'Semi-finals';
      if (n === 8) return 'Quarter-finals';
      if (n === 16) return 'Last 16';
      return 'Last ' + n;
    }
    if (/^KO Pre-/i.test(c)) return 'Preliminary';
    return c;
  }

  function sortKeyForCode(code) {
    var c = String(code == null ? '' : code).trim();
    if (byCode[c]) return byCode[c].sortKey;

    var l32 = c.match(/^L32-(\d+)$/i);
    if (l32) return 100 + parseInt(l32[1], 10);

    var l16 = c.match(/^L16-(\d+)$/i);
    if (l16) return 200 + parseInt(l16[1], 10);

    var prefixed = c.match(/^(QF|SF)(\d+)$/i);
    if (prefixed) {
      var base = prefixed[1].toUpperCase() === 'QF' ? 300 : 400;
      return base + parseInt(prefixed[2], 10);
    }
    if (c === 'F') return 501;

    var koLast = c.match(/^KO Last (\d+)$/i);
    if (koLast) {
      var n = parseInt(koLast[1], 10);
      if (n === 2) return 105;
      if (n === 4) return 104;
      if (n === 8) return 103;
      if (n === 16) return 102;
      return 100 + Math.log2(n);
    }
    if (/^KO Pre-/i.test(c)) return 101;
    return 999 + c.charCodeAt(0);
  }

  var byCode = {};

  function buildStandardRounds() {
    var rounds = [];
    ADMIN_STAGES.forEach(function (stage) {
      for (var n = 1; n <= stage.matchCount; n++) {
        var code = codeForStageMatchInternal(stage.id, n);
        rounds.push({
          code: code,
          label: labelForCode(code),
          sortKey: stage.sortKey * 100 + n,
          stageId: stage.id,
          matchNum: n,
        });
      }
    });
    return rounds;
  }

  var ROUNDS = buildStandardRounds().concat(LEGACY_ROUNDS);

  ROUNDS.forEach(function (r) {
    byCode[r.code] = r;
  });

  var KO_BASE_SORT = 10000;

  function ordinal(n) {
    var num = parseInt(n, 10);
    if (!Number.isFinite(num) || num < 1) return String(n);
    var v = num % 100;
    if (v >= 11 && v <= 13) return num + 'th';
    switch (num % 10) {
      case 1:
        return num + 'st';
      case 2:
        return num + 'nd';
      case 3:
        return num + 'rd';
      default:
        return num + 'th';
    }
  }

  function winnerOfStageName(stageId) {
    var names = {
      L32: 'Last 32',
      L16: 'Last 16',
      QF: 'Quarter-final',
      SF: 'Semi-final',
      F: 'Final',
    };
    return names[stageId] || '';
  }

  function parseMatchScores(match) {
    var hasResult = match['Result'] && String(match['Result']).trim() !== '';
    var scoreA = match.scoreA;
    var scoreB = match.scoreB;
    if (hasResult) {
      var parts = String(match['Result']).trim().split('-');
      scoreA = parseInt(parts[0], 10);
      scoreB = parseInt(parts[1], 10);
    }
    if (!Number.isFinite(scoreA)) scoreA = null;
    if (!Number.isFinite(scoreB)) scoreB = null;
    return { hasResult: hasResult, scoreA: scoreA, scoreB: scoreB };
  }

  return {
    adminStages: function () {
      return ADMIN_STAGES.slice();
    },

    adminStagesForPlayerCount: function (playerCount) {
      var n = Math.max(0, parseInt(playerCount, 10) || 0);
      return ADMIN_STAGES.filter(function (stage) {
        if (stage.id === 'L32') return n >= 16;
        if (stage.id === 'L16') return n >= 8;
        if (stage.id === 'QF') return n >= 4;
        if (stage.id === 'SF') return n >= 2;
        return true;
      });
    },

    adminStageById: function (stageId) {
      return (
        ADMIN_STAGES.find(function (s) {
          return s.id === stageId;
        }) || null
      );
    },

    maxMatchNumForStage: function (stageId) {
      var stage = this.adminStageById(stageId);
      return stage ? stage.matchCount : 0;
    },

    isValidStageMatchNum: function (stageId, matchNum) {
      var n = parseInt(matchNum, 10);
      var max = this.maxMatchNumForStage(stageId);
      return max > 0 && Number.isFinite(n) && n >= 1 && n <= max;
    },

    matchNumbersForStage: function (stageId) {
      var stage = this.adminStageById(stageId);
      if (!stage) return [];
      var nums = [];
      for (var n = 1; n <= stage.matchCount; n++) nums.push(n);
      return nums;
    },

    codeForStageMatch: function (stageId, matchNum) {
      return codeForStageMatchInternal(stageId, matchNum);
    },

    parseStageMatch: function (code) {
      var c = String(code == null ? '' : code).trim();
      if (!c) return { stageId: '', matchNum: 0 };

      if (c === 'F' || c === 'F-P' || c === 'F-C' || c === 'KO Last 2') {
        return { stageId: 'F', matchNum: 1 };
      }

      var l32 = c.match(/^L32-(\d+)$/i);
      if (l32) return { stageId: 'L32', matchNum: parseInt(l32[1], 10) };

      var l16 = c.match(/^L16-(\d+)$/i);
      if (l16) return { stageId: 'L16', matchNum: parseInt(l16[1], 10) };

      var qf = c.match(/^QF(\d+)$/i);
      if (qf) return { stageId: 'QF', matchNum: parseInt(qf[1], 10) };

      var sf = c.match(/^SF(\d+)$/i);
      if (sf) return { stageId: 'SF', matchNum: parseInt(sf[1], 10) };

      if (c === 'KO Last 8') return { stageId: 'QF', matchNum: 1 };
      if (c === 'KO Last 4') return { stageId: 'SF', matchNum: 1 };
      if (c === 'KO Last 16') return { stageId: 'L16', matchNum: 1 };

      var koLast = c.match(/^KO Last (\d+)$/i);
      if (koLast) {
        var n = parseInt(koLast[1], 10);
        if (n === 16) return { stageId: 'L16', matchNum: 1 };
        if (n === 8) return { stageId: 'QF', matchNum: 1 };
        if (n === 4) return { stageId: 'SF', matchNum: 1 };
        if (n === 2) return { stageId: 'F', matchNum: 1 };
      }

      if (/^PO(\d+)$/i.test(c)) {
        var poNum = parseInt(c.match(/^PO(\d+)$/i)[1], 10);
        return { stageId: 'L32', matchNum: poNum };
      }
      if (/^KO Pre-/i.test(c)) return { stageId: 'L32', matchNum: 1 };

      return { stageId: '', matchNum: 0 };
    },

    all: function () {
      return buildStandardRounds().slice();
    },

    labelFor: function (code) {
      return labelForCode(code);
    },

    sortKeyFor: function (code) {
      return sortKeyForCode(code);
    },

    sortOrderFor: function (code) {
      return KO_BASE_SORT + this.sortKeyFor(code);
    },

    isKnownCode: function (code) {
      return !!byCode[String(code == null ? '' : code).trim()];
    },

    winnerOfPlayerId: function (roundCode) {
      return WINNER_OF_PREFIX + String(roundCode == null ? '' : roundCode).trim();
    },

    isWinnerOfPlayerId: function (playerId) {
      return String(playerId == null ? '' : playerId).indexOf(WINNER_OF_PREFIX) === 0;
    },

    roundCodeFromWinnerOfId: function (playerId) {
      if (!this.isWinnerOfPlayerId(playerId)) return '';
      return String(playerId).slice(WINNER_OF_PREFIX.length);
    },

    winnerOfDisplayLabel: function (roundCode) {
      var parsed = this.parseStageMatch(roundCode);
      if (parsed.stageId && parsed.matchNum) {
        var stageName = winnerOfStageName(parsed.stageId);
        if (stageName) {
          return ordinal(parsed.matchNum) + ' ' + stageName + ' Winner';
        }
      }
      var label = this.labelFor(roundCode);
      var base = label || String(roundCode || '').trim();
      return base ? base + ' Winner' : 'Winner';
    },

    resolvedPlayerName: function (match, slot, winnersByCode) {
      winnersByCode = winnersByCode || {};
      var isA = slot !== 'b';
      var id = isA ? match.playerAId : match.playerBId;
      var fallback = (isA ? match['Player A'] : match['Player B']) || 'TBD';
      if (this.isWinnerOfPlayerId(id)) {
        var code = this.roundCodeFromWinnerOfId(id);
        if (code && winnersByCode[code]) return winnersByCode[code];
        if (code) return this.winnerOfDisplayLabel(code);
      }
      return fallback;
    },

    buildRoundWinnersMap: function (fixtures) {
      var self = this;
      var winners = {};
      var list = (fixtures || []).slice().sort(function (a, b) {
        var diff = self.sortKeyFor(a['Game Week']) - self.sortKeyFor(b['Game Week']);
        if (diff !== 0) return diff;
        return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
      });

      list.forEach(function (match) {
        var code = String(match['Game Week'] || '').trim();
        if (!code) return;
        var sc = parseMatchScores(match);
        if (!sc.hasResult || sc.scoreA == null || sc.scoreB == null) return;
        if (sc.scoreA === sc.scoreB) return;
        var slot = sc.scoreA > sc.scoreB ? 'a' : 'b';
        var name = self.resolvedPlayerName(match, slot, winners);
        if (name && name !== 'TBD') winners[code] = name;
      });

      return winners;
    },

    stageKeyFor: function (code) {
      var c = String(code == null ? '' : code).trim();
      if (!c) return '';

      if (/^L32-/i.test(c)) return 'L32';
      if (/^L16-/i.test(c)) return 'L16';

      var prefixed = c.match(/^(PO|QF|SF)(\d+)$/i);
      if (prefixed) return prefixed[1].toUpperCase();

      if (c === 'F' || c === 'F-P' || c === 'F-C') return 'F';

      var koLast = c.match(/^KO Last (\d+)$/i);
      if (koLast) {
        var n = parseInt(koLast[1], 10);
        if (n === 2) return 'F';
        if (n === 4) return 'SF';
        if (n === 8) return 'QF';
        if (n === 16) return 'L16';
        if (n === 32) return 'L32';
        return 'KO-LAST-' + n;
      }
      if (/^KO Pre-/i.test(c)) return 'L32';
      return c;
    },

    stageLabelFor: function (code) {
      var key = this.stageKeyFor(code);
      var labels = {
        L32: 'Last 32',
        L16: 'Last 16',
        PO: 'Play-offs',
        QF: 'Quarter-finals',
        SF: 'Semi-finals',
        F: 'Final',
        'KO-PRELIM': 'Preliminary',
        'KO-L16': 'Last 16',
        'KO-QF': 'Quarter-finals',
        'KO-SEMI': 'Semi-finals',
        'KO-FINAL': 'Final',
      };
      if (labels[key]) return labels[key];
      return this.labelFor(code);
    },

    stageSortKeyFor: function (code) {
      var key = this.stageKeyFor(code);
      var keys = {
        L32: 1,
        L16: 2,
        PO: 3,
        QF: 4,
        SF: 5,
        F: 6,
        'KO-PRELIM': 101,
        'KO-L16': 102,
        'KO-QF': 103,
        'KO-SEMI': 104,
        'KO-FINAL': 105,
      };
      if (keys[key] != null) return keys[key];
      return this.sortKeyFor(code);
    },

    groupFixturesByStage: function (fixtures, descending) {
      var stages = {};
      (fixtures || []).forEach(function (f) {
        var code = String(f['Game Week'] || '').trim();
        if (!code || !f['Player A'] || !f['Player B']) return;
        var sk = KnockoutRounds.stageKeyFor(code);
        if (!stages[sk]) {
          stages[sk] = {
            stageKey: sk,
            label: KnockoutRounds.stageLabelFor(code),
            codes: [],
            matches: [],
            sortKey: KnockoutRounds.stageSortKeyFor(code),
          };
        }
        if (stages[sk].codes.indexOf(code) < 0) stages[sk].codes.push(code);
        stages[sk].matches.push(f);
        stages[sk].sortKey = Math.min(stages[sk].sortKey, KnockoutRounds.stageSortKeyFor(code));
      });

      Object.keys(stages).forEach(function (sk) {
        stages[sk].matches.sort(function (a, b) {
          var ca = KnockoutRounds.sortKeyFor(a['Game Week']);
          var cb = KnockoutRounds.sortKeyFor(b['Game Week']);
          if (ca !== cb) return ca - cb;
          return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
        });
      });

      var list = Object.keys(stages).map(function (sk) {
        return stages[sk];
      });
      list.sort(function (a, b) {
        var diff = a.sortKey - b.sortKey;
        return descending ? -diff : diff;
      });
      return list;
    },

    groupFixtures: function (fixtures, descending) {
      var grouped = {};
      (fixtures || []).forEach(function (f) {
        var code = String(f['Game Week'] || '').trim();
        if (!code || !f['Player A'] || !f['Player B']) return;
        if (!grouped[code]) grouped[code] = [];
        grouped[code].push(f);
      });
      var codes = Object.keys(grouped).sort(function (a, b) {
        var diff = KnockoutRounds.sortKeyFor(a) - KnockoutRounds.sortKeyFor(b);
        return descending ? -diff : diff;
      });
      return codes.map(function (code) {
        return {
          code: code,
          label: KnockoutRounds.labelFor(code),
          matches: grouped[code],
        };
      });
    },

    /**
     * Group knockout fixtures by stage for list UIs (fixtures, results, admin).
     * @returns {{ grouped: Object.<string,Array>, orderedKeys: string[], labels: Object.<string,string> }}
     */
    groupForList: function (fixtures) {
      var stages = this.groupFixturesByStage(fixtures, false);
      var grouped = {};
      var orderedKeys = [];
      var labels = {};
      stages.forEach(function (stage) {
        orderedKeys.push(stage.stageKey);
        grouped[stage.stageKey] = stage.matches;
        labels[stage.stageKey] = stage.label;
      });
      return { grouped: grouped, orderedKeys: orderedKeys, labels: labels };
    },
  };
})();
