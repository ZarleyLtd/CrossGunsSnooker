// Under Development Page placeholder.
// Currently shows the same 3-league standings as the leagues page if the
// `under-development-root` host has the same league-a/b/c containers.

const UnderDevelopmentPage = {
  init: async function () {
    if (typeof LeaguesPage !== 'undefined' && typeof LeaguesPage.init === 'function') {
      await LeaguesPage.init();
    }
  }
};
