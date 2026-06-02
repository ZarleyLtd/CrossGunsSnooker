// Home Page — carousel cards for each current comp (league KO stages omitted; shown on parent league card).

const IndexPage = {
  _carouselIndex: 0,
  _dragStartX: null,
  _dragActive: false,
  _swipeBound: false,
  _controlsBound: false,

  seasonIdOf: function (season) {
    return season ? String(season.seasonId || season.compId || '') : '';
  },

  viewport: function () {
    return document.getElementById('home-carousel-viewport');
  },

  track: function () {
    return document.getElementById('home-carousel-track');
  },

  slides: function () {
    var track = IndexPage.track();
    return track ? track.querySelectorAll('.home-carousel__slide') : [];
  },

  /** Standings groups that have at least one player (drops empty global leagues from API). */
  standingsGroupsWithPlayers: function (st) {
    var groups = (st && st.leagues) || (st && st.groups) || [];
    return groups.filter(function (grp) {
      return (grp.rows || []).length > 0;
    });
  },

  topPlayersLabel: function (rows) {
    var sorted = LeagueStandings.sort(rows || []);
    if (!sorted.length) return 'N/A';
    var topPts = Formatters.toInt(sorted[0].Pts, 0);
    var topPM = Formatters.toInt(sorted[0]['+/-'], 0);
    var leaders = sorted.filter(function (r) {
      return Formatters.toInt(r.Pts, 0) === topPts && Formatters.toInt(r['+/-'], 0) === topPM;
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

  buildLeagueCard: function (season, groups) {
    var card = document.createElement('article');
    card.className = 'home-comp-card home-comp-card--league';
    card.setAttribute('data-season-id', this.seasonIdOf(season));

    var html = '';
    html += '<p class="align-center home-comp-card__subtitle">League stage &mdash; current leaders</p>';

    (groups || []).forEach(function (grp) {
      var label = IndexPage.topPlayersLabel(grp.rows || []);
      html += '<div class="home-leader-group">';
      html +=
        '<h3 class="align-center"><span style="color:#169179;">' +
        IndexPage.esc(grp.name || grp.leagueId || grp.groupId) +
        '</span></h3>';
      html +=
        '<h3 class="align-center"><span class="home-comp-card__leader">' +
        IndexPage.esc(label) +
        '</span></h3>';
      html += '</div>';
    });

    if (!(groups || []).length) {
      html += '<p class="align-center"><em>No groups yet</em></p>';
    }

    card.innerHTML = html;
    return card;
  },

  buildKnockoutCard: function (season, fixtures) {
    var card = document.createElement('article');
    card.className = 'home-comp-card home-comp-card--knockout';
    card.setAttribute('data-season-id', this.seasonIdOf(season));

    var bracket = document.createElement('div');
    bracket.className = 'home-comp-card__bracket ko-bracket-page';
    card.appendChild(bracket);

    if (typeof KnockoutBracket !== 'undefined') {
      KnockoutBracket.render(bracket, fixtures, { stageNav: true });
    } else if (typeof KnockoutRounds !== 'undefined' && typeof KnockoutRenderer !== 'undefined') {
      var rounds = KnockoutRounds.groupFixtures(fixtures, true);
      if (!rounds.length) {
        bracket.innerHTML = '<p class="align-center"><em>No fixtures yet</em></p>';
      } else {
        rounds.forEach(function (round) {
          var section = document.createElement('section');
          section.className = 'knockout-round';
          var heading = document.createElement('h3');
          heading.className = 'knockout-round__heading align-center';
          heading.textContent = round.label || round.code;
          section.appendChild(heading);
          var list = document.createElement('div');
          list.className = 'knockout-round__matches';
          round.matches.forEach(function (match) {
            KnockoutRenderer.renderRow(list, match);
          });
          section.appendChild(list);
          bracket.appendChild(section);
        });
      }
    } else {
      bracket.innerHTML = '<p class="align-center"><em>Bracket unavailable.</em></p>';
    }

    return card;
  },

  esc: function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  loadCardData: async function (season) {
    var sid = IndexPage.seasonIdOf(season);
    if (CurrentCompetition.isKnockoutSeason(season)) {
      var fxKo = await ApiClient.get({ action: 'getFixtures', season: sid });
      return IndexPage.buildKnockoutCard(season, fxKo.fixtures || []);
    }

    var koComp = CurrentCompetition.findAssociatedKnockout(season);
    if (koComp) {
      var koFx = await ApiClient.get({
        action: 'getFixtures',
        season: IndexPage.seasonIdOf(koComp),
      });
      if ((koFx.fixtures || []).length) {
        return IndexPage.buildKnockoutCard(season, koFx.fixtures || []);
      }
    }

    var st = await ApiClient.get({ action: 'getStandings', season: sid });
    return IndexPage.buildLeagueCard(season, IndexPage.standingsGroupsWithPlayers(st));
  },

  renderCarousel: async function () {
    var track = document.getElementById('home-carousel-track');
    var dots = document.getElementById('home-carousel-dots');
    if (!track) return;

    var comps = CurrentCompetition.carouselSeasons();
    track.innerHTML = '';
    if (dots) dots.innerHTML = '';

    if (!comps.length) {
      track.innerHTML = '<p class="align-center"><em>No current competitions.</em></p>';
      IndexPage.updateCompHeader();
      IndexPage.updateCarouselHint(0);
      return;
    }

    var cards = await Promise.all(
      comps.map(function (comp) {
        return IndexPage.loadCardData(comp);
      })
    );

    cards.forEach(function (card, idx) {
      var slide = document.createElement('div');
      slide.className = 'home-carousel__slide';
      slide.appendChild(card);
      track.appendChild(slide);

      if (dots) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'home-carousel__dot';
        dot.setAttribute('aria-label', 'Show competition ' + (idx + 1));
        dot.addEventListener('click', function () {
          IndexPage.goToSlide(idx, true);
        });
        dots.appendChild(dot);
      }
    });

    var selectedId = CurrentCompetition.getSeasonId();
    var startIdx = comps.findIndex(function (c) {
      return IndexPage.seasonIdOf(c) === selectedId;
    });
    IndexPage._carouselIndex = startIdx >= 0 ? startIdx : 0;
    IndexPage.updateCompHeader();
    IndexPage.updateCarouselHint(comps.length);
    IndexPage.bindCarouselControls();
    IndexPage.updateCarouselPosition(false);
    IndexPage.relayoutKnockoutBrackets();
  },

  updateCompHeader: function () {
    var el = document.getElementById('home-carousel-comp-title');
    var comps = CurrentCompetition.carouselSeasons();
    if (!el) return;
    if (!comps.length) {
      el.textContent = '';
      return;
    }
    var comp = comps[IndexPage._carouselIndex];
    el.textContent = comp && comp.name ? comp.name : '';
  },

  updateCarouselHint: function (seasonCount) {
    var hint = document.querySelector('.home-carousel__hint');
    if (!hint) return;
    hint.hidden = seasonCount <= 1;
  },

  bindCarouselControls: function () {
    if (IndexPage._controlsBound) return;
    IndexPage._controlsBound = true;

    var prev = document.getElementById('home-carousel-prev');
    var next = document.getElementById('home-carousel-next');
    if (prev) {
      prev.addEventListener('click', function () {
        IndexPage.goToSlide(IndexPage._carouselIndex - 1, true);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        IndexPage.goToSlide(IndexPage._carouselIndex + 1, true);
      });
    }

    if (IndexPage._swipeBound) return;
    IndexPage._swipeBound = true;

    var viewport = IndexPage.viewport();
    if (!viewport) return;

    viewport.addEventListener(
      'touchstart',
      function (e) {
        if (!e.touches || !e.touches.length) return;
        IndexPage._dragStartX = e.touches[0].clientX;
        IndexPage._dragActive = true;
      },
      { passive: true }
    );

    viewport.addEventListener(
      'touchend',
      function (e) {
        IndexPage.finishDrag(e.changedTouches && e.changedTouches[0] ? e.changedTouches[0].clientX : null);
      },
      { passive: true }
    );

    viewport.addEventListener('touchcancel', function () {
      IndexPage._dragStartX = null;
      IndexPage._dragActive = false;
    });

    viewport.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      IndexPage._dragStartX = e.clientX;
      IndexPage._dragActive = true;
      viewport.setPointerCapture(e.pointerId);
    });

    viewport.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'touch') return;
      IndexPage.finishDrag(e.clientX);
      try {
        viewport.releasePointerCapture(e.pointerId);
      } catch (_err) {
        /* ignore */
      }
    });

    viewport.addEventListener('pointercancel', function (e) {
      if (e.pointerType === 'touch') return;
      IndexPage._dragStartX = null;
      IndexPage._dragActive = false;
    });

    window.addEventListener('resize', function () {
      IndexPage.updateCarouselPosition(false);
    });
  },

  finishDrag: function (endX) {
    if (!IndexPage._dragActive || IndexPage._dragStartX == null || endX == null) {
      IndexPage._dragStartX = null;
      IndexPage._dragActive = false;
      return;
    }
    var delta = endX - IndexPage._dragStartX;
    IndexPage._dragStartX = null;
    IndexPage._dragActive = false;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) {
      IndexPage.goToSlide(IndexPage._carouselIndex + 1, true);
    } else {
      IndexPage.goToSlide(IndexPage._carouselIndex - 1, true);
    }
  },

  syncViewportHeight: function () {
    var viewport = IndexPage.viewport();
    var slides = IndexPage.slides();
    if (!viewport || !slides.length) return;
    var slide = slides[IndexPage._carouselIndex];
    if (!slide) return;
    viewport.style.height = slide.offsetHeight + 'px';
  },

  updateArrows: function () {
    var comps = CurrentCompetition.carouselSeasons();
    var prev = document.getElementById('home-carousel-prev');
    var next = document.getElementById('home-carousel-next');
    var count = comps.length;
    var idx = IndexPage._carouselIndex;

    if (prev) {
      var showPrev = count > 1 && idx > 0;
      prev.classList.toggle('is-unavailable', !showPrev);
      prev.hidden = !showPrev;
      prev.disabled = !showPrev;
      if (prev.hasAttribute('aria-hidden')) {
        prev.setAttribute('aria-hidden', showPrev ? 'false' : 'true');
      }
    }
    if (next) {
      var showNext = count > 1 && idx < count - 1;
      next.classList.toggle('is-unavailable', !showNext);
      next.hidden = !showNext;
      next.disabled = !showNext;
      if (next.hasAttribute('aria-hidden')) {
        next.setAttribute('aria-hidden', showNext ? 'false' : 'true');
      }
    }
  },

  scrollPageToTop: function () {
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  },

  goToSlide: function (index, syncCompetition) {
    var track = IndexPage.track();
    var comps = CurrentCompetition.carouselSeasons();
    if (!track || !comps.length) return;

    var max = comps.length - 1;
    var next = Math.max(0, Math.min(index, max));
    if (next === IndexPage._carouselIndex && !syncCompetition) {
      IndexPage.syncViewportHeight();
      IndexPage.updateArrows();
      return;
    }
    IndexPage._carouselIndex = next;
    IndexPage.updateCarouselPosition(true);

    if (syncCompetition) {
      CurrentCompetition.setSeasonId(IndexPage.seasonIdOf(comps[next]));
    }

    IndexPage.scrollPageToTop();
  },

  updateCarouselPosition: function (animate) {
    var track = IndexPage.track();
    var viewport = IndexPage.viewport();
    var dots = document.querySelectorAll('.home-carousel__dot');
    var slides = IndexPage.slides();
    if (!track || !viewport) return;

    var slideWidth = viewport.offsetWidth;
    slides.forEach(function (slide) {
      slide.style.flexBasis = slideWidth + 'px';
      slide.style.width = slideWidth + 'px';
    });

    track.style.transition = animate ? 'transform 0.35s ease' : 'none';
    track.style.transform = 'translateX(-' + IndexPage._carouselIndex * slideWidth + 'px)';

    dots.forEach(function (dot, idx) {
      dot.classList.toggle('is-active', idx === IndexPage._carouselIndex);
      dot.setAttribute('aria-current', idx === IndexPage._carouselIndex ? 'true' : 'false');
    });

    window.requestAnimationFrame(function () {
      IndexPage.syncViewportHeight();
      IndexPage.updateArrows();
      IndexPage.updateCompHeader();
      IndexPage.relayoutKnockoutBrackets();
    });
  },

  relayoutKnockoutBrackets: function () {
    if (typeof KnockoutBracket === 'undefined' || !KnockoutBracket.relayout) return;
    var slide = IndexPage.slides()[IndexPage._carouselIndex];
    if (!slide) return;
    slide.querySelectorAll('.home-comp-card__bracket').forEach(function (bracket) {
      KnockoutBracket.relayout(bracket);
    });
  },

  init: async function () {
    var root = document.getElementById('home-carousel');
    if (!root) return;

    await CurrentCompetition.whenReady(function () {
      return IndexPage.renderCarousel();
    });

    window.addEventListener(CurrentCompetition.EVENT_NAME, function (ev) {
      var comps = CurrentCompetition.carouselSeasons();
      var detailId =
        ev.detail && (ev.detail.seasonId || (ev.detail.season && IndexPage.seasonIdOf(ev.detail.season)));
      var idx = comps.findIndex(function (c) {
        return IndexPage.seasonIdOf(c) === detailId;
      });
      if (idx >= 0 && idx !== IndexPage._carouselIndex) {
        IndexPage.goToSlide(idx, false);
        return;
      }
      if (idx >= 0) {
        IndexPage.renderCarousel().catch(function (e) {
          console.error(e);
        });
      }
    });
  },
};
