// Admin — manage groups (league) or roster checkboxes (knockout) for one season.

var AdminSeasonPage = (function () {
  var KNOCKOUT_GROUP_ID = 'ko';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function qsSeasonId() {
    try {
      return new URL(window.location.href).searchParams.get('seasonId') || '';
    } catch (_e) {
      return '';
    }
  }

  function seq(promises) {
    return promises.reduce(function (chain, fn) {
      return chain.then(fn);
    }, Promise.resolve());
  }

  var self = {
    seasonId: '',
    season: null,
    groups: [],
    roster: [],
    allPlayers: [],
    editingGroup: null,
    el: {},

    isKnockout: function () {
      return self.season && self.season.competitionType === 'knockout';
    },

    adminEvt: function () {
      return typeof AdminMode !== 'undefined' ? AdminMode.EVENT_NAME : 'crossguns-admin-mode-changed';
    },

    cacheEls: function () {
      this.el = {
        gate: document.getElementById('adminSeasonGate'),
        panel: document.getElementById('adminSeasonPanel'),
        msg: document.getElementById('adminSeasonMsg'),
        meta: document.getElementById('adminSeasonMeta'),
        hero: document.getElementById('adminSeasonHeroTitle'),
        leagueSection: document.getElementById('adminSeasonLeague'),
        knockoutSection: document.getElementById('adminSeasonKnockout'),
        groupsList: document.getElementById('adminSeasonGroupsList'),
        addGroup: document.getElementById('adminSeasonAddGroup'),
        knockoutPlayers: document.getElementById('adminSeasonKnockoutPlayers'),
        saveKnockout: document.getElementById('adminSeasonSaveKnockout'),
        groupModal: document.getElementById('adminSeasonGroupModal'),
        groupForm: document.getElementById('adminSeasonGroupForm'),
        groupModalTitle: document.getElementById('adminSeasonGroupModalTitle'),
        groupId: document.getElementById('adminSeasonGroupId'),
        groupName: document.getElementById('adminSeasonGroupName'),
        groupOrder: document.getElementById('adminSeasonGroupOrder'),
        groupPlayers: document.getElementById('adminSeasonGroupPlayers'),
        groupDelete: document.getElementById('adminSeasonGroupDelete'),
        groupSave: document.getElementById('adminSeasonGroupSave'),
        groupActionsLeft: document.querySelector('#adminSeasonGroupForm .admin-form-actions__left'),
      };
    },

    flash: function (text, isErr) {
      if (!this.el.msg) return;
      this.el.msg.textContent = text || '';
      this.el.msg.className = 'msg' + (isErr ? ' msg--warning' : ' msg--success');
      this.el.msg.hidden = !text;
    },

    syncGate: function () {
      var ok = typeof AdminMode !== 'undefined' && AdminMode.isUnlocked();
      if (this.el.gate) this.el.gate.hidden = ok;
      if (this.el.panel) this.el.panel.hidden = !ok;
      if (ok && this.seasonId) this.loadAll();
    },

    loadAll: function () {
      var me = this;
      return Promise.all([
        ApiClient.get({ action: 'getSeasonGroups', seasonId: me.seasonId }),
        ApiClient.get({ action: 'getPlayers', season: me.seasonId }),
        ApiClient.get({ action: 'getPlayers' }),
      ])
        .then(function (rs) {
          me.season = rs[0].season;
          me.groups = rs[0].groups || [];
          me.roster = rs[1].players || [];
          me.allPlayers = rs[2].players || [];
          me.applySeasonUi();
          me.renderGroups();
          me.renderKnockoutPlayers();
        })
        .catch(function (e) {
          me.flash(e.message || String(e), true);
        });
    },

    applySeasonUi: function () {
      if (!this.season) return;
      var title = this.season.name || this.season.seasonId;
      if (this.el.hero) this.el.hero.textContent = title;
      document.title = title + ' - CrossGuns Admin';
      var type = this.isKnockout() ? 'Knockout' : 'League';
      if (this.el.meta) {
        this.el.meta.textContent = type + (this.season.isCurrent ? ' · Current' : '');
      }
      var ko = this.isKnockout();
      if (this.el.leagueSection) {
        this.el.leagueSection.classList.toggle('is-visible', !ko);
      }
      if (this.el.knockoutSection) {
        this.el.knockoutSection.classList.toggle('is-visible', ko);
      }
    },

    rosterEntry: function (playerId) {
      return (this.roster || []).find(function (r) {
        return r.playerId === playerId;
      });
    },

    /** Players not assigned to a different group (eligible to tick for groupId). */
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

    syncGroupRoster: function (leagueId, selectedIds) {
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
            seasonId: me.seasonId,
            playerId: playerId,
            leagueId: leagueId,
          });
        });
      });
      toRemove.forEach(function (playerId) {
        steps.push(function () {
          return ApiClient.post('upsertSeasonPlayer', {
            seasonId: me.seasonId,
            playerId: playerId,
            remove: true,
          });
        });
      });
      return seq(steps);
    },

    renderGroups: function () {
      var box = this.el.groupsList;
      if (!box || this.isKnockout()) return;
      if (!this.groups.length) {
        box.innerHTML = '<div class="admin-empty"><p>No groups for this season yet.</p></div>';
        return;
      }
      var me = this;
      var rows = this.groups
        .map(function (g) {
          var warn = g.playerCount < 2 ? ' <span style="color:#c90;">(needs 2+ players)</span>' : '';
          return (
            '<tr><td><button type="button" class="col-name-link admin-season-gname" data-id="' +
            esc(g.leagueId) +
            '">' +
            esc(g.name) +
            '</button></td><td>' +
            g.playerCount +
            warn +
            '</td></tr>'
          );
        })
        .join('');
      box.innerHTML =
        '<table class="admin-table"><thead><tr><th>Name</th><th>Players</th></tr></thead><tbody>' +
        rows +
        '</tbody></table>';
      box.querySelectorAll('.admin-season-gname').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-id');
          var g = me.groups.find(function (x) {
            return x.leagueId === id;
          });
          if (g) me.openEditGroup(g);
        });
      });
    },

    renderKnockoutPlayers: function () {
      if (!this.isKnockout()) return;
      var onRoster = (this.roster || []).map(function (r) {
        return r.playerId;
      });
      this.renderCheckboxList(this.el.knockoutPlayers, this.allPlayers, onRoster);
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

    openModal: function (modal, options) {
      if (!modal) return;
      var opts = options || {};
      modal.hidden = false;
      modal.classList.add('is-open');
      if (!opts.allowPageScroll) {
        document.body.style.overflow = 'hidden';
      }
    },

    closeModal: function (modal) {
      if (!modal) return;
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.style.overflow = '';
      this.editingGroup = null;
    },

    openCreateGroup: function () {
      this.editingGroup = null;
      if (this.el.groupModalTitle) this.el.groupModalTitle.textContent = 'Add Group';
      if (this.el.groupForm) this.el.groupForm.reset();
      if (this.el.groupId) {
        this.el.groupId.value = '';
        this.el.groupId.readOnly = false;
      }
      if (this.el.groupOrder) this.el.groupOrder.value = String((this.groups.length || 0) + 1);
      if (this.el.groupDelete) this.el.groupDelete.hidden = true;
      this.fillGroupPlayerCheckboxes('');
      this.openModal(this.el.groupModal, { allowPageScroll: true });
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
      this.openModal(this.el.groupModal, { allowPageScroll: true });
    },

    saveGroup: function (e) {
      if (e) e.preventDefault();
      var me = this;
      var leagueId = (me.el.groupId && me.el.groupId.value.trim()) || '';
      var name = (me.el.groupName && me.el.groupName.value.trim()) || '';
      var ord = parseInt((me.el.groupOrder && me.el.groupOrder.value) || '0', 10);
      if (!leagueId || !name) {
        me.flash('Group id and name required.', true);
        return;
      }
      var selected = me.getCheckedPlayerIds(me.el.groupPlayers);
      if (me.el.groupSave) me.el.groupSave.disabled = true;

      ApiClient.post('upsertSeasonGroup', {
        seasonId: me.seasonId,
        leagueId: leagueId,
        name: name,
        displayOrder: ord,
      })
        .then(function () {
          return me.syncGroupRoster(leagueId, selected);
        })
        .then(function () {
          me.flash('Group saved.', false);
          me.closeModal(me.el.groupModal);
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.groupSave) me.el.groupSave.disabled = false;
        });
    },

    removeGroup: function () {
      if (!this.editingGroup) return;
      var me = this;
      if (!window.confirm('Remove group "' + this.editingGroup.name + '" from this season?')) return;
      if (me.el.groupDelete) me.el.groupDelete.disabled = true;
      ApiClient.post('upsertSeasonGroup', {
        seasonId: me.seasonId,
        leagueId: me.editingGroup.leagueId,
        remove: true,
      })
        .then(function () {
          me.flash('Group removed.', false);
          me.closeModal(me.el.groupModal);
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.groupDelete) me.el.groupDelete.disabled = false;
        });
    },

    saveKnockoutPlayers: function () {
      var me = this;
      var selected = me.getCheckedPlayerIds(me.el.knockoutPlayers);
      if (me.el.saveKnockout) me.el.saveKnockout.disabled = true;
      me.syncGroupRoster(KNOCKOUT_GROUP_ID, selected)
        .then(function () {
          me.flash('Players saved.', false);
          return me.loadAll();
        })
        .catch(function (err) {
          me.flash(err.message || String(err), true);
        })
        .finally(function () {
          if (me.el.saveKnockout) me.el.saveKnockout.disabled = false;
        });
    },

    bind: function () {
      var me = this;
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
      if (this.el.saveKnockout) {
        this.el.saveKnockout.addEventListener('click', function () {
          me.saveKnockoutPlayers();
        });
      }
      document.querySelectorAll('[data-close="group"]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          me.closeModal(me.el.groupModal);
        });
      });
      if (this.el.groupModal) {
        this.el.groupModal.addEventListener('click', function (ev) {
          if (ev.target === me.el.groupModal) me.closeModal(me.el.groupModal);
        });
      }
      document.addEventListener('keydown', function (ev) {
        if (ev.key !== 'Escape') return;
        if (me.el.groupModal && me.el.groupModal.classList.contains('is-open')) {
          me.closeModal(me.el.groupModal);
        }
      });
    },

    init: function () {
      if (!document.getElementById('adminSeasonRoot')) return;
      this.seasonId = qsSeasonId();
      this.cacheEls();
      this.bind();
      if (!this.seasonId) {
        this.flash('Missing seasonId in URL.', true);
        return;
      }
      var me = this;
      window.addEventListener(this.adminEvt(), function () {
        me.syncGate();
      });
      this.syncGate();
    },
  };

  return { init: function () { self.init(); } };
})();
