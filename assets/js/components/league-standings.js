// League Standings Renderer Component
// Operates on already-shaped league rows (objects with keys
// 'Player Name', P, W, L, '+/-', Pts) returned by ApiClient.
// Server applies the full CrossGuns tiebreak chain (Pts -> +/- -> W ->
// H2H -> max adjusted break) and returns a Rank per row. Joint rank is
// only when Rank matches the previous row (fully tied after all breakers).

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

    league.forEach(function (player, idx) {
      const rank = player.Rank != null && player.Rank !== ''
        ? Formatters.toInt(player.Rank)
        : idx + 1;

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
