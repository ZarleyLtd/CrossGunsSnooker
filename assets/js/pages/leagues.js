// Leagues Page - 3-group League Standings (Group 1 / Group 2 / Group 3)
// Renders the API response in the same monospaced format used by the legacy
// CrossGuns Publii page (containers league-a / league-b / league-c).
// The Edge Function already returns rows ordered by the full CrossGuns
// tiebreak chain (Pts -> +/- -> W -> H2H -> max adjusted break), so this
// module just lays the rows out; it does not sort.

const LeaguesPage = {
  CONTAINERS: { '1': 'league-a', '2': 'league-b', '3': 'league-c' },

  init: async function () {
    const targets = Object.values(this.CONTAINERS).filter(function (id) {
      return document.getElementById(id);
    });
    if (targets.length === 0) return;

    try {
      const result = await ApiClient.get({ action: 'getStandings' });
      const leagues = (result && result.leagues) || [];
      const byId = {};
      leagues.forEach(function (lg) { byId[String(lg.leagueId)] = lg; });

      Object.keys(LeaguesPage.CONTAINERS).forEach(function (leagueId) {
        const containerId = LeaguesPage.CONTAINERS[leagueId];
        const lg = byId[leagueId] || { rows: [] };
        LeagueStandings.render(containerId, lg.rows || []);
      });
    } catch (error) {
      console.error('Failed to load league standings:', error);
      Object.values(LeaguesPage.CONTAINERS).forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.textContent = 'Error loading standings.';
      });
    }
  }
};
