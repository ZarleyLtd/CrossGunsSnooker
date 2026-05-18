// League Standings Renderer Component
// Operates on already-shaped league rows (objects with keys
// 'Player Name', P, W, L, '+/-', Pts) returned by ApiClient.
// Server already applies the full CrossGuns tiebreak chain, so this
// component preserves incoming order and only assigns "joint rank"
// when two adjacent rows are identical on (Pts, +/-, W).

const LeagueStandings = {
  /**
   * No-op alias kept for backward compatibility: the Edge Function already
   * orders the rows. Callers should just pass them straight to render().
   */
  sort: function (league) {
    return (league || []).slice();
  },

  /**
   * Render league standings as monospaced text inside a <pre> container.
   * @param {string} containerId
   * @param {Array}  league Already-ordered league rows.
   */
  render: function (containerId, league) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!league || league.length === 0) {
      container.textContent = 'No players.';
      return;
    }

    const header = [
      Formatters.padLeft('#', 2),
      Formatters.padRight('Player Name', 16),
      Formatters.padLeft('P', 2),
      Formatters.padLeft('W', 2),
      Formatters.padLeft('L', 2),
      Formatters.padLeft('+/-', 3),
      Formatters.padLeft('Pts', 3)
    ].join(' ');

    const sep = '-'.repeat(header.length);
    const lines = [header, sep];

    let lastPts = null;
    let lastPM = null;
    let lastW = null;
    let lastRank = 0;

    league.forEach(function (player, idx) {
      const pts = Formatters.toInt(player.Pts);
      const pm = Formatters.toInt(player['+/-']);
      const won = Formatters.toInt(player.W);

      let rank;
      if (idx > 0 && pts === lastPts && pm === lastPM && won === lastW) {
        rank = lastRank;
      } else {
        rank = idx + 1;
        lastRank = rank;
      }
      lastPts = pts;
      lastPM = pm;
      lastW = won;

      lines.push([
        Formatters.padLeft(rank, 2),
        Formatters.padRight(Formatters.truncateName(player['Player Name']), 16),
        Formatters.padLeft(player.P, 2),
        Formatters.padLeft(player.W, 2),
        Formatters.padLeft(player.L, 2),
        Formatters.padLeft(player['+/-'], 3),
        Formatters.padLeft(player.Pts, 3)
      ].join(' '));
    });

    container.textContent = lines.join('\n');
  }
};
