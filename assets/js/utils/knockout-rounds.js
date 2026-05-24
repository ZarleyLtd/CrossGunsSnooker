// Knockout round codes, display labels, and sort order for fixtures UI.

var KnockoutRounds = (function () {
  var ROUNDS = [
    { code: 'PO1', label: 'Play-off 1', sortKey: 1 },
    { code: 'PO2', label: 'Play-off 2', sortKey: 2 },
    { code: 'PO3', label: 'Play-off 3', sortKey: 3 },
    { code: 'PO4', label: 'Play-off 4', sortKey: 4 },
    { code: 'QF1', label: 'Quarter-final 1', sortKey: 5 },
    { code: 'QF2', label: 'Quarter-final 2', sortKey: 6 },
    { code: 'QF3', label: 'Quarter-final 3', sortKey: 7 },
    { code: 'QF4', label: 'Quarter-final 4', sortKey: 8 },
    { code: 'SF1', label: 'Semi-final 1', sortKey: 9 },
    { code: 'SF2', label: 'Semi-final 2', sortKey: 10 },
    { code: 'F', label: 'Final', sortKey: 11 },
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
  ];

  var byCode = {};
  ROUNDS.forEach(function (r) {
    byCode[r.code] = r;
  });

  var KO_BASE_SORT = 10000;

  return {
    all: function () {
      return ROUNDS.slice();
    },

    labelFor: function (code) {
      var c = String(code == null ? '' : code).trim();
      if (!c) return '';
      if (byCode[c]) return byCode[c].label;
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
    },

    sortKeyFor: function (code) {
      var c = String(code == null ? '' : code).trim();
      if (byCode[c]) return byCode[c].sortKey;
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
    },

    sortOrderFor: function (code) {
      return KO_BASE_SORT + this.sortKeyFor(code);
    },

    isKnownCode: function (code) {
      return !!byCode[String(code == null ? '' : code).trim()];
    },

    /**
     * Group fixtures by round code.
     * @param {Array} fixtures
     * @param {boolean} descending - true = latest round first (Final before QFs)
     * @returns {Array<{code:string,label:string,matches:Array}>}
     */
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
  };
})();
