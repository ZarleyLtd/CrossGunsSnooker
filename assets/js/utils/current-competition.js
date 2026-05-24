// Shared "current competition" context for public pages.
// Several seasons can be marked isCurrent (e.g. league + knockout).
// The selected season drives nav, fixtures, results, and home carousel.

var CurrentCompetition = (function () {
  var STORAGE_KEY = 'crossgunsCurrentSeasonId';
  var EVENT_NAME = 'crossguns-current-competition-changed';

  var _seasons = [];
  var _current = null;
  var _ready = false;
  var _initPromise = null;

  function isKnockoutSeason(season) {
    if (!season) return false;
    var type = String(season.competitionType || season.competition_type || '')
      .trim()
      .toLowerCase();
    if (type === 'knockout') return true;
    if (type === 'league') return false;
    var id = String(season.seasonId || season.season_id || '').toLowerCase();
    if (id.indexOf('knockout') !== -1 || id.indexOf('-ko') !== -1) return true;
    var name = String(season.name || '');
    if (/\bk\/o\b/i.test(name) || /knockout/i.test(name)) return true;
    return false;
  }

  function currentSeasons() {
    return (_seasons || []).filter(function (s) {
      return s && s.isCurrent;
    });
  }

  function findSeason(seasonId) {
    if (!seasonId) return null;
    return (_seasons || []).find(function (s) {
      return String(s.seasonId) === String(seasonId);
    }) || null;
  }

  function readUrlSeasonId() {
    try {
      return new URLSearchParams(window.location.search).get('season');
    } catch (_e) {
      return null;
    }
  }

  function readStoredSeasonId() {
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch (_e) {
      return null;
    }
  }

  function writeStoredSeasonId(seasonId) {
    try {
      if (seasonId) sessionStorage.setItem(STORAGE_KEY, seasonId);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch (_e) {
      /* ignore */
    }
  }

  function defaultSeasonId() {
    var active = currentSeasons();
    if (!active.length) return null;
    var league = active.find(function (s) {
      return !isKnockoutSeason(s);
    });
    return (league || active[0]).seasonId;
  }

  function pickInitialSeasonId() {
    var active = currentSeasons();
    if (!active.length) return null;

    var urlId = readUrlSeasonId();
    if (urlId && findSeason(urlId) && findSeason(urlId).isCurrent) return urlId;

    var stored = readStoredSeasonId();
    if (stored && findSeason(stored) && findSeason(stored).isCurrent) return stored;

    return defaultSeasonId();
  }

  function dispatchChange() {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: {
          season: _current,
          seasonId: _current ? _current.seasonId : null,
        },
      })
    );
  }

  function syncUrl(seasonId) {
    try {
      var url = new URL(window.location.href);
      if (seasonId) url.searchParams.set('season', seasonId);
      else url.searchParams.delete('season');
      window.history.replaceState({}, '', url.toString());
    } catch (_e) {
      /* ignore */
    }
  }

  return {
    EVENT_NAME: EVENT_NAME,

    init: function () {
      if (_initPromise) return _initPromise;
      _initPromise = ApiClient.get({ action: 'getSeasons' })
        .then(function (res) {
          _seasons = res.seasons || [];
          var id = pickInitialSeasonId();
          _current = id ? findSeason(id) : null;
          if (!_current && _seasons.length) {
            _current = findSeason(defaultSeasonId());
          }
          writeStoredSeasonId(_current ? _current.seasonId : null);
          _ready = true;
          dispatchChange();
          return _current;
        })
        .catch(function (err) {
          console.error('CurrentCompetition.init failed:', err);
          _ready = true;
          throw err;
        });
      return _initPromise;
    },

    ready: function () {
      return _ready;
    },

    allSeasons: function () {
      return _seasons.slice();
    },

    currentSeasons: currentSeasons,

    get: function () {
      return _current;
    },

    getSeasonId: function () {
      return _current ? _current.seasonId : null;
    },

    isKnockoutSeason: isKnockoutSeason,

    isKnockout: function () {
      return isKnockoutSeason(_current);
    },

    isLeague: function () {
      return !!(_current && !isKnockoutSeason(_current));
    },

    setSeasonId: function (seasonId, options) {
      var opts = options || {};
      var next = findSeason(seasonId);
      if (!next || !next.isCurrent) return false;
      if (_current && _current.seasonId === next.seasonId) return true;
      _current = next;
      writeStoredSeasonId(next.seasonId);
      if (opts.syncUrl !== false) syncUrl(next.seasonId);
      dispatchChange();
      return true;
    },

    apiParams: function () {
      var id = this.getSeasonId();
      return id ? { season: id } : {};
    },

    whenReady: function (fn) {
      return this.init().then(fn);
    },
  };
})();
