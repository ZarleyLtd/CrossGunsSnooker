// Leagues Page - 3-group League Standings (Group 1 / Group 2 / Group 3)

const LeaguesPage = {
  CONTAINERS: { '1': 'league-a', '2': 'league-b', '3': 'league-c' },

  init: async function () {
    const targets = Object.values(this.CONTAINERS).filter(function (id) {
      return document.getElementById(id);
    });
    if (targets.length === 0) return;

    const self = this;

    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      if (CurrentCompetition.isKnockout()) {
        window.location.replace('knockout.html' + (window.location.search || ''));
        return;
      }
      self.loadStandings().catch(function (e) {
        console.error(e);
      });
    });

    await CurrentCompetition.whenReady(function () {
      if (CurrentCompetition.isKnockout()) {
        window.location.replace('knockout.html' + (window.location.search || ''));
        return;
      }
      return self.loadStandings();
    });
  },

  loadStandings: async function () {
    try {
      const result = await ApiClient.get(
        Object.assign({ action: 'getStandings' }, CurrentCompetition.apiParams())
      );
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
  },
};
