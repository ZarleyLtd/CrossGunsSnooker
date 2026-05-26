// Main Entry Point & Page Router
// Determines which page module to initialize based on DOM elements

document.addEventListener('DOMContentLoaded', function() {
  // Initialize image loading
  if (typeof ImageLoader !== 'undefined') {
    ImageLoader.init();
  }

  // Shared current-competition context (public pages)
  if (typeof CurrentCompetition !== 'undefined') {
    CurrentCompetition.init().catch(function (err) {
      console.error('CurrentCompetition init failed:', err);
    });
  }
  if (typeof NavCompetition !== 'undefined') {
    NavCompetition.init();
  }
  
  // Admin pages (require Admin Mode for actions)
  if (document.getElementById('adminFixturesRoot') && typeof AdminFixturesPage !== 'undefined') {
    AdminFixturesPage.init();
  }
  if (document.getElementById('adminBulkFixturesRoot') && typeof AdminBulkFixturesPage !== 'undefined') {
    AdminBulkFixturesPage.init();
  }
  if (document.getElementById('adminPlayersRoot') && typeof AdminPlayersPage !== 'undefined') {
    AdminPlayersPage.init();
  }
  if (document.getElementById('adminLeagueSeasonsRoot') && typeof AdminLeagueSeasonsPage !== 'undefined') {
    AdminLeagueSeasonsPage.init();
  }
  if (document.getElementById('adminSeasonRoot') && typeof AdminSeasonPage !== 'undefined') {
    AdminSeasonPage.init();
  }

  // Home page — swipeable competition cards
  if (document.getElementById('home-carousel') && typeof IndexPage !== 'undefined') {
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

  // Knockout bracket page
  if (document.getElementById('knockout-bracket') && typeof KnockoutPage !== 'undefined') {
    KnockoutPage.init();
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
