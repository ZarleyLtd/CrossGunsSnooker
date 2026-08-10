// Horizontal knockout bracket: one column per stage (e.g. all semi-finals together), bracket lines between stages.

var KnockoutBracket = (function () {
  function parseScores(match) {
    var hasResult = match['Result'] && String(match['Result']).trim() !== '';
    var scoreA = match.scoreA;
    var scoreB = match.scoreB;
    if (hasResult) {
      var parts = String(match['Result']).trim().split('-');
      scoreA = parseInt(parts[0], 10);
      scoreB = parseInt(parts[1], 10);
    }
    if (!Number.isFinite(scoreA)) scoreA = null;
    if (!Number.isFinite(scoreB)) scoreB = null;
    return { hasResult: hasResult, scoreA: scoreA, scoreB: scoreB };
  }

  function stageKeyFromCode(code) {
    return typeof KnockoutRounds !== 'undefined'
      ? KnockoutRounds.stageKeyFor(code)
      : code;
  }

  /** @returns {Array<{id:string,label:string,stages:Array}>} */
  function buildTracks(stagesAsc) {
    if (!stagesAsc.length) return [];

    var stageByKey = {};
    stagesAsc.forEach(function (s) {
      stageByKey[s.stageKey] = s;
    });

    var parentOf = {};
    stagesAsc.forEach(function (stage) {
      parentOf[stage.stageKey] = [];
      stage.matches.forEach(function (m) {
        ['playerAId', 'playerBId'].forEach(function (key) {
          var pid = m[key];
          if (
            typeof KnockoutRounds !== 'undefined' &&
            KnockoutRounds.isWinnerOfPlayerId(pid)
          ) {
            var refCode = KnockoutRounds.roundCodeFromWinnerOfId(pid);
            var psk = stageKeyFromCode(refCode);
            if (psk && stageByKey[psk] && parentOf[stage.stageKey].indexOf(psk) < 0) {
              parentOf[stage.stageKey].push(psk);
            }
          }
        });
      });
    });

    var adj = {};
    stagesAsc.forEach(function (s) {
      adj[s.stageKey] = [];
    });
    stagesAsc.forEach(function (stage) {
      (parentOf[stage.stageKey] || []).forEach(function (psk) {
        adj[stage.stageKey].push(psk);
        adj[psk].push(stage.stageKey);
      });
    });

    var hasLinks = false;
    stagesAsc.forEach(function (s) {
      if ((parentOf[s.stageKey] || []).length) hasLinks = true;
    });

    if (!hasLinks) {
      return splitTracksByConvention(stagesAsc);
    }

    var seen = {};
    var tracks = [];

    stagesAsc.forEach(function (stage) {
      if (seen[stage.stageKey]) return;
      var stack = [stage.stageKey];
      var keys = [];
      seen[stage.stageKey] = true;
      while (stack.length) {
        var k = stack.pop();
        keys.push(k);
        (adj[k] || []).forEach(function (nb) {
          if (!seen[nb]) {
            seen[nb] = true;
            stack.push(nb);
          }
        });
      }
      var trackStages = keys
        .map(function (k) {
          return stageByKey[k];
        })
        .filter(Boolean)
        .sort(function (a, b) {
          return a.sortKey - b.sortKey;
        });
      if (trackStages.length) {
        tracks.push({
          id: trackStages[0].stageKey,
          label: trackLabel(trackStages),
          stages: trackStages,
        });
      }
    });

    if (!tracks.length) {
      tracks.push({ id: 'main', label: '', stages: stagesAsc });
    }

    return tracks;
  }

  var PLATE_STAGE_KEYS = { 'plate-quarters': 1, PQ: 1, PS: 1, PF: 1 };
  var CHAMP_STAGE_KEYS = { 'championship-semis': 1, CS: 1, CF: 1, 'championship-final': 1 };

  function splitTracksByConvention(stagesAsc) {
    var plate = [];
    var champ = [];
    var other = [];

    stagesAsc.forEach(function (stage) {
      var sk = stage.stageKey;
      var codes = stage.codes || [];
      var isPlate =
        sk === 'PQ' ||
        sk === 'PS' ||
        sk === 'PF' ||
        codes.indexOf('PQ') >= 0 ||
        codes.indexOf('PS') >= 0 ||
        codes.indexOf('PF') >= 0;
      var isChamp =
        sk === 'CS' ||
        sk === 'CF' ||
        codes.indexOf('CS') >= 0 ||
        codes.indexOf('CF') >= 0;
      if (isPlate) plate.push(stage);
      else if (isChamp) champ.push(stage);
      else other.push(stage);
    });

    var tracks = [];
    if (plate.length) tracks.push({ id: 'plate', label: 'Plate', stages: plate });
    if (champ.length) tracks.push({ id: 'champ', label: 'Championship', stages: champ });
    if (other.length) tracks.push({ id: other[0].stageKey, label: '', stages: other });
    if (!tracks.length) tracks.push({ id: 'main', label: '', stages: stagesAsc });
    return tracks;
  }

  function trackLabel(stages) {
    var keys = stages.map(function (s) {
      return s.stageKey;
    });
    var codes = [];
    stages.forEach(function (s) {
      (s.codes || []).forEach(function (c) {
        if (codes.indexOf(c) < 0) codes.push(c);
      });
    });
    if (
      keys.indexOf('PQ') >= 0 ||
      codes.indexOf('PQ') >= 0 ||
      keys.indexOf('PS') >= 0 ||
      codes.indexOf('PF') >= 0
    ) {
      return 'Plate';
    }
    if (keys.indexOf('CS') >= 0 || keys.indexOf('CF') >= 0 || codes.indexOf('CS') >= 0) {
      return 'Championship';
    }
    return '';
  }

  function maxMatchesInTrack(stages) {
    var max = 1;
    stages.forEach(function (s) {
      max = Math.max(max, s.matches.length);
    });
    return max;
  }

  function findMatchIndexByRoundCode(stage, roundCode) {
    var code = String(roundCode || '').trim();
    if (!code || !stage || !stage.matches) return -1;
    for (var i = 0; i < stage.matches.length; i++) {
      if (String(stage.matches[i]['Game Week'] || '').trim() === code) return i;
    }
    return -1;
  }

  /** Links from prior-stage matches to winner-of slots in the next stage. */
  function buildFeederLinks(leftStage, rightStage) {
    var links = [];
    if (!rightStage || !leftStage) return links;

    rightStage.matches.forEach(function (rm, rightIdx) {
      [['playerAId', 'a'], ['playerBId', 'b']].forEach(function (pair) {
        var pid = rm[pair[0]];
        if (
          typeof KnockoutRounds === 'undefined' ||
          !KnockoutRounds.isWinnerOfPlayerId(pid)
        ) {
          return;
        }
        var refCode = KnockoutRounds.roundCodeFromWinnerOfId(pid);
        var leftIdx = findMatchIndexByRoundCode(leftStage, refCode);
        if (leftIdx < 0) return;
        links.push({
          leftIdx: leftIdx,
          rightIdx: rightIdx,
          rightSlot: pair[1],
        });
      });
    });
    return links;
  }

  /** Standard bracket pairing with alternating a/b slots per right-side match. */
  function buildConventionLinks(leftStage, rightStage) {
    var links = [];
    var leftCount = leftStage.matches.length;
    var rightCount = rightStage.matches.length;
    if (!leftCount || !rightCount) return links;

    for (var r = 0; r < rightCount; r++) {
      var leftStart = Math.floor((r * leftCount) / rightCount);
      var leftEnd = Math.floor(((r + 1) * leftCount) / rightCount) - 1;
      var slotIdx = 0;
      for (var l = leftStart; l <= leftEnd; l++) {
        links.push({
          leftIdx: l,
          rightIdx: r,
          rightSlot: slotIdx === 0 ? 'a' : 'b',
        });
        slotIdx++;
      }
    }
    return links;
  }

  /** Link prior-round matches when a player is placed directly in the next round. */
  function appendSharedPlayerLinks(leftStage, rightStage, links, linkedLeft) {
    leftStage.matches.forEach(function (lm, leftIdx) {
      if (linkedLeft[leftIdx]) return;

      var leftIds = {};
      var leftNames = {};
      [lm.playerAId, lm.playerBId].forEach(function (id) {
        if (id) leftIds[String(id)] = true;
      });
      [lm['Player A'], lm['Player B']].forEach(function (name) {
        if (name) leftNames[String(name).trim()] = true;
      });

      rightStage.matches.forEach(function (rm, rightIdx) {
        if (linkedLeft[leftIdx]) return;
        [
          { key: 'playerAId', slot: 'a', nameKey: 'Player A' },
          { key: 'playerBId', slot: 'b', nameKey: 'Player B' },
        ].forEach(function (pair) {
          if (linkedLeft[leftIdx]) return;
          var pid = rm[pair.key];
          if (
            typeof KnockoutRounds !== 'undefined' &&
            KnockoutRounds.isWinnerOfPlayerId(pid)
          ) {
            return;
          }
          var pname = String(rm[pair.nameKey] || '').trim();
          if (
            (pid && leftIds[String(pid)]) ||
            (pname && leftNames[pname])
          ) {
            links.push({ leftIdx: leftIdx, rightIdx: rightIdx, rightSlot: pair.slot });
            linkedLeft[leftIdx] = true;
          }
        });
      });
    });
  }

  function buildLinks(leftStage, rightStage) {
    var links = buildFeederLinks(leftStage, rightStage);
    var linkedLeft = {};
    links.forEach(function (link) {
      linkedLeft[link.leftIdx] = true;
    });

    appendSharedPlayerLinks(leftStage, rightStage, links, linkedLeft);

    buildConventionLinks(leftStage, rightStage).forEach(function (link) {
      if (!linkedLeft[link.leftIdx]) {
        links.push(link);
        linkedLeft[link.leftIdx] = true;
      }
    });

    return links;
  }

  function pathD(yLeft, yRight) {
    var yL = Math.max(3, Math.min(97, yLeft));
    var yR = Math.max(3, Math.min(97, yRight));
    return 'M0,' + yL + ' H12 V' + yR + ' H32';
  }

  function renderMatchCard(match, winnersByCode, winnerIdsByCode) {
    var card = document.createElement('article');
    card.className = 'ko-bracket-match';
    var code = String(match['Game Week'] || '').trim();
    if (code) card.setAttribute('data-round-code', code);

    var sc = parseScores(match);
    var matchDate = match['Match Date'] || '';
    [
      { slot: 'a', score: sc.scoreA, win: sc.hasResult && sc.scoreA > sc.scoreB },
      { slot: 'b', score: sc.scoreB, win: sc.hasResult && sc.scoreB > sc.scoreA },
    ].forEach(function (row) {
      var displayName =
        typeof KnockoutRounds !== 'undefined' && KnockoutRounds.resolvedPlayerName
          ? KnockoutRounds.resolvedPlayerName(match, row.slot, winnersByCode)
          : row.slot === 'a'
            ? match['Player A'] || 'TBD'
            : match['Player B'] || 'TBD';
      var playerId = '';
      if (typeof KnockoutRounds !== 'undefined' && KnockoutRounds.resolvedPlayerId) {
        playerId = KnockoutRounds.resolvedPlayerId(match, row.slot, winnerIdsByCode) || '';
      } else {
        playerId = String(
          (row.slot === 'a' ? match.playerAId : match.playerBId) || ''
        ).trim();
      }
      if (
        playerId &&
        typeof KnockoutRounds !== 'undefined' &&
        KnockoutRounds.isWinnerOfPlayerId &&
        KnockoutRounds.isWinnerOfPlayerId(playerId)
      ) {
        playerId = '';
      }

      var line = document.createElement('div');
      line.className = 'ko-bracket-match__row';
      if (row.win) line.classList.add('ko-bracket-match__row--winner');

      var nameEl = document.createElement('span');
      nameEl.className = 'ko-bracket-match__name';
      nameEl.textContent = displayName;
      nameEl.setAttribute('data-match-date', matchDate);

      if (playerId) {
        nameEl.setAttribute('data-player-id', playerId);
        nameEl.classList.add('ko-bracket-match__name--interactive');
        nameEl.setAttribute('role', 'button');
        nameEl.setAttribute('tabindex', '0');
        nameEl.setAttribute('aria-label', 'Show handicap for ' + displayName);
        function onActivate(e) {
          e.preventDefault();
          e.stopPropagation();
          if (
            typeof FixturesPage !== 'undefined' &&
            FixturesPage.showPlayerHandicapBrief
          ) {
            FixturesPage.showPlayerHandicapBrief(nameEl, playerId, matchDate);
          }
        }
        nameEl.addEventListener('click', onActivate);
        nameEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') onActivate(e);
        });
      }

      var score = document.createElement('span');
      score.className = 'ko-bracket-match__score';
      score.textContent =
        sc.hasResult && row.score != null ? String(row.score) : '–';
      if (!sc.hasResult) score.setAttribute('aria-hidden', 'true');

      line.appendChild(nameEl);
      line.appendChild(score);
      card.appendChild(line);
    });

    return card;
  }

  function renderStageColumn(stage, layoutSlots, winnersByCode, winnerIdsByCode) {
    var col = document.createElement('div');
    col.className = 'ko-bracket-stage';
    col.setAttribute('data-stage', stage.stageKey);

    var head = document.createElement('div');
    head.className = 'ko-bracket-stage__head';
    head.textContent = stage.label || stage.stageKey;

    var list = document.createElement('div');
    list.className = 'ko-bracket-stage__list';

    stage.matches.forEach(function (match) {
      list.appendChild(renderMatchCard(match, winnersByCode, winnerIdsByCode));
    });

    var arena = document.createElement('div');
    arena.className = 'ko-bracket-stage__arena';
    arena.style.setProperty('--ko-layout-slots', String(layoutSlots));
    arena.appendChild(list);

    col.appendChild(head);
    col.appendChild(arena);
    return col;
  }

  function renderConnector(leftStage, rightStage, layoutSlots) {
    var col = document.createElement('div');
    col.className = 'ko-bracket-connector';
    col.setAttribute('aria-hidden', 'true');

    var arena = document.createElement('div');
    arena.className = 'ko-bracket-connector__arena';
    arena.style.setProperty('--ko-layout-slots', String(layoutSlots));

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'ko-bracket-connector__svg');
    svg.setAttribute('viewBox', '0 0 32 100');
    svg.setAttribute('preserveAspectRatio', 'none');

    var links = buildLinks(leftStage, rightStage);

    links.forEach(function (link) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#169179');
      path.setAttribute('stroke-width', '1.75');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('vector-effect', 'non-scaling-stroke');
      path.setAttribute('data-left-idx', String(link.leftIdx));
      path.setAttribute('data-right-idx', String(link.rightIdx));
      path.setAttribute('data-right-slot', link.rightSlot);
      path.setAttribute('d', 'M0,50 H12 V50 H32');
      svg.appendChild(path);
    });

    arena.appendChild(svg);
    col.appendChild(arena);
    return col;
  }

  function matchRowForSlot(matchEl, slot) {
    if (!matchEl) return null;
    var rows = matchEl.querySelectorAll('.ko-bracket-match__row');
    if (!rows.length) return matchEl;
    return slot === 'b' ? rows[rows.length - 1] : rows[0];
  }

  function linkAnchorEl(side, matchEl, slot) {
    if (side === 'left') return matchEl;
    var row = matchRowForSlot(matchEl, slot);
    if (!row) return matchEl;
    return row.querySelector('.ko-bracket-match__name') || row;
  }

  function yPercentInRect(el, refTop, refHeight) {
    if (!el || refHeight < 1) return 50;
    var r = el.getBoundingClientRect();
    var y = ((r.top + r.height / 2) - refTop) / refHeight * 100;
    return Math.max(3, Math.min(97, y));
  }

  function sharedVerticalMetrics(leftCol, rightCol, connArena) {
    var leftArena = leftCol.querySelector('.ko-bracket-stage__arena');
    var rightArena = rightCol.querySelector('.ko-bracket-stage__arena');
    var leftRect = leftArena ? leftArena.getBoundingClientRect() : null;
    var rightRect = rightArena ? rightArena.getBoundingClientRect() : null;
    var connRect = connArena ? connArena.getBoundingClientRect() : null;

    var refTop = Infinity;
    var refHeight = 0;
    [leftRect, rightRect, connRect].forEach(function (rect) {
      if (!rect || rect.height < 1) return;
      refTop = Math.min(refTop, rect.top);
      refHeight = Math.max(refHeight, rect.height);
    });

    if (!Number.isFinite(refTop) || refHeight < 1) {
      return null;
    }
    return { refTop: refTop, refHeight: refHeight };
  }

  function updateConnectorPaths(scrollTrack) {
    var connectors = scrollTrack.querySelectorAll('.ko-bracket-connector');
    connectors.forEach(function (conn) {
      var leftCol = conn.previousElementSibling;
      var rightCol = conn.nextElementSibling;
      var connArena = conn.querySelector('.ko-bracket-connector__arena');
      var svg = conn.querySelector('.ko-bracket-connector__svg');
      if (
        !leftCol ||
        !rightCol ||
        !connArena ||
        !svg ||
        !leftCol.classList.contains('ko-bracket-stage') ||
        !rightCol.classList.contains('ko-bracket-stage')
      ) {
        return;
      }

      var metrics = sharedVerticalMetrics(leftCol, rightCol, connArena);
      if (!metrics) return;

      var leftMatches = leftCol.querySelectorAll('.ko-bracket-match');
      var rightMatches = rightCol.querySelectorAll('.ko-bracket-match');

      svg.querySelectorAll('path').forEach(function (path) {
        var leftIdx = parseInt(path.getAttribute('data-left-idx'), 10);
        var rightIdx = parseInt(path.getAttribute('data-right-idx'), 10);
        var slot = path.getAttribute('data-right-slot') || 'a';
        var leftCard = leftMatches[leftIdx];
        var rightCard = rightMatches[rightIdx];
        if (!leftCard || !rightCard) return;

        var yL = yPercentInRect(
          linkAnchorEl('left', leftCard, slot),
          metrics.refTop,
          metrics.refHeight
        );
        var yR = yPercentInRect(
          linkAnchorEl('right', rightCard, slot),
          metrics.refTop,
          metrics.refHeight
        );
        path.setAttribute('d', pathD(yL, yR));
      });
    });
  }

  function syncConnectorHeights(scrollTrack) {
    var stages = scrollTrack.querySelectorAll('.ko-bracket-stage');
    var connectors = scrollTrack.querySelectorAll('.ko-bracket-connector');
    var maxH = 0;
    stages.forEach(function (col) {
      var arena = col.querySelector('.ko-bracket-stage__arena');
      if (arena) maxH = Math.max(maxH, arena.offsetHeight);
    });
    if (maxH < 1) return;
    stages.forEach(function (col) {
      var arena = col.querySelector('.ko-bracket-stage__arena');
      if (arena) arena.style.minHeight = maxH + 'px';
    });
    connectors.forEach(function (col) {
      var arena = col.querySelector('.ko-bracket-connector__arena');
      if (arena) arena.style.minHeight = maxH + 'px';
    });
  }

  function bindScroll(block, viewport, scrollTrack, stages, stageTitleEl) {
    var prev = block.querySelector('.ko-bracket-shell__arrow--prev');
    var next = block.querySelector('.ko-bracket-shell__arrow--next');

    function setStageTitle(idx) {
      if (!stageTitleEl || !stages[idx]) return;
      stageTitleEl.textContent = stages[idx].label || stages[idx].stageKey || '';
    }

    function columns() {
      return scrollTrack.querySelectorAll('.ko-bracket-stage');
    }

    function activeIndex() {
      var cols = columns();
      if (!cols.length) return 0;
      var vpRect = viewport.getBoundingClientRect();
      var center = vpRect.left + vpRect.width / 2;
      var best = 0;
      var bestDist = Infinity;
      cols.forEach(function (col, idx) {
        var r = col.getBoundingClientRect();
        var c = r.left + r.width / 2;
        var d = Math.abs(c - center);
        if (d < bestDist) {
          bestDist = d;
          best = idx;
        }
      });
      return best;
    }

    function scrollToStage(idx, smooth) {
      var cols = columns();
      if (!cols.length) return;
      var i = Math.max(0, Math.min(idx, cols.length - 1));
      var col = cols[i];
      var left = col.offsetLeft - (viewport.clientWidth - col.offsetWidth) / 2;
      viewport.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
      updateUi(i);
    }

    function updateUi(idx) {
      var count = columns().length;
      setStageTitle(idx);
      if (prev) {
        var showPrev = count > 1 && idx > 0;
        prev.classList.toggle('is-unavailable', !showPrev);
        prev.disabled = !showPrev;
        prev.setAttribute('aria-hidden', showPrev ? 'false' : 'true');
      }
      if (next) {
        var showNext = count > 1 && idx < count - 1;
        next.classList.toggle('is-unavailable', !showNext);
        next.disabled = !showNext;
        next.setAttribute('aria-hidden', showNext ? 'false' : 'true');
      }
    }

    var scrollTimer;
    viewport.addEventListener(
      'scroll',
      function () {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(function () {
          updateUi(activeIndex());
        }, 80);
      },
      { passive: true }
    );

    if (prev) {
      prev.addEventListener('click', function () {
        scrollToStage(activeIndex() - 1, true);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        scrollToStage(activeIndex() + 1, true);
      });
    }

    scrollToStage(0, false);
  }

  function renderTrack(track, root, winnersByCode, winnerIdsByCode, trackOptions) {
    trackOptions = trackOptions || {};
    var block = document.createElement('section');
    block.className = 'ko-bracket-track-block';
    if (trackOptions.stageNav !== false) {
      block.classList.add('ko-bracket-track-block--stage-nav');
    }

    if (trackOptions.trackLabel) {
      var trackTitle = document.createElement('h3');
      trackTitle.className = 'ko-bracket-track-block__title align-center';
      trackTitle.textContent = trackOptions.trackLabel;
      block.appendChild(trackTitle);
    }

    var prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'ko-bracket-shell__arrow ko-bracket-shell__arrow--prev';
    prevBtn.setAttribute('aria-label', 'Earlier stage');
    prevBtn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6L8 12L14 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'ko-bracket-shell__arrow ko-bracket-shell__arrow--next';
    nextBtn.setAttribute('aria-label', 'Later stage');
    nextBtn.innerHTML =
      '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6L16 12L10 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    var layoutSlots = maxMatchesInTrack(track.stages);
    var stages = track.stages;
    var stageTitleEl = null;

    if (trackOptions.stageNav !== false && stages.length) {
      var headerRow = document.createElement('div');
      headerRow.className = 'ko-bracket-stage-nav';
      stageTitleEl = document.createElement('div');
      stageTitleEl.className = 'ko-bracket-stage-nav__title align-center';
      stageTitleEl.textContent = stages[0].label || stages[0].stageKey || '';
      headerRow.appendChild(prevBtn);
      headerRow.appendChild(stageTitleEl);
      headerRow.appendChild(nextBtn);
      block.appendChild(headerRow);
    }

    var shell = document.createElement('div');
    shell.className = 'ko-bracket-shell';

    var viewport = document.createElement('div');
    viewport.className = 'ko-bracket-shell__viewport';
    viewport.setAttribute('tabindex', '0');

    var scrollTrack = document.createElement('div');
    scrollTrack.className = 'ko-bracket-shell__track';

    stages.forEach(function (stage, idx) {
      if (idx > 0) {
        scrollTrack.appendChild(renderConnector(stages[idx - 1], stage, layoutSlots));
      }
      scrollTrack.appendChild(renderStageColumn(stage, layoutSlots, winnersByCode, winnerIdsByCode));
    });

    viewport.appendChild(scrollTrack);

    shell.appendChild(viewport);
    block.appendChild(shell);
    root.appendChild(block);

    function layoutConnectors() {
      syncConnectorHeights(scrollTrack);
      updateConnectorPaths(scrollTrack);
    }

    function scheduleLayoutConnectors() {
      layoutConnectors();
      requestAnimationFrame(function () {
        requestAnimationFrame(layoutConnectors);
      });
      [50, 150, 400].forEach(function (delay) {
        setTimeout(layoutConnectors, delay);
      });
    }

    scheduleLayoutConnectors();

    if (!scrollTrack._koResizeBound) {
      scrollTrack._koResizeBound = true;
      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(layoutConnectors, 120);
      });

      if (typeof ResizeObserver !== 'undefined') {
        var layoutTimer;
        var ro = new ResizeObserver(function () {
          clearTimeout(layoutTimer);
          layoutTimer = setTimeout(layoutConnectors, 16);
        });
        ro.observe(scrollTrack);
        scrollTrack.querySelectorAll('.ko-bracket-stage__arena, .ko-bracket-connector__arena').forEach(
          function (el) {
            ro.observe(el);
          }
        );
        scrollTrack._koResizeObserver = ro;
      }
    }

    scrollTrack._koLayoutConnectors = layoutConnectors;

    bindScroll(block, viewport, scrollTrack, stages, stageTitleEl);
  }

  return {
    relayout: function (root) {
      if (!root) return;
      root.querySelectorAll('.ko-bracket-shell__track').forEach(function (track) {
        if (typeof track._koLayoutConnectors === 'function') {
          track._koLayoutConnectors();
        } else {
          syncConnectorHeights(track);
          updateConnectorPaths(track);
        }
      });
    },

    render: function (root, fixtures, options) {
      if (!root) return;
      root.innerHTML = '';
      options = options || {};

      var stages =
        typeof KnockoutRounds !== 'undefined' && KnockoutRounds.groupFixturesByStage
          ? KnockoutRounds.groupFixturesByStage(fixtures, false)
          : [];

      if (!stages.length) {
        root.innerHTML = '<p class="align-center"><em>No knockout fixtures yet.</em></p>';
        return;
      }

      var winnersByCode =
        typeof KnockoutRounds !== 'undefined' && KnockoutRounds.buildRoundWinnersMap
          ? KnockoutRounds.buildRoundWinnersMap(fixtures)
          : {};
      var winnerIdsByCode =
        typeof KnockoutRounds !== 'undefined' && KnockoutRounds.buildRoundWinnerIdsMap
          ? KnockoutRounds.buildRoundWinnerIdsMap(fixtures)
          : {};

      var stageNav = options.stageNav !== false;

      buildTracks(stages).forEach(function (track) {
        renderTrack(track, root, winnersByCode, winnerIdsByCode, {
          stageNav: stageNav,
          trackLabel: track.label || '',
        });
      });
    },
  };
})();
