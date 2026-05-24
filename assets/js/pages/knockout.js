// Knockout bracket page — full draw for the selected current competition.

var KnockoutPage = {
  init: function () {
    var root = document.getElementById('knockout-bracket');
    if (!root) return;

    var self = this;
    CurrentCompetition.whenReady(function () {
      if (CurrentCompetition.isLeague()) {
        window.location.replace('leagues.html' + (window.location.search || ''));
        return;
      }
      self.render().catch(function (e) {
        console.error(e);
        root.textContent = 'Error loading knockout draw.';
      });
    });

    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      if (CurrentCompetition.isLeague()) {
        window.location.replace('leagues.html' + (window.location.search || ''));
        return;
      }
      self.render().catch(function (e) {
        console.error(e);
      });
    });
  },

  render: async function () {
    var root = document.getElementById('knockout-bracket');
    if (!root) return;

    root.textContent = 'Loading…';

    var result = await ApiClient.get(
      Object.assign({ action: 'getFixtures' }, CurrentCompetition.apiParams())
    );
    var fixtures = (result.fixtures || []).filter(function (f) {
      return f['Player A'] && f['Player B'];
    });

    if (!fixtures.length) {
      root.innerHTML = '<p class="align-center"><em>No knockout fixtures yet.</em></p>';
      return;
    }

    var grouped = KnockoutRounds.groupFixtures(fixtures, true);

    root.innerHTML = '';

    grouped.forEach(function (round) {
      var section = document.createElement('section');
      section.className = 'knockout-round';

      var heading = document.createElement('h3');
      heading.className = 'knockout-round__heading align-center';
      heading.textContent = round.label || round.code;
      section.appendChild(heading);

      var list = document.createElement('div');
      list.className = 'knockout-round__matches';
      list.id = 'knockout-round-' + round.code;

      round.matches.forEach(function (match) {
        KnockoutRenderer.renderRow(list, match);
      });

      section.appendChild(list);
      root.appendChild(section);
    });
  },
};
