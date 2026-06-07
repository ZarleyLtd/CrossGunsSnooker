// Top Breaks Page - adjusted-break leaderboard for the current season.
// Preserves the legacy CrossGuns UX:
//   - Container id 'breaks-output' (filled with one <div> per break)
//   - Radio filter (name="league") built from current season groups (All + div ids)
//   - Each entry shows the adjusted break in <strong>, then either
//       [raw plus handicap]   when a positive handicap pushed the value up, or
//       [actual break]        when the value was already >= 25 unaided.
//   - Threshold: only breaks with raw value >= 25 are shown (legacy rule).

const TopBreaksPage = {
  _breaks: [],

  fetchData: async function () {
    const result = await ApiClient.get(
      Object.assign({ action: 'getTopBreaks', limit: '500' }, CurrentCompetition.apiParams())
    );
    let breaks = Array.isArray(result.breaks) ? result.breaks : [];

    const season = CurrentCompetition.get();
    const ko = season && CurrentCompetition.isLeague()
      ? CurrentCompetition.findAssociatedKnockout(season)
      : null;
    if (ko) {
      const koId = ko.seasonId || ko.compId;
      if (koId) {
        const koResult = await ApiClient.get({
          action: 'getTopBreaks',
          limit: '500',
          season: koId,
        });
        breaks = this._mergeBreaks(breaks, koResult.breaks || []);
      }
    }

    return breaks;
  },

  _mergeBreaks: function (primary, extra) {
    const seen = new Set();
    const merged = [];
    (primary || []).concat(extra || []).forEach(function (b) {
      const id = b && (b.breakId || b.break_id);
      if (id) {
        if (seen.has(id)) return;
        seen.add(id);
      }
      merged.push(b);
    });
    return merged;
  },

  render: function () {
    const container = document.getElementById('breaks-output');
    if (!container) return;

    const selected =
      typeof LeagueGroupFilter !== 'undefined' ? LeagueGroupFilter.selected() : 'All';

    let visible = this._breaks.filter(function (b) {
      return Formatters.toInt(b['Break']) >= 25;
    });
    if (selected !== 'All') {
      visible = visible.filter(function (b) { return String(b['League']) === selected; });
    }
    visible.sort(function (a, b) { return Formatters.toInt(b['Adjusted']) - Formatters.toInt(a['Adjusted']); });

    if (visible.length === 0) {
      container.textContent = 'No breaks recorded.';
      return;
    }

    const html = visible.map(function (b) {
      const adjusted = Formatters.toInt(b['Adjusted']);
      const raw = Formatters.toInt(b['Break']);
      const adjust = adjusted - raw;
      const adjustmentDisplay = adjust > 0
        ? '<span style="color:#777;">[' + raw + ' plus ' + adjust + ']</span>'
        : '<span style="color:#777;">[actual break]</span>';
      const player = TopBreaksPage._escape(b['Player Name']);
      const opponent = TopBreaksPage._escape(b['Opponent']);
      return '<div style="margin-left: 1em;">'
        + '<strong>' + adjusted + '</strong> '
        + adjustmentDisplay + ' – ' + player + ' '
        + '<span style="color:#777;">(v ' + opponent + ')</span>'
        + '</div>';
    }).join('');

    container.innerHTML = html;
  },

  _escape: function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  init: async function () {
    const container = document.getElementById('breaks-output');
    if (!container) return;

    if (typeof LeagueGroupFilter !== 'undefined') {
      LeagueGroupFilter.bindChange(function () {
        TopBreaksPage.render();
      });
    }

    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      TopBreaksPage.reload().catch(function (e) {
        console.error(e);
      });
    });

    await CurrentCompetition.whenReady(function () {
      return TopBreaksPage.reload();
    });
  },

  reload: async function () {
    const container = document.getElementById('breaks-output');
    if (!container) return;
    try {
      if (typeof LeagueGroupFilter !== 'undefined') {
        await LeagueGroupFilter.sync();
      }
      this._breaks = await this.fetchData();
      this.render();
      if (typeof LeagueGroupFilter !== 'undefined') {
        LeagueGroupFilter.highlightSelected();
      }
    } catch (err) {
      console.error('Failed to load top breaks:', err);
      container.textContent = 'Could not load top breaks. Please try again later.';
    }
  }
};
