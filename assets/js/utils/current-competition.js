// Shared competition context for public pages.
// Home carousel lists current comps except league knockout stages (shown on parent league card).

var CurrentCompetition = (function () {
  var STORAGE_KEY = 'crossgunsCurrentSeasonId';
  var STORAGE_TYPE_KEY = 'crossgunsCurrentSeasonType';
  var EVENT_NAME = 'crossguns-current-competition-changed';

  var _seasons = [];
  var _current = null;
  var _ready = false;
  var _initPromise = null;

  function seasonIdOf(s) {
    return s ? (s.seasonId || s.compId) : null;
  }

  function parentSeasonIdOf(s) {
    return s ? (s.parentSeasonId || s.parentCompId || '') : '';
  }

  function isKnockoutSeason(season) {
    if (!season) return false;
    var type = String(season.competitionType || season.competition_type || '')
      .trim()
      .toLowerCase();
    if (type === 'knockout') return true;
    if (type === 'league') return false;
    var id = String(seasonIdOf(season) || '').toLowerCase();
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

  function inferredParentSeasonId(knockoutSeason) {
    if (!knockoutSeason || !isKnockoutSeason(knockoutSeason)) return '';
    var explicit = String(parentSeasonIdOf(knockoutSeason)).trim();
    if (explicit) return explicit;
    var sid = String(seasonIdOf(knockoutSeason) || '');
    var m = sid.match(/^(.+)-(ko|knockout)$/i);
    if (!m) return '';
    return m[1];
  }

  function isLeagueKnockoutStage(season) {
    if (!season || !isKnockoutSeason(season)) return false;
    if (String(parentSeasonIdOf(season)).trim()) return true;
    var parentId = inferredParentSeasonId(season);
    if (!parentId) return false;
    var parent = findSeason(parentId);
    return !!(parent && parent.isCurrent && !isKnockoutSeason(parent));
  }

  function carouselSeasons() {
    return currentSeasons().filter(function (s) {
      return !isLeagueKnockoutStage(s);
    });
  }

  function normalizeNowShowingSeasonId(seasonId) {
    if (!seasonId) return null;
    var season = findSeason(seasonId);
    if (!season || !season.isCurrent) return null;
    if (!isLeagueKnockoutStage(season)) return seasonIdOf(season);
    var parent = findSeason(parentSeasonIdOf(season) || inferredParentSeasonId(season));
    if (parent && parent.isCurrent) return seasonIdOf(parent);
    return null;
  }

  function findAssociatedKnockout(leagueSeason) {
    if (!leagueSeason || isKnockoutSeason(leagueSeason)) return null;
    var parentId = String(seasonIdOf(leagueSeason));
    var list = (_seasons || []).filter(function (s) {
      return s && s.isCurrent && isKnockoutSeason(s);
    });
    var linked = list.find(function (s) {
      return String(parentSeasonIdOf(s)) === parentId;
    });
    if (linked) return linked;
    var byConvention = list.find(function (s) {
      return String(seasonIdOf(s)) === parentId + '-ko';
    });
    if (byConvention) return byConvention;
    return (
      list.find(function (s) {
        return inferredParentSeasonId(s) === parentId;
      }) || null
    );
  }

  function findSeason(seasonId) {
    if (!seasonId) return null;
    return (
      (_seasons || []).find(function (s) {
        return String(seasonIdOf(s)) === String(seasonId);
      }) || null
    );
  }

  function readUrlSeasonId() {
    try {
      var p = new URLSearchParams(window.location.search);
      return p.get('season') || p.get('comp');
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

  function writeStoredSeasonType(season) {
    try {
      if (season) {
        sessionStorage.setItem(
          STORAGE_TYPE_KEY,
          isKnockoutSeason(season) ? 'knockout' : 'league'
        );
      } else {
        sessionStorage.removeItem(STORAGE_TYPE_KEY);
      }
    } catch (_e) {
      /* ignore */
    }
  }

  function writeStoredSeasonMeta(season) {
    writeStoredSeasonId(season ? seasonIdOf(season) : null);
    writeStoredSeasonType(season);
  }

  function defaultSeasonId() {
    var active = carouselSeasons();
    if (!active.length) return null;
    var league = active.find(function (s) {
      return !isKnockoutSeason(s);
    });
    return seasonIdOf(league || active[0]);
  }

  function pickInitialSeasonId() {
    if (!carouselSeasons().length && !currentSeasons().length) return null;

    var urlId = normalizeNowShowingSeasonId(readUrlSeasonId());
    if (urlId) return urlId;

    var stored = normalizeNowShowingSeasonId(readStoredSeasonId());
    if (stored) return stored;

    return defaultSeasonId();
  }

  function dispatchChange() {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: {
          season: _current,
          seasonId: _current ? seasonIdOf(_current) : null,
        },
      })
    );
  }

  function syncUrl(seasonId) {
    try {
      var url = new URL(window.location.href);
      if (seasonId) url.searchParams.set('season', seasonId);
      else url.searchParams.delete('season');
      url.searchParams.delete('comp');
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
          _seasons = res.seasons || res.competitions || [];
          var id = pickInitialSeasonId();
          _current = id ? findSeason(id) : null;
          if (!_current && _seasons.length) {
            _current = findSeason(defaultSeasonId());
          }
          writeStoredSeasonMeta(_current);
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

    carouselSeasons: carouselSeasons,

    isLeagueKnockoutStage: isLeagueKnockoutStage,

    get: function () {
      return _current;
    },

    getSeasonId: function () {
      return _current ? seasonIdOf(_current) : null;
    },

    findAssociatedKnockout: findAssociatedKnockout,

    isKnockoutSeason: isKnockoutSeason,

    isKnockout: function () {
      return isKnockoutSeason(_current);
    },

    isLeague: function () {
      return !!(_current && !isKnockoutSeason(_current));
    },

    setSeasonId: function (seasonId, options) {
      var opts = options || {};
      var id = opts.allowKnockoutStage
        ? seasonId
        : normalizeNowShowingSeasonId(seasonId) || seasonId;
      var next = findSeason(id);
      if (!next || !next.isCurrent) return false;
      if (!opts.allowKnockoutStage && isLeagueKnockoutStage(next)) return false;
      if (_current && seasonIdOf(_current) === seasonIdOf(next)) return true;
      _current = next;
      writeStoredSeasonMeta(next);
      if (opts.syncUrl !== false) syncUrl(seasonIdOf(next));
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
