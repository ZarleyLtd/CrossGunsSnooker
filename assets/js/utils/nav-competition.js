// Updates nav links based on the now-showing competition.

var NavCompetition = {
  init: function () {
    var self = this;
    this.syncLeagueFiltersFromSession();
    if (typeof CurrentCompetition === 'undefined') return;
    CurrentCompetition.whenReady(function () {
      self.apply();
    });
    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      self.apply();
    });
  },

  syncLeagueFiltersFromSession: function () {
    try {
      if (sessionStorage.getItem('crossgunsCurrentSeasonType') === 'knockout') {
        this.syncLeagueFilters(true);
        this.syncStandingsNav(true);
      }
    } catch (_e) {
      /* ignore */
    }
  },

  syncStandingsNav: function (hide) {
    document.querySelectorAll('.nav-item-standings').forEach(function (li) {
      li.hidden = hide;
      if (hide) li.setAttribute('aria-hidden', 'true');
      else li.removeAttribute('aria-hidden');
    });
    document.querySelectorAll('.footer-standings-link').forEach(function (link) {
      var li = link.closest('li');
      if (!li) return;
      li.hidden = hide;
      if (hide) li.setAttribute('aria-hidden', 'true');
      else li.removeAttribute('aria-hidden');
    });
  },

  syncLeagueFilters: function (hide) {
    var filterContainer = document.getElementById('filter-container');
    if (!filterContainer) return;

    if (hide) {
      filterContainer.classList.remove('filters-visible');
      filterContainer.hidden = true;
      filterContainer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.add('crossguns-knockout-comp');
    } else {
      filterContainer.classList.add('filters-visible');
      filterContainer.hidden = false;
      filterContainer.removeAttribute('aria-hidden');
      document.documentElement.classList.remove('crossguns-knockout-comp');
    }
  },

  apply: function () {
    var season = CurrentCompetition.get();
    var isKnockout = CurrentCompetition.isKnockout();

    document.querySelectorAll('.nav-standings-link').forEach(function (link) {
      link.href = 'leagues.html';
      link.textContent = 'Leagues';
    });

    document.querySelectorAll('.footer-standings-link').forEach(function (link) {
      link.href = 'leagues.html';
      link.textContent = 'Leagues';
    });

    this.syncLeagueFilters(isKnockout);
    this.syncStandingsNav(isKnockout);

    var compLabel = document.getElementById('page-competition-name');
    if (compLabel && season) {
      compLabel.textContent = season.name || '';
    }

    this.syncActiveNav();
  },

  syncActiveNav: function () {
    var path = (window.location.pathname || '').split('/').pop() || 'index.html';

    document.querySelectorAll('.navbar__menu > li').forEach(function (li) {
      li.classList.remove('active');
    });

    document.querySelectorAll('.navbar__menu a[href]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var li = link.closest('li');
      if (!li) return;
      if (href === path) li.classList.add('active');
    });
  },
};
