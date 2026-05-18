// Home Page - Spring League leaders (Group 1 / Group 2 / Group 3)
// The legacy Publii home page shows the current top player(s) of each
// league using the full CrossGuns tiebreak chain (Pts -> +/- -> W -> H2H
// -> max adjusted break). The Edge Function already applies that ordering
// server-side, so this module simply takes the first row of each league.
// If the first two rows are tied on the primary stats (Pts, +/-, W) the
// page shows "Name1 & Name2 (tied)" to match the legacy joint-leader UX.

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
    const first = rows[0];
    const tiedNames = [first['Player Name']];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const samePts = Formatters.toInt(r.Pts) === Formatters.toInt(first.Pts);
      const samePM = Formatters.toInt(r['+/-']) === Formatters.toInt(first['+/-']);
      const sameW = Formatters.toInt(r.W) === Formatters.toInt(first.W);
      if (samePts && samePM && sameW) {
        tiedNames.push(r['Player Name']);
      } else {
        break;
      }
    }
    if (tiedNames.length === 1) return tiedNames[0];
    return tiedNames.join(' & ') + ' (tied)';
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
