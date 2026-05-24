// Updates nav links based on the selected current competition.

var NavCompetition = {
  init: function () {
    var self = this;
    CurrentCompetition.whenReady(function () {
      self.apply();
    });
    window.addEventListener(CurrentCompetition.EVENT_NAME, function () {
      self.apply();
    });
  },

  apply: function () {
    var season = CurrentCompetition.get();
    var isKnockout = CurrentCompetition.isKnockout();

    document.querySelectorAll('.nav-standings-link').forEach(function (link) {
      if (isKnockout) {
        link.href = 'knockout.html';
        link.textContent = 'Knockout';
      } else {
        link.href = 'leagues.html';
        link.textContent = 'Leagues';
      }
    });

    document.querySelectorAll('.footer-standings-link').forEach(function (link) {
      if (isKnockout) {
        link.href = 'knockout.html';
        link.textContent = 'Knockout';
      } else {
        link.href = 'leagues.html';
        link.textContent = 'Leagues';
      }
    });

    var filterContainer = document.getElementById('filter-container');
    if (filterContainer) {
      filterContainer.hidden = isKnockout;
      filterContainer.style.display = isKnockout ? 'none' : '';
    }

    var compLabel = document.getElementById('page-competition-name');
    if (compLabel && season) {
      compLabel.textContent = season.name || '';
    }

    this.syncActiveNav(isKnockout);
  },

  syncActiveNav: function (isKnockout) {
    var path = (window.location.pathname || '').split('/').pop() || 'index.html';
    var standingsPage = isKnockout ? 'knockout.html' : 'leagues.html';

    document.querySelectorAll('.navbar__menu > li').forEach(function (li) {
      li.classList.remove('active');
    });

    document.querySelectorAll('.navbar__menu a[href]').forEach(function (link) {
      var href = link.getAttribute('href') || '';
      var li = link.closest('li');
      if (!li) return;
      if (href === path) li.classList.add('active');
      if (
        (path === 'leagues.html' || path === 'knockout.html') &&
        href === standingsPage
      ) {
        li.classList.add('active');
      }
    });
  },
};
