// Knockout Tournament Renderer Component
// Single source of truth for knockout display logic

const KnockoutRenderer = {
  /**
   * Render knockout matches in a container
   * @param {string} containerId - Element ID to render into
   * @param {Array} matches - Array of match data objects
   */
  render: function(containerId, matches) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!matches || matches.length === 0) {
      container.textContent = '(No fixtures yet)';
      return;
    }
    
    const NAME_WIDTH = '9.5em';
    
    matches.forEach(match => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'center';
      row.style.alignItems = 'center';
      row.style.margin = '0.35em 0';
      row.style.fontSize = '1.05em';
      row.style.whiteSpace = 'nowrap';
      
      // Player A
      const playerA = document.createElement('span');
      playerA.textContent = match['Player A'] || '';
      playerA.style.display = 'inline-block';
      playerA.style.width = NAME_WIDTH;
      playerA.style.textAlign = 'right';
      playerA.style.paddingRight = '0.3em';
      
      // Center (V or score)
      let centerText = 'V';
      if (match['Result'] && match['Result'].trim() !== '') {
        centerText = `[${match['Result']}]`;
      }
      const middle = document.createElement('span');
      middle.textContent = centerText;
      middle.style.display = 'inline-block';
      middle.style.width = '3em';
      middle.style.textAlign = 'center';
      middle.style.fontWeight = 'bold';
      
      // Player B
      const playerB = document.createElement('span');
      playerB.textContent = match['Player B'] || '';
      playerB.style.display = 'inline-block';
      playerB.style.width = NAME_WIDTH;
      playerB.style.textAlign = 'left';
      playerB.style.paddingLeft = '0.3em';
      
      row.appendChild(playerA);
      row.appendChild(middle);
      row.appendChild(playerB);
      container.appendChild(row);
    });
  },
  
  /**
   * Filter matches by game week code
   * @param {Array} fixtures - All fixtures
   * @param {string} gameWeekCode - Code like 'CS', 'CF', 'PQ', 'PS', 'PF'
   * @returns {Array} Filtered matches
   */
  filterByGameWeek: function(fixtures, gameWeekCode) {
    const gw = r => (r['Game Week'] || '').trim().toUpperCase();
    return fixtures.filter(r => gw(r) === gameWeekCode);
  }
};