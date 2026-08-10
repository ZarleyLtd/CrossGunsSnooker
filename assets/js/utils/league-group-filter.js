// League/group radio filter for fixtures, results, top-breaks (per current season).
// No "All" radio: none selected = all groups. Clicking the selected group clears it.

var LeagueGroupFilter = {
  KNOCKOUT_GROUP_ID: 'ko',

  _changeBound: false,
  /** Radio that was already checked at pointerdown (candidate to clear on click). */
  _wasCheckedInput: null,
  _suppressChange: false,

  selected: function () {
    var el = document.querySelector('input[name="league"]:checked');
    return el ? el.value : 'All';
  },

  highlightSelected: function () {
    var selected = document.querySelector('input[name="league"]:checked');
    document.querySelectorAll('.league-label').forEach(function (label) {
      var input = label.querySelector('input[name="league"]');
      label.classList.toggle(
        'is-selected',
        !!(selected && input && input.value === selected.value)
      );
    });
  },

  _radioFromEvent: function (container, e) {
    var t = e.target;
    if (!t) return null;
    if (t.name === 'league' && t.type === 'radio') return t;
    var label = t.closest ? t.closest('.league-label') : null;
    if (!label || !container.contains(label)) return null;
    return label.querySelector('input[name="league"]');
  },

  clearSelection: function () {
    document.querySelectorAll('input[name="league"]').forEach(function (rb) {
      rb.checked = false;
    });
    this.highlightSelected();
  },

  bindChange: function (onChange) {
    var container = document.getElementById('filter-container');
    if (!container || typeof onChange !== 'function') return;
    if (this._changeBound) return;
    this._changeBound = true;

    // Capture checked-state before the browser toggles the radio on click/tap.
    container.addEventListener(
      'pointerdown',
      function (e) {
        var input = LeagueGroupFilter._radioFromEvent(container, e);
        LeagueGroupFilter._wasCheckedInput = input && input.checked ? input : null;
      },
      true
    );

    // Capture-phase click so preventDefault wins over label/radio default behaviour.
    container.addEventListener(
      'click',
      function (e) {
        var input = LeagueGroupFilter._radioFromEvent(container, e);
        if (!input) return;

        // Clicking an already-selected group clears the filter (All).
        if (LeagueGroupFilter._wasCheckedInput === input) {
          e.preventDefault();
          e.stopPropagation();
          LeagueGroupFilter._suppressChange = true;
          input.checked = false;
          LeagueGroupFilter._wasCheckedInput = null;
          LeagueGroupFilter.highlightSelected();
          // Ensure uncheck sticks if the label re-checks synchronously after this handler.
          requestAnimationFrame(function () {
            if (input.checked) input.checked = false;
            LeagueGroupFilter._suppressChange = false;
            LeagueGroupFilter.highlightSelected();
            onChange();
          });
          return;
        }

        LeagueGroupFilter._wasCheckedInput = null;
      },
      true
    );

    container.addEventListener('change', function (e) {
      if (!e.target || e.target.name !== 'league') return;
      if (LeagueGroupFilter._suppressChange) return;
      LeagueGroupFilter._wasCheckedInput = null;
      LeagueGroupFilter.highlightSelected();
      onChange();
    });
  },

  createLabel: function (value, text) {
    var label = document.createElement('label');
    label.className = 'league-label';
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = 'league';
    input.value = value;
    label.appendChild(input);
    label.appendChild(document.createTextNode(text));
    return label;
  },

  /** Rebuild #filter-container from getSeasonGroups for the current competition. */
  sync: async function (options) {
    var opts = options || {};
    var container = document.getElementById('filter-container');
    if (!container) return;

    if (typeof CurrentCompetition !== 'undefined' && CurrentCompetition.isKnockout()) {
      return;
    }

    var seasonId =
      opts.seasonId ||
      (typeof CurrentCompetition !== 'undefined' ? CurrentCompetition.getSeasonId() : null);
    if (!seasonId) return;

    var prev = this.selected();
    var res = await ApiClient.get({ action: 'getSeasonGroups', seasonId: seasonId });
    var groups = (res.groups || []).filter(function (g) {
      return String(g.leagueId) !== LeagueGroupFilter.KNOCKOUT_GROUP_ID;
    });

    container.innerHTML = '';

    groups.forEach(function (g) {
      container.appendChild(
        LeagueGroupFilter.createLabel(String(g.leagueId), g.name || g.leagueId)
      );
    });

    var valid = groups.map(function (g) {
      return String(g.leagueId);
    });
    var pick = prev !== 'All' && valid.indexOf(prev) >= 0 ? prev : '';
    container.querySelectorAll('input[name="league"]').forEach(function (rb) {
      rb.checked = pick !== '' && rb.value === pick;
    });

    this.highlightSelected();
  },
};
