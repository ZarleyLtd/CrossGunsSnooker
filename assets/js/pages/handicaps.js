// Handicaps Page - Handicaps Table

const HandicapsPage = {
  init: async function() {
    const table = document.getElementById('handicaps');
    if (!table) return;
    
    try {
      const result = await ApiClient.get({ action: 'getHandicaps' });
      // The API already returns the latest handicap per player, sorted alphabetically.
      const sortedPlayers = (result.latest || []).filter(r => r['Player Name']);
      
      // Render table
      let tbody = table.querySelector('tbody');
      if (!tbody) {
        tbody = document.createElement('tbody');
        table.appendChild(tbody);
      }
      tbody.innerHTML = '';
      
      sortedPlayers.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${r['Player Name']}</td>
          <td>${r['Handicap']}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      console.error('Failed to load handicaps:', error);
    }
  }
};
