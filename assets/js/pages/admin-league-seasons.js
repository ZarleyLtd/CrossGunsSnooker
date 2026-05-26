// Admin — seasons list + integrated groups/players in season dialog.

var AdminLeagueSeasonsPage = (function () {
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

  function normalizeCompetitionType(seasonOrType) {
    if (!seasonOrType) return 'league';
    if (typeof seasonOrType === 'string') {
      return seasonOrType.toLowerCase() === 'knockout' ? 'knockout' : 'league';
    }
    var raw = seasonOrType.competitionType || seasonOrType.competition_type || 'league';
    return String(raw).toLowerCase() === 'knockout' ? 'knockout' : 'league';
  }

  function activePlayers(all) {
    return (all || []).filter(function (p) {
      return p.active !== false;
    });
  }

  function seq(steps) {
    return steps.reduce(function (chain, fn) {
      return chain.then(fn);
    }, Promise.resolve());
  }

  function qsSeasonId() {
    try {
      return new URL(window.location.href).searchParams.get('seasonId') || '';
    } catch (_e) {
      return '';
    }
  }

  var self = {
    seasons: [],
    editing: null,
    activeSeasonId: null,
    groups: [],
    roster: [],
    allPlayers: [],
    editingGroup: null,
    editSessionId: 0,
    el: {},

    isKnockoutType: function () {
      return self.el.sType && self.el.sType.value === 'knockout';
    },

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el = {
        gate: document.getElementById('adminLsGate'),
        panel: document.getElementById('adminLsPanel'),
        msg: document.getElementById('adminLsMsg'),
        list: document.getElementById('adminLsList'),
        addBtn: document.getElementById('adminLsAddBtn'),
        modal: document.getElementById('adminLsSeasonModal'),
        modalTitle: document.getElementById('adminLsModalTitle'),
        modalClose: document.getElementById('adminLsModalClose'),
        modalMsg: document.getElementById('adminLsSeasonModalMsg'),
        modalCancel: document.getElementById('adminLsModalCancel'),
        form: document.getElementById('adminLsSeasonForm'),
        sId: document.getElementById('adminLsSeasonId'),
        sName: document.getElementById('adminLsSeasonName'),
        sType: document.getElementById('adminLsSeasonType'),
        sCur: document.getElementById('adminLsSeasonCurrent'),
        sDelete: document.getElementById('adminLsSeasonDelete'),
        sSave: document.getElementById('adminLsSeasonSave'),
        deleteLeft: document.querySelector('#adminLsSeasonForm .admin-form-actions__left'),
        manageSection: document.getElementById('adminLsManageSection'),
        saveFirstHint: document.getElementById('adminLsSaveFirstHint'),
        leagueSection: document.getElementById('adminLsLeagueSection'),
        knockoutSection: document.getElementById('adminLsKnockoutSection'),
        groupsList: document.getElementById('adminLsGroupsList'),
        addGroup: document.getElementById('adminLsAddGroup'),
        knockoutPlayers: document.getElementById('adminLsKnockoutPlayers'),
        groupModal: document.getElementById('adminLsGroupModal'),
        groupModalMsg: document.getElementById('adminLsGroupModalMsg'),
        groupForm: document.getElementById('adminLsGroupForm'),
        groupModalTitle: document.getElementById('adminLsGroupModalTitle'),
        groupId: document.getElementById('adminLsGroupId'),
        groupName: document.getElementById('adminLsGroupName'),
        groupOrder: document.getElementById('adminLsGroupOrder'),
        groupPlayers: document.getElementById('adminLsGroupPlayers'),
        groupDelete: document.getElementById('adminLsGroupDelete'),
        groupSave: document.getElementById('adminLsGroupSave'),
        groupActionsLeft: document.querySelector('#adminLsGroupForm .admin-form-actions__left'),
      };
    },

    flashTarget: function () {
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
        this.loadSeasons().then(function () {
          var openId = qsSeasonId();
          if (openId) {
            var s = me.seasons.find(function (x) {
              return x.seasonId === openId;
            });
            if (s) me.openEdit(s);
          }
        });
      }
    },

    loadSeasons: function () {
      var me = this;
      if (typeof AdminMode === 'undefined' || !AdminMode.isUnlocked()) return Promise.resolve();
      return ApiClient.get({ action: 'getSeasons' })
        .then(function (r) {
          me.seasons = r.seasons || [];
          me.renderList();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    loadSeasonDetail: function (seasonId, sessionId) {
      var me = this;
      if (!seasonId) return Promise.resolve();
      return Promise.all([
        ApiClient.get({ action: 'getSeasonGroups', seasonId: seasonId }),
        ApiClient.get({ action: 'getPlayers', season: seasonId }),
        ApiClient.get({ action: 'getPlayers' }),
      ]).then(function (rs) {
        me.groups = rs[0].groups || [];
        me.roster = rs[1].players || [];
        me.allPlayers = activePlayers(rs[2].players || []);
        if (rs[0].season && (sessionId === undefined || sessionId === me.editSessionId)) {
          me.applySeasonMeta(rs[0].season);
        }
        me.renderGroups();
        me.renderKnockoutPlayers();
        me.updateSeasonDeleteButton();
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
      if (!this.seasons.length) {
        this.renderActionList(box, [], {
          emptyText: 'No seasons yet.',
          emptyActionHtml:
            '<p style="margin:0.75em 0 0;text-align:center;">' +
            '<button type="button" class="btn" data-empty-action>+ Add Season</button></p>',
          onEmptyAction: function () {
            me.openCreate();
          },
        });
        return;
      }
      var items = this.seasons.map(function (s) {
        return {
          id: s.seasonId,
          name: s.name,
          meta: typeLabel(normalizeCompetitionType(s)),
          isCurrent: !!s.isCurrent,
        };
      });
      this.renderActionList(box, items, {
        onClick: function (id) {
          var season = me.seasons.find(function (x) {
            return x.seasonId === id;
          });
          if (season) me.openEdit(season);
        },
      });
    },

    applyManageUi: function () {
      var ko = this.isKnockoutType();
      if (this.el.leagueSection) {
        this.el.leagueSection.hidden = ko;
      }
      if (this.el.knockoutSection) {
        this.el.knockoutSection.hidden = !ko;
      }
    },

    setManageVisible: function (visible) {
      if (this.el.manageSection) this.el.manageSection.hidden = !visible;
      if (this.el.saveFirstHint) this.el.saveFirstHint.hidden = visible;
    },

    applySeasonMeta: function (season) {
      if (!season) return;
      var type = normalizeCompetitionType(season);
      var seasonId = season.seasonId || season.season_id || this.activeSeasonId;
      if (this.el.sType) this.el.sType.value = type;
      if (this.editing) this.editing.competitionType = type;
      if (seasonId) {
        var idx = this.seasons.findIndex(function (x) {
          return x.seasonId === seasonId;
        });
        if (idx >= 0) this.seasons[idx].competitionType = type;
      }
      this.applyManageUi();
      this.updateSeasonTypeField();
    },

    persistSeasonHeader: function () {
      var me = this;
      var id = me.activeSeasonId || (me.el.sId && me.el.sId.value.trim()) || '';
      var name = (me.el.sName && me.el.sName.value.trim()) || '';
      if (!id || !name) {
        return Promise.reject(new Error('Season id and name are required.'));
      }
      var competitionType = me.el.sType ? me.el.sType.value : 'league';
      return ApiClient.post('upsertSeason', {
        seasonId: id,
        name: name,
        isCurrent: me.el.sCur ? me.el.sCur.checked : false,
        competitionType: competitionType,
      }).then(function () {
        me.activeSeasonId = id;
        if (me.el.sId) me.el.sId.readOnly = true;
        if (me.editing) me.editing.competitionType = competitionType;
        var s = me.seasons.find(function (x) {
          return x.seasonId === id;
        });
        if (s) s.competitionType = competitionType;
      });
    },

    seasonHasPlayers: function () {
      return (this.roster || []).length > 0;
    },

    updateSeasonDeleteButton: function () {
      var btn = this.el.sDelete;
      var left = this.el.deleteLeft;
      if (!btn) return;
      if (!this.activeSeasonId) {
        btn.hidden = true;
        if (left) left.hidden = true;
        return;
      }
      var hasPlayers = this.seasonHasPlayers();
      btn.hidden = hasPlayers;
      if (left) left.hidden = hasPlayers;
    },

    updateSeasonTypeField: function () {
      if (!this.el.sType) return;
      var hasPlayers = this.seasonHasPlayers();
      this.el.sType.disabled = !!this.activeSeasonId && hasPlayers;
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
        if (gid && String(entry.league) === String(gid)) return true;
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
            '<input type="checkbox" name="seasonPlayer" value="' +
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

    syncKnockoutRoster: function (seasonId, selectedIds) {
      var me = this;
      var selected = {};
      selectedIds.forEach(function (id) {
        selected[id] = true;
      });
      var onSeason = (me.roster || []).map(function (r) {
        return r.playerId;
      });
      var toRemove = onSeason.filter(function (id) {
        return !selected[id];
      });
      var toAdd = selectedIds.filter(function (id) {
        var entry = me.rosterEntry(id);
        if (!entry) return true;
        return String(entry.league) !== String(KNOCKOUT_GROUP_ID);
      });
      var steps = [];
      toAdd.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: seasonId,
            playerId: playerId,
            leagueId: KNOCKOUT_GROUP_ID,
          });
        });
      });
      toRemove.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: seasonId,
            playerId: playerId,
            remove: true,
          });
        });
      });
      return seq(steps);
    },

    syncGroupRoster: function (seasonId, leagueId, selectedIds) {
      var me = this;
      var selected = {};
      selectedIds.forEach(function (id) {
        selected[id] = true;
      });
      var currentInGroup = (me.roster || [])
        .filter(function (r) {
          return String(r.league) === String(leagueId);
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
            seasonId: seasonId,
            playerId: playerId,
            leagueId: leagueId,
          });
        });
      });
      toRemove.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: seasonId,
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
        return g.leagueId !== KNOCKOUT_GROUP_ID;
      });
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
          id: g.leagueId,
          name: g.name,
          meta: meta,
          warn: count < 2 ? '(needs 2+)' : '',
        };
      });
      this.renderActionList(box, items, {
        emptyText: 'No groups yet.',
        onClick: function (id) {
          var g = me.groups.find(function (x) {
            return x.leagueId === id;
          });
          if (g) me.openEditGroup(g);
        },
      });
    },

    renderKnockoutPlayers: function () {
      if (!this.isKnockoutType() || !this.el.knockoutPlayers) return;
      var onKo = (this.roster || [])
        .filter(function (r) {
          return String(r.league) === String(KNOCKOUT_GROUP_ID);
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
          return String(r.league) === String(gid);
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

    openSeasonModal: function () {
      if (!this.el.modal) return;
      this.el.modal.hidden = false;
      this.el.modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },

    closeSeasonModal: function () {
      if (!this.el.modal) return;
      this.el.modal.classList.remove('is-open');
      this.el.modal.hidden = true;
      document.body.style.overflow = '';
      if (this.el.modalMsg) this.el.modalMsg.hidden = true;
      this.editing = null;
      this.activeSeasonId = null;
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
      this.activeSeasonId = null;
      this.groups = [];
      this.roster = [];
      if (this.el.modalTitle) this.el.modalTitle.textContent = 'Add Season';
      if (this.el.form) this.el.form.reset();
      if (this.el.sId) {
        this.el.sId.value = '';
        this.el.sId.readOnly = false;
      }
      if (this.el.sType) {
        this.el.sType.value = 'league';
        this.el.sType.disabled = false;
      }
      this.setManageVisible(false);
      this.updateSeasonDeleteButton();
      this.updateSeasonTypeField();
      this.openSeasonModal();
      if (this.el.sId) this.el.sId.focus();
    },

    openEdit: function (s) {
      var me = this;
      this.editSessionId += 1;
      var sessionId = this.editSessionId;
      this.editing = s;
      this.activeSeasonId = s.seasonId;
      if (this.el.modalTitle) this.el.modalTitle.textContent = 'Edit Season';
      if (this.el.sId) {
        this.el.sId.value = s.seasonId;
        this.el.sId.readOnly = true;
      }
      if (this.el.sName) this.el.sName.value = s.name || '';
      if (this.el.sCur) this.el.sCur.checked = !!s.isCurrent;
      if (this.el.sType) {
        this.el.sType.value = normalizeCompetitionType(s);
      }
      this.setManageVisible(true);
      this.openSeasonModal();
      this.loadSeasonDetail(s.seasonId).then(function () {
        if (me.el.sName) me.el.sName.focus();
      });
    },

    saveSeason: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var id = (me.el.sId && me.el.sId.value.trim()) || '';
      var name = (me.el.sName && me.el.sName.value.trim()) || '';
      if (!id || !name) {
        me.flash('Season id and name are required.', true);
        return;
      }
      if (!/^[a-z0-9-]+$/.test(id)) {
        me.flash('Season id: lowercase letters, numbers, and hyphens only.', true);
        return;
      }
      var competitionType = me.el.sType ? me.el.sType.value : 'league';
      if (me.el.sSave) me.el.sSave.disabled = true;

      me.persistSeasonHeader()
        .then(function () {
          if (competitionType === 'knockout') {
            var selected = me.getCheckedPlayerIds(me.el.knockoutPlayers);
            return me.syncKnockoutRoster(id, selected);
          }
          return Promise.resolve();
        })
        .then(function () {
          me.closeSeasonModal();
          me.flash('Season saved.', false);
          return me.loadSeasons();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.sSave) me.el.sSave.disabled = false;
        });
    },

    deleteSeason: function () {
      if (!this.activeSeasonId) return;
      var me = this;
      var label = (me.el.sName && me.el.sName.value.trim()) || this.activeSeasonId;
      if (
        !window.confirm(
          'Delete season "' + label + '"? Only allowed when no players or fixtures are linked.'
        )
      ) {
        return;
      }
      if (me.el.sDelete) me.el.sDelete.disabled = true;
      ApiClient.post('deleteSeason', { seasonId: me.activeSeasonId })
        .then(function () {
          me.closeSeasonModal();
          me.flash('Season deleted.', false);
          return me.loadSeasons();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.sDelete) me.el.sDelete.disabled = false;
        });
    },

    openCreateGroup: function () {
      if (!this.activeSeasonId) return;
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
        this.el.groupId.value = g.leagueId;
        this.el.groupId.readOnly = true;
      }
      if (this.el.groupName) this.el.groupName.value = g.name || '';
      if (this.el.groupOrder) {
        this.el.groupOrder.value = String(g.displayOrder != null ? g.displayOrder : 0);
      }
      this.fillGroupPlayerCheckboxes(g.leagueId);
      this.openGroupModal();
    },

    saveGroup: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var seasonId = me.activeSeasonId;
      if (!seasonId) return;
      var leagueId = (me.el.groupId && me.el.groupId.value.trim()) || '';
      var name = (me.el.groupName && me.el.groupName.value.trim()) || '';
      var ord = parseInt((me.el.groupOrder && me.el.groupOrder.value) || '0', 10);
      if (!leagueId || !name) {
        me.flash('Group id and name required.', true);
        return;
      }
      var selected = me.getCheckedPlayerIds(me.el.groupPlayers);
      if (me.el.groupSave) me.el.groupSave.disabled = true;

      me.persistSeasonHeader()
        .then(function () {
          return ApiClient.post('upsertSeasonGroup', {
            seasonId: seasonId,
            leagueId: leagueId,
            name: name,
            displayOrder: ord,
          });
        })
        .then(function () {
          return me.syncGroupRoster(seasonId, leagueId, selected);
        })
        .then(function () {
          me.closeGroupModal();
          me.flash('Group saved.', false);
          return me.loadSeasonDetail(seasonId);
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.groupSave) me.el.groupSave.disabled = false;
        });
    },

    removeGroup: function () {
      if (!this.editingGroup || !this.activeSeasonId) return;
      var me = this;
      if (!window.confirm('Remove group "' + this.editingGroup.name + '" from this season?')) return;
      if (me.el.groupDelete) me.el.groupDelete.disabled = true;
      ApiClient.post('upsertSeasonGroup', {
        seasonId: me.activeSeasonId,
        leagueId: me.editingGroup.leagueId,
        remove: true,
      })
        .then(function () {
          me.closeGroupModal();
          me.flash('Group removed.', false);
          return me.loadSeasonDetail(me.activeSeasonId);
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
          me.saveSeason(e);
        });
      }
      if (this.el.sType) {
        this.el.sType.addEventListener('change', function () {
          me.editSessionId += 1;
          me.applyManageUi();
        });
      }
      if (this.el.sDelete) {
        this.el.sDelete.addEventListener('click', function () {
          me.deleteSeason();
        });
      }
      if (this.el.modalClose) {
        this.el.modalClose.addEventListener('click', function () {
          me.closeSeasonModal();
        });
      }
      if (this.el.modalCancel) {
        this.el.modalCancel.addEventListener('click', function () {
          me.closeSeasonModal();
        });
      }
      if (this.el.modal) {
        this.el.modal.addEventListener('click', function (ev) {
          if (ev.target === me.el.modal) me.closeSeasonModal();
        });
      }
      if (this.el.addGroup) {
        this.el.addGroup.addEventListener('click', function () {
          me.openCreateGroup();
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
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        if (me.el.groupModal && me.el.groupModal.classList.contains('is-open')) {
          me.closeGroupModal();
        } else if (me.el.modal && me.el.modal.classList.contains('is-open')) {
          me.closeSeasonModal();
        }
      });
    },

    init: function () {
      if (!document.getElementById('adminLeagueSeasonsRoot')) return;
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
