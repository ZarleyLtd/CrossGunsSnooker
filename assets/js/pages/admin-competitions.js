// Admin — comps list + groups/rosters in comp dialog (season API, Comp labels).

var AdminCompetitionsPage = (function () {
  var KNOCKOUT_GROUP_ID = 'ko';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function typeLabel(t) {
    return t === 'knockout' ? 'Knockout' : 'League';
  }

  function normalizeCompetitionType(compOrType) {
    if (!compOrType) return 'league';
    if (typeof compOrType === 'string') {
      return compOrType.toLowerCase() === 'knockout' ? 'knockout' : 'league';
    }
    var raw = compOrType.competitionType || compOrType.competition_type || 'league';
    return String(raw).toLowerCase() === 'knockout' ? 'knockout' : 'league';
  }

  function compIdOf(c) {
    return c ? String(c.compId || c.seasonId || '') : '';
  }

  function parentCompIdOf(c) {
    if (!c) return '';
    return String(c.parentCompId || c.parentSeasonId || '');
  }

  function playerLeague(entry) {
    if (!entry) return '';
    return entry.league != null ? entry.league : entry.leagueId || entry.groupId || entry.group;
  }

  function seq(steps) {
    return steps.reduce(function (chain, fn) {
      return chain.then(fn);
    }, Promise.resolve());
  }

  function qsCompId() {
    try {
      var p = new URL(window.location.href).searchParams;
      return p.get('compId') || p.get('seasonId') || '';
    } catch (_e) {
      return '';
    }
  }

  function slugifyCompId(name) {
    var s = String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s || 'comp';
  }

  function uniqueCompId(base, competitions) {
    var id = base;
    var n = 2;
    while (
      (competitions || []).some(function (c) {
        return compIdOf(c) === id;
      })
    ) {
      id = base + '-' + n;
      n += 1;
    }
    return id;
  }

  var self = {
    competitions: [],
    editing: null,
    activeCompId: null,
    groups: [],
    roster: [],
    allPlayers: [],
    editingGroup: null,
    editSessionId: 0,
    el: {},

    isKnockoutType: function () {
      return self.el.cType && self.el.cType.value === 'knockout';
    },

    isLeagueType: function () {
      return !self.isKnockoutType();
    },

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el = {
        gate: document.getElementById('adminCompGate'),
        panel: document.getElementById('adminCompPanel'),
        msg: document.getElementById('adminCompMsg'),
        list: document.getElementById('adminCompList'),
        addBtn: document.getElementById('adminCompAddBtn'),
        modal: document.getElementById('adminCompModal'),
        modalTitle: document.getElementById('adminCompModalTitle'),
        modalClose: document.getElementById('adminCompModalClose'),
        modalMsg: document.getElementById('adminCompModalMsg'),
        modalCancel: document.getElementById('adminCompModalCancel'),
        form: document.getElementById('adminCompForm'),
        cName: document.getElementById('adminCompName'),
        cType: document.getElementById('adminCompType'),
        cCur: document.getElementById('adminCompCurrent'),
        cDelete: document.getElementById('adminCompDelete'),
        cSave: document.getElementById('adminCompSave'),
        deleteLeft: document.querySelector('#adminCompForm .admin-form-actions__left'),
        manageSection: document.getElementById('adminCompManageSection'),
        saveFirstHint: document.getElementById('adminCompSaveFirstHint'),
        leagueSection: document.getElementById('adminCompLeagueSection'),
        knockoutSection: document.getElementById('adminCompKnockoutSection'),
        knockoutStagesSection: document.getElementById('adminCompKnockoutStagesSection'),
        knockoutStagesList: document.getElementById('adminCompKnockoutStagesList'),
        addKnockout: document.getElementById('adminCompAddKnockout'),
        groupsList: document.getElementById('adminCompGroupsList'),
        addGroup: document.getElementById('adminCompAddGroup'),
        knockoutPlayers: document.getElementById('adminCompKnockoutPlayers'),
        knockoutLinkHint: document.getElementById('adminCompKnockoutLinkHint'),
        knockoutUnlinkRow: document.getElementById('adminCompKnockoutUnlinkRow'),
        unlinkKnockout: document.getElementById('adminCompUnlinkKnockout'),
        koLinkModal: document.getElementById('adminCompKoLinkModal'),
        koLinkModalMsg: document.getElementById('adminCompKoLinkModalMsg'),
        koLinkChoose: document.getElementById('adminCompKoLinkChoose'),
        koLinkExistingPanel: document.getElementById('adminCompKoLinkExistingPanel'),
        koLinkNewPanel: document.getElementById('adminCompKoLinkNewPanel'),
        koLinkExistingBtn: document.getElementById('adminCompKoLinkExistingBtn'),
        koLinkNewBtn: document.getElementById('adminCompKoLinkNewBtn'),
        koLinkSelect: document.getElementById('adminCompKoLinkSelect'),
        koLinkConfirm: document.getElementById('adminCompKoLinkConfirm'),
        koNewName: document.getElementById('adminCompKoNewName'),
        koNewId: document.getElementById('adminCompKoNewId'),
        koNewPlayers: document.getElementById('adminCompKoNewPlayers'),
        koNewCreate: document.getElementById('adminCompKoNewCreate'),
        groupModal: document.getElementById('adminCompGroupModal'),
        groupModalMsg: document.getElementById('adminCompGroupModalMsg'),
        groupForm: document.getElementById('adminCompGroupForm'),
        groupModalTitle: document.getElementById('adminCompGroupModalTitle'),
        groupId: document.getElementById('adminCompGroupId'),
        groupName: document.getElementById('adminCompGroupName'),
        groupOrder: document.getElementById('adminCompGroupOrder'),
        groupPlayers: document.getElementById('adminCompGroupPlayers'),
        groupDelete: document.getElementById('adminCompGroupDelete'),
        groupSave: document.getElementById('adminCompGroupSave'),
        groupActionsLeft: document.querySelector('#adminCompGroupForm .admin-form-actions__left'),
      };
    },

    flashTarget: function () {
      if (this.el.koLinkModal && this.el.koLinkModal.classList.contains('is-open') && this.el.koLinkModalMsg) {
        return this.el.koLinkModalMsg;
      }
      if (this.el.groupModal && this.el.groupModal.classList.contains('is-open') && this.el.groupModalMsg) {
        return this.el.groupModalMsg;
      }
      if (this.el.modal && this.el.modal.classList.contains('is-open') && this.el.modalMsg) {
        return this.el.modalMsg;
      }
      return this.el.msg;
    },

    flash: function (text, isErr) {
      var el = this.flashTarget();
      if (!el) return;
      el.textContent = text || '';
      el.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      el.hidden = !text;
      if (el !== this.el.msg && this.el.msg) {
        this.el.msg.hidden = true;
      }
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (ok) {
        var me = this;
        this.loadCompetitions().then(function () {
          var openId = qsCompId();
          if (openId) {
            var c = me.competitions.find(function (x) {
              return compIdOf(x) === openId;
            });
            if (c) me.openEdit(c);
          }
        });
      }
    },

    loadCompetitions: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return Promise.resolve();
      return ApiClient.get({ action: 'getSeasons' })
        .then(function (r) {
          me.competitions = r.seasons || r.competitions || [];
          me.renderList();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    loadCompDetail: function (compId, sessionId) {
      var me = this;
      if (!compId) return Promise.resolve();
      return Promise.all([
        ApiClient.get({ action: 'getSeasonGroups', seasonId: compId }),
        ApiClient.get({ action: 'getPlayers', season: compId }),
        ApiClient.get({ action: 'getPlayers' }),
      ]).then(function (rs) {
        me.groups = rs[0].groups || [];
        me.roster = rs[1].players || [];
        me.allPlayers = rs[2].players || [];
        var seasonMeta = rs[0].season || rs[0].competition;
        if (seasonMeta && (sessionId === undefined || sessionId === me.editSessionId)) {
          me.applyCompMeta(seasonMeta);
        }
        me.renderGroups();
        me.renderKnockoutPlayers();
        me.renderKnockoutStages();
        me.updateCompDeleteButton();
      });
    },

    childKnockoutComps: function () {
      var parentId = this.activeCompId;
      if (!parentId) return [];
      return (this.competitions || []).filter(function (c) {
        if (normalizeCompetitionType(c) !== 'knockout') return false;
        return String(parentCompIdOf(c)) === String(parentId);
      });
    },

    linkedKnockoutComp: function () {
      var linked = this.childKnockoutComps();
      return linked.length ? linked[0] : null;
    },

    linkableKnockoutComps: function () {
      var parentId = String(this.activeCompId || '');
      return (this.competitions || []).filter(function (c) {
        if (normalizeCompetitionType(c) !== 'knockout') return false;
        if (compIdOf(c) === parentId) return false;
        return !String(parentCompIdOf(c)).trim();
      });
    },

    leaguePlayersForPick: function () {
      var seen = {};
      var list = [];
      (this.roster || []).forEach(function (r) {
        var id = r && r.playerId;
        if (!id || seen[id]) return;
        seen[id] = true;
        var global = (self.allPlayers || []).find(function (p) {
          return p.playerId === id;
        });
        list.push({
          playerId: id,
          playerName: (global && global.playerName) || r.playerName || id,
        });
      });
      list.sort(function (a, b) {
        return String(a.playerName || '').localeCompare(String(b.playerName || ''), undefined, {
          sensitivity: 'base',
        });
      });
      return list;
    },

    updateAddKnockoutButton: function () {
      if (!this.el.addKnockout) return;
      this.el.addKnockout.hidden = !!(this.isLeagueType() && this.activeCompId && this.linkedKnockoutComp());
    },

    leagueNameForId: function (seasonId) {
      var c = (this.competitions || []).find(function (x) {
        return compIdOf(x) === seasonId;
      });
      return c ? c.name || seasonId : seasonId;
    },

    updateKnockoutLinkUi: function () {
      var hint = this.el.knockoutLinkHint;
      var row = this.el.knockoutUnlinkRow;
      if (!hint && !row) return;
      var parentId = this.editing ? parentCompIdOf(this.editing) : '';
      var show = this.isKnockoutType() && !!parentId && !!this.activeCompId;
      if (hint) {
        hint.hidden = !show;
        hint.textContent = show
          ? 'Linked to league comp: ' + this.leagueNameForId(parentId) + '.'
          : '';
      }
      if (row) row.hidden = !show;
    },

    renderKnockoutStages: function () {
      var box = this.el.knockoutStagesList;
      var section = this.el.knockoutStagesSection;
      if (!box || !section) return;
      if (!this.isLeagueType() || !this.activeCompId) {
        section.hidden = true;
        this.updateAddKnockoutButton();
        return;
      }
      section.hidden = false;
      var linked = this.linkedKnockoutComp();
      var me = this;
      this.updateAddKnockoutButton();
      if (!linked) {
        box.innerHTML = '<p class="admin-player-picks__hint">No knockout stage linked yet.</p>';
        return;
      }
      box.innerHTML = [linked]
        .map(function (c) {
          var id = compIdOf(c);
          var current = c.isCurrent ? ' admin-item-list__row--current' : '';
          return (
            '<div class="admin-hc-list__row">' +
            '<button type="button" class="admin-player-picks__row admin-item-list__row admin-hc-list__main' +
            current +
            '" data-id="' +
            esc(id) +
            '">' +
            '<span class="admin-player-picks__name">' +
            esc(c.name || id) +
            '</span>' +
            '<span class="admin-item-list__meta">' +
            esc(typeLabel(normalizeCompetitionType(c))) +
            '</span></button>' +
            '<button type="button" class="btn btn-secondary admin-hc-list__side" data-unlink-ko="' +
            esc(id) +
            '">Unlink</button>' +
            '</div>'
          );
        })
        .join('');
      box.querySelectorAll('.admin-hc-list__main').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var child = me.competitions.find(function (x) {
            return compIdOf(x) === id;
          });
          if (child) me.openEdit(child);
        });
      });
      box.querySelectorAll('[data-unlink-ko]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          me.unlinkKnockoutStage(btn.getAttribute('data-unlink-ko'));
        });
      });
    },

    unlinkKnockoutStage: function (koCompId) {
      var me = this;
      var id = String(koCompId || '').trim();
      if (!id) return;
      var child = (me.competitions || []).find(function (c) {
        return compIdOf(c) === id;
      });
      if (!child || !parentCompIdOf(child)) return;
      var label = child.name || id;
      if (
        !window.confirm(
          'Unlink "' +
            label +
            '" from its league comp? It will become a standalone knockout comp.'
        )
      ) {
        return;
      }
      if (me.el.unlinkKnockout) me.el.unlinkKnockout.disabled = true;
      ApiClient.post('upsertSeason', {
        seasonId: id,
        name: child.name || id,
        competitionType: 'knockout',
        parentSeasonId: '',
        isCurrent: !!child.isCurrent,
      })
        .then(function () {
          me.flash('Knockout comp unlinked.', false);
          return me.loadCompetitions();
        })
        .then(function () {
          if (me.activeCompId && me.isLeagueType()) {
            me.renderKnockoutStages();
            return;
          }
          var updated = me.competitions.find(function (c) {
            return compIdOf(c) === id;
          });
          if (updated) {
            me.editing = updated;
            me.updateKnockoutLinkUi();
            me.updateCompTypeField();
          }
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.unlinkKnockout) me.el.unlinkKnockout.disabled = false;
        });
    },

    showKoLinkPanel: function (panel) {
      var choose = panel === 'choose';
      var existing = panel === 'existing';
      var isNew = panel === 'new';
      if (this.el.koLinkChoose) this.el.koLinkChoose.hidden = !choose;
      if (this.el.koLinkExistingPanel) this.el.koLinkExistingPanel.hidden = !existing;
      if (this.el.koLinkNewPanel) this.el.koLinkNewPanel.hidden = !isNew;
      if (this.el.koLinkModalMsg) this.el.koLinkModalMsg.hidden = true;
    },

    closeKoLinkModal: function () {
      if (!this.el.koLinkModal) return;
      this.el.koLinkModal.classList.remove('is-open');
      this.el.koLinkModal.hidden = true;
      if (this.el.koLinkModalMsg) this.el.koLinkModalMsg.hidden = true;
    },

    openKoLinkModal: function () {
      var me = this;
      if (me.linkedKnockoutComp()) return;
      if (!me.activeCompId || !me.isLeagueType()) return;
      var parentName = (me.el.cName && me.el.cName.value.trim()) || '';
      if (!parentName) {
        me.flash('Enter a league comp name before adding a knockout stage.', true);
        return;
      }
      var defaultId = me.activeCompId + '-ko';
      var taken = (me.competitions || []).some(function (c) {
        return compIdOf(c) === defaultId;
      });
      if (me.el.koNewName) me.el.koNewName.value = parentName + ' Knockout';
      if (me.el.koNewId) {
        me.el.koNewId.value = taken ? uniqueCompId(defaultId, me.competitions) : defaultId;
      }
      me.fillKoNewPlayerCheckboxes();
      me.populateKoLinkSelect();
      var linkable = me.linkableKnockoutComps();
      if (me.el.koLinkExistingBtn) {
        me.el.koLinkExistingBtn.disabled = !linkable.length;
      }
      me.showKoLinkPanel('choose');
      if (me.el.koLinkModal) {
        me.el.koLinkModal.hidden = false;
        me.el.koLinkModal.classList.add('is-open');
      }
    },

    populateKoLinkSelect: function () {
      var sel = this.el.koLinkSelect;
      if (!sel) return;
      var list = this.linkableKnockoutComps();
      sel.innerHTML = '';
      if (!list.length) {
        var empty = document.createElement('option');
        empty.value = '';
        empty.textContent = 'No standalone knockout comps';
        sel.appendChild(empty);
        return;
      }
      list.forEach(function (c) {
        var o = document.createElement('option');
        o.value = compIdOf(c);
        o.textContent = c.name || compIdOf(c);
        sel.appendChild(o);
      });
    },

    fillKoNewPlayerCheckboxes: function () {
      if (!this.el.koNewPlayers) return;
      var players = this.leaguePlayersForPick();
      if (!players.length) {
        this.el.koNewPlayers.innerHTML =
          '<p class="admin-player-picks__hint" style="padding:0.75em;">No players on this league comp yet. Add players to groups first.</p>';
        return;
      }
      var allIds = players.map(function (p) {
        return p.playerId;
      });
      this.renderCheckboxList(this.el.koNewPlayers, players, allIds);
    },

    addKnockoutStage: function () {
      if (this.linkedKnockoutComp()) return;
      this.openKoLinkModal();
    },

    confirmLinkExistingKnockout: function () {
      var me = this;
      if (me.linkedKnockoutComp()) return;
      var parentId = me.activeCompId;
      if (!parentId) return;
      var koId = me.el.koLinkSelect && me.el.koLinkSelect.value;
      if (!koId) {
        me.flash('Select a knockout comp to link.', true);
        return;
      }
      var child = me.competitions.find(function (c) {
        return compIdOf(c) === koId;
      });
      if (!child || parentCompIdOf(child)) {
        me.flash('That knockout comp cannot be linked.', true);
        return;
      }
      if (me.el.koLinkConfirm) me.el.koLinkConfirm.disabled = true;
      me.persistCompHeader()
        .then(function () {
          return ApiClient.post('upsertSeason', {
            seasonId: koId,
            name: child.name || koId,
            competitionType: 'knockout',
            parentSeasonId: parentId,
            isCurrent: !!child.isCurrent,
          });
        })
        .then(function () {
          me.closeKoLinkModal();
          me.flash('Knockout comp linked.', false);
          return me.loadCompetitions();
        })
        .then(function () {
          return me.loadCompDetail(parentId);
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.koLinkConfirm) me.el.koLinkConfirm.disabled = false;
          me.updateAddKnockoutButton();
        });
    },

    confirmCreateNewKnockout: function () {
      var me = this;
      if (me.linkedKnockoutComp()) return;
      var parentId = me.activeCompId;
      if (!parentId) return;
      var name = me.el.koNewName && me.el.koNewName.value.trim();
      if (!name) {
        me.flash('Enter a name for the knockout comp.', true);
        return;
      }
      var idRaw = me.el.koNewId && me.el.koNewId.value.trim();
      var koId = idRaw || parentId + '-ko';
      if (!/^[a-z0-9-]+$/.test(koId)) {
        me.flash('Comp id must use lowercase letters, numbers, and hyphens only.', true);
        return;
      }
      if (
        (me.competitions || []).some(function (c) {
          return compIdOf(c) === koId;
        })
      ) {
        me.flash('Comp id "' + koId + '" is already in use.', true);
        return;
      }
      var selected = me.getCheckedPlayerIds(me.el.koNewPlayers);
      if (me.el.koNewCreate) me.el.koNewCreate.disabled = true;
      me.persistCompHeader()
        .then(function () {
          return ApiClient.post('upsertSeason', {
            seasonId: koId,
            name: name,
            competitionType: 'knockout',
            parentSeasonId: parentId,
            isCurrent: false,
          });
        })
        .then(function () {
          return me.syncKnockoutRoster(koId, selected);
        })
        .then(function () {
          me.closeKoLinkModal();
          me.flash('Knockout comp created and linked.', false);
          return me.loadCompetitions();
        })
        .then(function () {
          return me.loadCompDetail(parentId);
        })
        .then(function () {
          var child = me.competitions.find(function (c) {
            return compIdOf(c) === koId;
          });
          if (child) me.openEdit(child);
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.koNewCreate) me.el.koNewCreate.disabled = false;
          me.updateAddKnockoutButton();
        });
    },

    renderActionList: function (container, items, options) {
      if (!container) return;
      var opts = options || {};
      if (!items.length) {
        container.innerHTML =
          '<p class="admin-player-picks__hint">' + esc(opts.emptyText || 'No items.') + '</p>' +
          (opts.emptyActionHtml || '');
        if (opts.onEmptyAction) {
          var actionBtn = container.querySelector('[data-empty-action]');
          if (actionBtn) {
            actionBtn.addEventListener('click', opts.onEmptyAction);
          }
        }
        return;
      }
      var me = this;
      container.innerHTML = items
        .map(function (item) {
          var current = item.isCurrent ? ' admin-item-list__row--current' : '';
          var warn = item.warn ? ' <span class="admin-item-list__warn">' + esc(item.warn) + '</span>' : '';
          return (
            '<button type="button" class="admin-player-picks__row admin-item-list__row' +
            current +
            '" data-id="' +
            esc(item.id) +
            '">' +
            '<span class="admin-player-picks__name">' +
            esc(item.name) +
            '</span>' +
            '<span class="admin-item-list__meta">' +
            esc(item.meta || '') +
            warn +
            '</span></button>'
          );
        })
        .join('');
      container.querySelectorAll('.admin-item-list__row').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          if (opts.onClick) opts.onClick(id);
        });
      });
    },

    renderList: function () {
      var box = this.el.list;
      if (!box) return;
      var me = this;
      if (!this.competitions.length) {
        this.renderActionList(box, [], {
          emptyText: 'No comps yet.',
          emptyActionHtml:
            '<p style="margin:0.75em 0 0;text-align:center;">' +
            '<button type="button" class="btn" data-empty-action>+ Add Comp</button></p>',
          onEmptyAction: function () {
            me.openCreate();
          },
        });
        return;
      }
      var items = this.competitions.map(function (c) {
        return {
          id: compIdOf(c),
          name: c.name,
          meta: typeLabel(normalizeCompetitionType(c)),
          isCurrent: !!c.isCurrent,
        };
      });
      this.renderActionList(box, items, {
        onClick: function (id) {
          var comp = me.competitions.find(function (x) {
            return compIdOf(x) === id;
          });
          if (comp) me.openEdit(comp);
        },
      });
    },

    applyManageUi: function () {
      var ko = this.isKnockoutType();
      if (this.el.leagueSection) this.el.leagueSection.hidden = ko;
      if (this.el.knockoutSection) this.el.knockoutSection.hidden = !ko;
      if (this.el.knockoutStagesSection) {
        this.el.knockoutStagesSection.hidden = ko || !this.activeCompId;
      }
      this.updateKnockoutLinkUi();
      this.updateAddKnockoutButton();
    },

    setManageVisible: function (visible) {
      if (this.el.manageSection) this.el.manageSection.hidden = !visible;
      if (this.el.saveFirstHint) this.el.saveFirstHint.hidden = visible;
    },

    applyCompMeta: function (comp) {
      if (!comp) return;
      var type = normalizeCompetitionType(comp);
      var compId = comp.compId || comp.seasonId || comp.season_id || this.activeCompId;
      if (this.el.cType) this.el.cType.value = type;
      if (this.editing) this.editing.competitionType = type;
      if (compId) {
        var idx = this.competitions.findIndex(function (x) {
          return compIdOf(x) === compId;
        });
        if (idx >= 0) this.competitions[idx].competitionType = type;
      }
      this.applyManageUi();
      this.updateCompTypeField();
    },

    resolveCompId: function (name) {
      if (this.activeCompId) return this.activeCompId;
      var base = slugifyCompId(name);
      if (!/^[a-z0-9-]+$/.test(base)) base = 'comp';
      return uniqueCompId(base, this.competitions);
    },

    persistCompHeader: function () {
      var me = this;
      var name = (me.el.cName && me.el.cName.value.trim()) || '';
      if (!name) {
        return Promise.reject(new Error('Name is required.'));
      }
      var id = me.resolveCompId(name);
      var competitionType = me.el.cType ? me.el.cType.value : 'league';
      var parentSeasonId =
        me.editing && (me.editing.parentSeasonId || me.editing.parentCompId)
          ? String(me.editing.parentSeasonId || me.editing.parentCompId)
          : null;
      return ApiClient.post('upsertSeason', {
        seasonId: id,
        name: name,
        isCurrent: me.el.cCur ? me.el.cCur.checked : false,
        competitionType: competitionType,
        parentSeasonId: parentSeasonId,
      }).then(function () {
        me.activeCompId = id;
        if (me.editing) me.editing.competitionType = competitionType;
        var c = me.competitions.find(function (x) {
          return compIdOf(x) === id;
        });
        if (c) c.competitionType = competitionType;
      });
    },

    compHasPlayers: function () {
      return (this.roster || []).length > 0;
    },

    updateCompDeleteButton: function () {
      var btn = this.el.cDelete;
      var left = this.el.deleteLeft;
      if (!btn) return;
      if (!this.activeCompId) {
        btn.hidden = true;
        if (left) left.hidden = true;
        return;
      }
      var hasPlayers = this.compHasPlayers();
      btn.hidden = hasPlayers;
      if (left) left.hidden = hasPlayers;
    },

    updateCompTypeField: function () {
      if (!this.el.cType) return;
      var hasPlayers = this.compHasPlayers();
      var hasParent = !!(this.editing && parentCompIdOf(this.editing));
      this.el.cType.disabled = (!!this.activeCompId && hasPlayers) || hasParent;
    },

    rosterEntry: function (playerId) {
      return (this.roster || []).find(function (r) {
        return r.playerId === playerId;
      });
    },

    eligibleForGroup: function (groupId) {
      var gid = groupId || '';
      return (this.allPlayers || []).filter(function (p) {
        var entry = self.rosterEntry(p.playerId);
        if (!entry) return true;
        if (gid && String(playerLeague(entry)) === String(gid)) return true;
        return false;
      });
    },

    sortPlayersForPick: function (players, checkedIds) {
      var checked = {};
      (checkedIds || []).forEach(function (id) {
        checked[id] = true;
      });
      var inGroup = [];
      var rest = [];
      (players || []).forEach(function (p) {
        if (checked[p.playerId]) inGroup.push(p);
        else rest.push(p);
      });
      var byName = function (a, b) {
        return String(a.playerName || '').localeCompare(String(b.playerName || ''), undefined, {
          sensitivity: 'base',
        });
      };
      inGroup.sort(byName);
      rest.sort(byName);
      return inGroup.concat(rest);
    },

    renderCheckboxList: function (container, players, checkedIds) {
      if (!container) return;
      var sorted = this.sortPlayersForPick(players, checkedIds);
      var checked = {};
      (checkedIds || []).forEach(function (id) {
        checked[id] = true;
      });
      if (!sorted.length) {
        container.innerHTML = '<p class="admin-player-picks__hint" style="padding:0.75em;">No players available.</p>';
        return;
      }
      container.innerHTML = sorted
        .map(function (p) {
          var isOn = !!checked[p.playerId];
          return (
            '<label class="admin-player-picks__row">' +
            '<span class="admin-player-picks__name">' +
            esc(p.playerName) +
            '</span>' +
            '<span class="admin-player-picks__check">' +
            '<input type="checkbox" name="compPlayer" value="' +
            esc(p.playerId) +
            '"' +
            (isOn ? ' checked' : '') +
            ' aria-label="' +
            esc(p.playerName) +
            '" />' +
            '</span></label>'
          );
        })
        .join('');
    },

    getCheckedPlayerIds: function (container) {
      if (!container) return [];
      return Array.prototype.map
        .call(container.querySelectorAll('input[type="checkbox"]:checked'), function (cb) {
          return cb.value;
        })
        .filter(Boolean);
    },

    syncKnockoutRoster: function (compId, selectedIds) {
      var me = this;
      var selected = {};
      selectedIds.forEach(function (id) {
        selected[id] = true;
      });
      var onComp = (me.roster || []).map(function (r) {
        return r.playerId;
      });
      var toRemove = onComp.filter(function (id) {
        return !selected[id];
      });
      var toAdd = selectedIds.filter(function (id) {
        var entry = me.rosterEntry(id);
        if (!entry) return true;
        return String(playerLeague(entry)) !== String(KNOCKOUT_GROUP_ID);
      });
      var steps = [];
      toAdd.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: compId,
            playerId: playerId,
            leagueId: KNOCKOUT_GROUP_ID,
          });
        });
      });
      toRemove.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: compId,
            playerId: playerId,
            remove: true,
          });
        });
      });
      return seq(steps);
    },

    syncGroupRoster: function (compId, groupId, selectedIds) {
      var me = this;
      var selected = {};
      selectedIds.forEach(function (id) {
        selected[id] = true;
      });
      var currentInGroup = (me.roster || [])
        .filter(function (r) {
          return String(playerLeague(r)) === String(groupId);
        })
        .map(function (r) {
          return r.playerId;
        });
      var toAdd = selectedIds.filter(function (id) {
        return currentInGroup.indexOf(id) < 0;
      });
      var toRemove = currentInGroup.filter(function (id) {
        return !selected[id];
      });
      var steps = [];
      toAdd.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: compId,
            playerId: playerId,
            leagueId: groupId,
          });
        });
      });
      toRemove.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: compId,
            playerId: playerId,
            remove: true,
          });
        });
      });
      return seq(steps);
    },

    groupsForDisplay: function () {
      var list = this.groups || [];
      if (this.isKnockoutType()) return list;
      return list.filter(function (g) {
        return String(g.leagueId || g.groupId) !== KNOCKOUT_GROUP_ID;
      });
    },

    groupIdOf: function (g) {
      return g ? String(g.leagueId || g.groupId || '') : '';
    },

    renderGroups: function () {
      var box = this.el.groupsList;
      if (!box || this.isKnockoutType()) return;
      var groups = this.groupsForDisplay();
      var me = this;
      var items = groups.map(function (g) {
        var count = g.playerCount != null ? Number(g.playerCount) : 0;
        var meta = count === 1 ? '1 player' : count + ' players';
        return {
          id: me.groupIdOf(g),
          name: g.name,
          meta: meta,
          warn: count < 2 ? '(needs 2+)' : '',
        };
      });
      this.renderActionList(box, items, {
        emptyText: 'No groups yet.',
        onClick: function (id) {
          var g = me.groups.find(function (x) {
            return me.groupIdOf(x) === id;
          });
          if (g) me.openEditGroup(g);
        },
      });
    },

    renderKnockoutPlayers: function () {
      if (!this.isKnockoutType() || !this.el.knockoutPlayers) return;
      var onKo = (this.roster || [])
        .filter(function (r) {
          return String(playerLeague(r)) === String(KNOCKOUT_GROUP_ID);
        })
        .map(function (r) {
          return r.playerId;
        });
      this.renderCheckboxList(this.el.knockoutPlayers, this.allPlayers, onKo);
    },

    fillGroupPlayerCheckboxes: function (groupId) {
      var gid = groupId || (this.el.groupId && this.el.groupId.value.trim()) || '';
      var eligible = this.eligibleForGroup(gid);
      var inGroup = (this.roster || [])
        .filter(function (r) {
          return String(playerLeague(r)) === String(gid);
        })
        .map(function (r) {
          return r.playerId;
        });
      this.renderCheckboxList(this.el.groupPlayers, eligible, inGroup);
      this.updateGroupDeleteButton();
    },

    updateGroupDeleteButton: function () {
      var btn = this.el.groupDelete;
      var left = this.el.groupActionsLeft;
      if (!btn) return;
      if (!this.editingGroup) {
        btn.hidden = true;
        if (left) left.hidden = true;
        return;
      }
      var ticked = this.getCheckedPlayerIds(this.el.groupPlayers).length;
      var hasPlayers = ticked > 0;
      btn.hidden = hasPlayers;
      if (left) left.hidden = hasPlayers;
    },

    openCompModal: function () {
      if (!this.el.modal) return;
      this.el.modal.hidden = false;
      this.el.modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    closeCompModal: function () {
      if (!this.el.modal) return;
      this.el.modal.classList.remove('is-open');
      this.el.modal.hidden = true;
      document.body.style.overflow = '';
      if (this.el.modalMsg) this.el.modalMsg.hidden = true;
      this.editing = null;
      this.activeCompId = null;
      this.groups = [];
      this.roster = [];
    },

    openGroupModal: function () {
      if (!this.el.groupModal) return;
      this.el.groupModal.hidden = false;
      this.el.groupModal.classList.add('is-open');
    },

    closeGroupModal: function () {
      if (!this.el.groupModal) return;
      this.el.groupModal.classList.remove('is-open');
      this.el.groupModal.hidden = true;
      if (this.el.groupModalMsg) this.el.groupModalMsg.hidden = true;
      this.editingGroup = null;
    },

    openCreate: function () {
      this.editing = null;
      this.activeCompId = null;
      this.groups = [];
      this.roster = [];
      if (this.el.modalTitle) this.el.modalTitle.textContent = 'Add Comp';
      if (this.el.form) this.el.form.reset();
      if (this.el.cType) {
        this.el.cType.value = 'league';
        this.el.cType.disabled = false;
      }
      this.setManageVisible(false);
      this.updateCompDeleteButton();
      this.updateCompTypeField();
      this.applyManageUi();
      this.openCompModal();
      if (this.el.cName) this.el.cName.focus();
    },

    openEdit: function (c) {
      var me = this;
      this.editSessionId += 1;
      var sessionId = this.editSessionId;
      this.editing = c;
      this.activeCompId = compIdOf(c);
      if (this.el.modalTitle) this.el.modalTitle.textContent = 'Edit Comp';
      if (this.el.cName) this.el.cName.value = c.name || '';
      if (this.el.cCur) this.el.cCur.checked = !!c.isCurrent;
      if (this.el.cType) {
        this.el.cType.value = normalizeCompetitionType(c);
      }
      this.setManageVisible(true);
      this.applyManageUi();
      this.openCompModal();
      this.loadCompDetail(this.activeCompId, sessionId).then(function () {
        if (me.el.cName) me.el.cName.focus();
      });
    },

    saveComp: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var name = (me.el.cName && me.el.cName.value.trim()) || '';
      if (!name) {
        me.flash('Name is required.', true);
        return;
      }
      var id = me.resolveCompId(name);
      var competitionType = me.el.cType ? me.el.cType.value : 'league';
      if (me.el.cSave) me.el.cSave.disabled = true;

      me.persistCompHeader()
        .then(function () {
          if (competitionType === 'knockout') {
            var selected = me.getCheckedPlayerIds(me.el.knockoutPlayers);
            return me.syncKnockoutRoster(id, selected);
          }
          return Promise.resolve();
        })
        .then(function () {
          me.closeCompModal();
          me.flash('Comp saved.', false);
          return me.loadCompetitions();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.cSave) me.el.cSave.disabled = false;
        });
    },

    deleteComp: function () {
      if (!this.activeCompId) return;
      var me = this;
      var label = (me.el.cName && me.el.cName.value.trim()) || this.activeCompId;
      if (
        !window.confirm(
          'Delete comp "' + label + '"? Only allowed when no players or fixtures are linked.'
        )
      ) {
        return;
      }
      if (me.el.cDelete) me.el.cDelete.disabled = true;
      ApiClient.post('deleteSeason', { seasonId: me.activeCompId })
        .then(function () {
          me.closeCompModal();
          me.flash('Comp deleted.', false);
          return me.loadCompetitions();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.cDelete) me.el.cDelete.disabled = false;
        });
    },

    openCreateGroup: function () {
      if (!this.activeCompId) return;
      this.editingGroup = null;
      if (this.el.groupModalTitle) this.el.groupModalTitle.textContent = 'Add Group';
      if (this.el.groupForm) this.el.groupForm.reset();
      if (this.el.groupId) {
        this.el.groupId.value = '';
        this.el.groupId.readOnly = false;
      }
      if (this.el.groupOrder) this.el.groupOrder.value = String((this.groups.length || 0) + 1);
      if (this.el.groupDelete) this.el.groupDelete.hidden = true;
      if (this.el.groupActionsLeft) this.el.groupActionsLeft.hidden = true;
      this.fillGroupPlayerCheckboxes('');
      this.openGroupModal();
    },

    openEditGroup: function (g) {
      this.editingGroup = g;
      if (this.el.groupModalTitle) this.el.groupModalTitle.textContent = 'Edit Group';
      if (this.el.groupId) {
        this.el.groupId.value = this.groupIdOf(g);
        this.el.groupId.readOnly = true;
      }
      if (this.el.groupName) this.el.groupName.value = g.name || '';
      if (this.el.groupOrder) {
        this.el.groupOrder.value = String(g.displayOrder != null ? g.displayOrder : 0);
      }
      this.fillGroupPlayerCheckboxes(this.groupIdOf(g));
      this.openGroupModal();
    },

    saveGroup: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var compId = me.activeCompId;
      if (!compId) return;
      var groupId = (me.el.groupId && me.el.groupId.value.trim()) || '';
      var name = (me.el.groupName && me.el.groupName.value.trim()) || '';
      var ord = parseInt((me.el.groupOrder && me.el.groupOrder.value) || '0', 10);
      if (!groupId || !name) {
        me.flash('Group id and name required.', true);
        return;
      }
      var selected = me.getCheckedPlayerIds(me.el.groupPlayers);
      if (me.el.groupSave) me.el.groupSave.disabled = true;

      me.persistCompHeader()
        .then(function () {
          return ApiClient.post('upsertSeasonGroup', {
            seasonId: compId,
            leagueId: groupId,
            name: name,
            displayOrder: ord,
          });
        })
        .then(function () {
          return me.syncGroupRoster(compId, groupId, selected);
        })
        .then(function () {
          me.closeGroupModal();
          me.flash('Group saved.', false);
          return me.loadCompDetail(compId);
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.groupSave) me.el.groupSave.disabled = false;
        });
    },

    removeGroup: function () {
      if (!this.editingGroup || !this.activeCompId) return;
      var me = this;
      if (!window.confirm('Remove group "' + this.editingGroup.name + '" from this comp?')) return;
      if (me.el.groupDelete) me.el.groupDelete.disabled = true;
      ApiClient.post('upsertSeasonGroup', {
        seasonId: me.activeCompId,
        leagueId: me.groupIdOf(me.editingGroup),
        remove: true,
      })
        .then(function () {
          me.closeGroupModal();
          me.flash('Group removed.', false);
          return me.loadCompDetail(me.activeCompId);
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.groupDelete) me.el.groupDelete.disabled = false;
        });
    },

    bind: function () {
      var me = this;
      if (this.el.addBtn) {
        this.el.addBtn.addEventListener('click', function () {
          me.openCreate();
        });
      }
      if (this.el.form) {
        this.el.form.addEventListener('submit', function (e) {
          me.saveComp(e);
        });
      }
      if (this.el.cType) {
        this.el.cType.addEventListener('change', function () {
          me.editSessionId += 1;
          me.applyManageUi();
        });
      }
      if (this.el.cDelete) {
        this.el.cDelete.addEventListener('click', function () {
          me.deleteComp();
        });
      }
      if (this.el.modalClose) {
        this.el.modalClose.addEventListener('click', function () {
          me.closeCompModal();
        });
      }
      if (this.el.modalCancel) {
        this.el.modalCancel.addEventListener('click', function () {
          me.closeCompModal();
        });
      }
      if (this.el.modal) {
        this.el.modal.addEventListener('click', function (ev) {
          if (ev.target === me.el.modal) me.closeCompModal();
        });
      }
      if (this.el.addGroup) {
        this.el.addGroup.addEventListener('click', function () {
          me.openCreateGroup();
        });
      }
      if (this.el.addKnockout) {
        this.el.addKnockout.addEventListener('click', function () {
          me.addKnockoutStage();
        });
      }
      if (this.el.unlinkKnockout) {
        this.el.unlinkKnockout.addEventListener('click', function () {
          if (me.activeCompId) me.unlinkKnockoutStage(me.activeCompId);
        });
      }
      if (this.el.groupForm) {
        this.el.groupForm.addEventListener('submit', function (e) {
          me.saveGroup(e);
        });
      }
      if (this.el.groupId) {
        this.el.groupId.addEventListener('input', function () {
          if (!me.editingGroup) {
            me.fillGroupPlayerCheckboxes(me.el.groupId.value.trim());
          }
        });
      }
      if (this.el.groupPlayers) {
        this.el.groupPlayers.addEventListener('change', function () {
          me.updateGroupDeleteButton();
        });
      }
      if (this.el.groupDelete) {
        this.el.groupDelete.addEventListener('click', function () {
          me.removeGroup();
        });
      }
      document.querySelectorAll('[data-close="group"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          me.closeGroupModal();
        });
      });
      if (this.el.groupModal) {
        this.el.groupModal.addEventListener('click', function (ev) {
          if (ev.target === me.el.groupModal) me.closeGroupModal();
        });
      }
      if (this.el.koLinkExistingBtn) {
        this.el.koLinkExistingBtn.addEventListener('click', function () {
          me.showKoLinkPanel('existing');
        });
      }
      if (this.el.koLinkNewBtn) {
        this.el.koLinkNewBtn.addEventListener('click', function () {
          me.fillKoNewPlayerCheckboxes();
          me.showKoLinkPanel('new');
        });
      }
      if (this.el.koLinkConfirm) {
        this.el.koLinkConfirm.addEventListener('click', function () {
          me.confirmLinkExistingKnockout();
        });
      }
      if (this.el.koNewCreate) {
        this.el.koNewCreate.addEventListener('click', function () {
          me.confirmCreateNewKnockout();
        });
      }
      document.querySelectorAll('[data-close="ko-link"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          me.closeKoLinkModal();
        });
      });
      document.querySelectorAll('[data-ko-link-back]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          me.showKoLinkPanel('choose');
        });
      });
      if (this.el.koLinkModal) {
        this.el.koLinkModal.addEventListener('click', function (ev) {
          if (ev.target === me.el.koLinkModal) me.closeKoLinkModal();
        });
      }
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        if (me.el.koLinkModal && me.el.koLinkModal.classList.contains('is-open')) {
          me.closeKoLinkModal();
        } else if (me.el.groupModal && me.el.groupModal.classList.contains('is-open')) {
          me.closeGroupModal();
        } else if (me.el.modal && me.el.modal.classList.contains('is-open')) {
          me.closeCompModal();
        }
      });
    },

    init: function () {
      if (!document.getElementById('adminCompetitionsRoot')) return;
      this.cacheEls();
      this.bind();
      var me = this;
      window.addEventListener(this.adminEvt(), function () {
        me.syncGate();
      });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
