// Leagues Page — standings for the selected current league competition.

const LeaguesPage = {
  KNOCKOUT_GROUP_ID: 'ko',

  init: async function () {
    const root = document.getElementById('leagues-standings-root');
    if (!root) return;

    const self = this;

    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      if (CurrentCompetition.isKnockout()) {
        window.location.replace('index.html' + (window.location.search || ''));
        return;
      }
      self.loadStandings().catch(function (e) {
        console.error(e);
      });
    });

    await CurrentCompetition.whenReady(function () {
      if (CurrentCompetition.isKnockout()) {
        window.location.replace('index.html' + (window.location.search || ''));
        return;
      }
      return self.loadStandings();
    });
  },

  loadStandings: async function () {
    const root = document.getElementById('leagues-standings-root');
    if (!root) return;

    try {
      const seasonId = CurrentCompetition.getSeasonId();
      if (!seasonId) {
        root.innerHTML = '<p class="align-center"><em>No competition selected.</em></p>';
        return;
      }

      const groupsRes = await ApiClient.get({
        action: 'getSeasonGroups',
        seasonId: seasonId,
      });
      const standingsRes = await ApiClient.get(
        Object.assign({ action: 'getStandings' }, CurrentCompetition.apiParams())
      );

      const groups = (groupsRes.groups || []).filter(function (g) {
        return String(g.leagueId) !== LeaguesPage.KNOCKOUT_GROUP_ID;
      });

      const byId = {};
      ((standingsRes && (standingsRes.groups || standingsRes.leagues)) || []).forEach(
        function (lg) {
          byId[String(lg.leagueId)] = lg;
        }
      );

      this.renderGroups(root, groups, byId);
    } catch (error) {
      console.error('Failed to load league standings:', error);
      root.innerHTML = '<p class="align-center"><em>Error loading standings.</em></p>';
    }
  },

  renderGroups: function (root, groups, byId) {
    root.innerHTML = '';

    if (!groups.length) {
      root.innerHTML = '<p class="align-center"><em>No groups for this competition.</em></p>';
      return;
    }

    groups.forEach(function (g, idx) {
      const wrapper = document.createElement('div');
      wrapper.className = 'standings-wrapper';

      const heading = document.createElement('h2');
      heading.className = 'standings-heading';
      heading.textContent = g.name || g.leagueId;

      const pre = document.createElement('pre');
      pre.className = 'league-standings';
      pre.id = 'league-standings-' + idx;
      pre.setAttribute('aria-label', (g.name || g.leagueId) + ' standings');

      wrapper.appendChild(heading);
      wrapper.appendChild(pre);
      root.appendChild(wrapper);

      const lg = byId[String(g.leagueId)] || { rows: [] };
      LeagueStandings.render(pre.id, lg.rows || []);
    });
  },
};
