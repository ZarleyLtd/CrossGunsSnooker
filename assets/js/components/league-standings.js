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
   * Home-card leader label from server Rank (joint Rank 1 => "A & B (tied)").
   * @param {Array} rows Already-ordered standings rows with Rank.
   * @returns {string}
   */
  leadersLabel: function (rows) {
    var sorted = this.sort(rows || []);
    if (!sorted.length) return 'N/A';
    var topRank = Formatters.toInt(sorted[0].Rank, 1);
    var leaders = sorted.filter(function (r) {
      return Formatters.toInt(r.Rank, 0) === topRank;
    });
    if (leaders.length === 0) return sorted[0]['Player Name'] || 'N/A';
    if (leaders.length === 1) return leaders[0]['Player Name'];
    return (
      leaders
        .map(function (r) {
          return r['Player Name'];
        })
        .join(' & ') + ' (tied)'
    );
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
    container.textContent = '';
    container.appendChild(document.createTextNode(header + '\n' + sep + '\n'));

    league.forEach(function (player, idx) {
      const rank = player.Rank != null && player.Rank !== ''
        ? Formatters.toInt(player.Rank)
        : idx + 1;

      const line = [
        Formatters.padLeft(rank, 2),
        Formatters.padRight(Formatters.truncateName(player['Player Name']), 16),
        Formatters.padLeft(player.P, 2),
        Formatters.padLeft(player.W, 2),
        Formatters.padLeft(player.L, 2),
        Formatters.padLeft(player['+/-'], 3),
        Formatters.padLeft(player.Pts, 3)
      ].join(' ');
      const span = document.createElement('span');
      span.className = player.unapproved ? 'standings-line standings-line--unapproved' : 'standings-line';
      span.setAttribute('data-help', 'leagues.row');
      span.textContent = line;
      container.appendChild(span);
      container.appendChild(document.createTextNode('\n'));
    });
  }
};
