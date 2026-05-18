// Home Page - Spring League leaders (Group 1 / Group 2 / Group 3)
// The legacy Publii home page shows the current top player(s) of each
// league using the full CrossGuns tiebreak chain (Pts -> +/- -> W -> H2H
// -> max adjusted break). The Edge Function already applies that ordering
// server-side, so this module simply takes the first row of each league.
// If multiple players share rank 1 (fully tied after the full tiebreak
// chain) the page shows "Name1 & Name2 (tied)" to match the legacy UX.

const IndexPage = {
  TARGETS: { '1': 'g1-leader', '2': 'g2-leader', '3': 'g3-leader' },

  showError: function (msg) {
    Object.values(IndexPage.TARGETS).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.textContent = msg;
    });
  },

  topPlayersLabel: function (rows) {
    if (!rows || rows.length === 0) return 'N/A';
    const leaders = rows.filter(function (r) {
      return Formatters.toInt(r.Rank) === 1;
    });
    if (leaders.length === 0) return rows[0]['Player Name'] || 'N/A';
    if (leaders.length === 1) return leaders[0]['Player Name'];
    return leaders.map(function (r) { return r['Player Name']; }).join(' & ') + ' (tied)';
  },

  init: async function () {
    const targets = Object.values(this.TARGETS).filter(function (id) {
      return document.getElementById(id);
    });
    if (targets.length === 0) return;

    try {
      const result = await ApiClient.get({ action: 'getStandings' });
      const leagues = (result && result.leagues) || [];
      const byId = {};
      leagues.forEach(function (lg) { byId[String(lg.leagueId)] = lg; });

      Object.keys(IndexPage.TARGETS).forEach(function (leagueId) {
        const containerId = IndexPage.TARGETS[leagueId];
        const el = document.getElementById(containerId);
        if (!el) return;
        const lg = byId[leagueId];
        const rows = (lg && lg.rows) || [];
        el.textContent = IndexPage.topPlayersLabel(rows);
      });
    } catch (err) {
      console.error('Error loading leader data:', err);
      IndexPage.showError('Error loading leaders.');
    }
  }
};
