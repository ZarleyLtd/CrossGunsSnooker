// League/group radio filter for fixtures, results, top-breaks (per current season).

var LeagueGroupFilter = {
  KNOCKOUT_GROUP_ID: 'ko',

  _changeBound: false,

  selected: function () {
    var el = document.querySelector('input[name="league"]:checked');
    return el ? el.value : 'All';
  },

  highlightSelected: function () {
    var selected = document.querySelector('input[name="league"]:checked');
    if (!selected) return;
    document.querySelectorAll('.league-label').forEach(function (label) {
      var input = label.querySelector('input[name="league"]');
      label.classList.toggle('is-selected', !!(input && input.value === selected.value));
    });
  },

  bindChange: function (onChange) {
    var container = document.getElementById('filter-container');
    if (!container || typeof onChange !== 'function') return;
    if (this._changeBound) return;
    this._changeBound = true;
    container.addEventListener('change', function (e) {
      if (!e.target || e.target.name !== 'league') return;
      LeagueGroupFilter.highlightSelected();
      onChange();
    });
  },

  createLabel: function (value, text) {
    var label = document.createElement('label');
    label.className = 'league-label' + (value === 'All' ? ' league-label--all' : '');
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
    container.appendChild(this.createLabel('All', 'All'));

    groups.forEach(function (g) {
      container.appendChild(
        LeagueGroupFilter.createLabel(String(g.leagueId), g.name || g.leagueId)
      );
    });

    var valid = ['All'].concat(
      groups.map(function (g) {
        return String(g.leagueId);
      })
    );
    var pick = valid.indexOf(prev) >= 0 ? prev : 'All';
    container.querySelectorAll('input[name="league"]').forEach(function (rb) {
      rb.checked = rb.value === pick;
    });

    this.highlightSelected();
  },
};
