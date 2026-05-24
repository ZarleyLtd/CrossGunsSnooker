// Top Breaks Page - adjusted-break leaderboard for the current season.
// Preserves the legacy CrossGuns UX:
//   - Container id 'breaks-output' (filled with one <div> per break)
//   - Radio filter (name="league") with values All / 1 / 2 / 3
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
    return Array.isArray(result.breaks) ? result.breaks : [];
  },

  highlightSelected: function () {
    const selected = document.querySelector('input[name="league"]:checked');
    if (!selected) return;
    document.querySelectorAll('.league-label').forEach(function (label) {
      const input = label.querySelector('input[name="league"]');
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

  render: function () {
    const container = document.getElementById('breaks-output');
    if (!container) return;

    const selectedEl = document.querySelector('input[name="league"]:checked');
    const selected = selectedEl ? selectedEl.value : 'All';

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

    document.querySelectorAll('input[name="league"]').forEach(function (rb) {
      rb.addEventListener('change', function () {
        TopBreaksPage.render();
        TopBreaksPage.highlightSelected();
      });
    });

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
      this._breaks = await this.fetchData();
      this.render();
      this.highlightSelected();
    } catch (err) {
      console.error('Failed to load top breaks:', err);
      container.textContent = 'Could not load top breaks. Please try again later.';
    }
  }
};
