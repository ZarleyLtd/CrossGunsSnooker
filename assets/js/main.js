// Main Entry Point & Page Router
// Determines which page module to initialize based on DOM elements

document.addEventListener('DOMContentLoaded', function() {
  // Initialize image loading
  ImageLoader.init();
  
  // Admin pages (require Admin Mode for actions)
  if (document.getElementById('adminFixturesRoot') && typeof AdminFixturesPage !== 'undefined') {
    AdminFixturesPage.init();
  }
  if (document.getElementById('adminPlayersRoot') && typeof AdminPlayersPage !== 'undefined') {
    AdminPlayersPage.init();
  }
  if (document.getElementById('adminLeagueSeasonsRoot') && typeof AdminLeagueSeasonsPage !== 'undefined') {
    AdminLeagueSeasonsPage.init();
  }

  // Home page - 3 league leaders (Group 1 / Group 2 / Group 3)
  if (document.getElementById('g1-leader') ||
      document.getElementById('g2-leader') ||
      document.getElementById('g3-leader')) {
    IndexPage.init();
  }

  // Fixtures page
  if (document.getElementById('fixtures-list')) {
    FixturesPage.init();
  }

  // Results page
  if (document.getElementById('results-list')) {
    ResultsPage.init();
  }

  // Leagues page (Group 1/2/3 standings - league-a/b/c)
  if (document.getElementById('league-a') ||
      document.getElementById('league-b') ||
      document.getElementById('league-c')) {
    LeaguesPage.init();
  }

  // Handicaps page
  if (document.getElementById('handicaps')) {
    HandicapsPage.init();
  }

  // Top Breaks page
  if (document.getElementById('breaks-output')) {
    TopBreaksPage.init();
  }

  // Under development page
  if (document.getElementById('under-development-root')) {
    UnderDevelopmentPage.init();
  }
});