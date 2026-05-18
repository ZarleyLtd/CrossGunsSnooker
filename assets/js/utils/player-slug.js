// Deterministic player_id from display name (matches scripts/migrate-sheets-to-supabase.mjs slugify).

var PlayerSlug = {
  slugify: function (name) {
    var s = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return s || 'player';
  },
};
