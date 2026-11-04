/**
 * Click-to-target contextual help.
 * Arm with [data-help-toggle], then the next pointer is explained (feature copy, never record data).
 * Copied from FamilyTree. Catalog global is CrossGunsHelpCatalog.
 * Popovers opened from a native <dialog> are mounted inside that dialog so they
 * paint in the same top layer (a body popover sits behind showModal).
 */
window.ContextualHelp = (function () {
  'use strict';

  var armed = false;
  var popover = null;
  var hint = null;
  var swallowUntil = 0;
  var outsideTimer = 0;
  var inited = false;

  function catalog() {
    return window.CrossGunsHelpCatalog || { pages: {}, topics: {} };
  }

  function isToggle(el) {
    return !!(el && el.closest && el.closest('[data-help-toggle]'));
  }

  function pageTopic() {
    var cat = catalog();
    var pages = cat.pages || {};
    var id = document.body && document.body.dataset.page;
    return (id && pages[id]) || pages.home || { title: 'Help', body: 'Tap a control to learn what it does.' };
  }

  function resolve(target) {
    var el = target && target.closest ? target.closest('[data-help]') : null;
    var cat = catalog();
    if (el) {
      var key = el.getAttribute('data-help');
      var topic = cat.topics && cat.topics[key];
      if (topic) return { topic: topic, anchor: el };
    }
    var fallback = target && target.nodeType === 1 ? target : document.body;
    return { topic: pageTopic(), anchor: fallback };
  }

  function openDialog(from) {
    var node = from && from.nodeType === 1 ? from : null;
    while (node) {
      if (node.tagName === 'DIALOG' && node.open) return node;
      node = node.parentElement;
    }
    var nodes = document.querySelectorAll('dialog[open]');
    return nodes.length ? nodes[nodes.length - 1] : null;
  }

  function syncToggles() {
    var nodes = document.querySelectorAll('[data-help-toggle]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].setAttribute('aria-pressed', armed ? 'true' : 'false');
    }
  }

  function showHint() {
    if (hint) return;
    hint = document.createElement('div');
    hint.className = 'help-hint';
    hint.textContent = 'Tap something to learn what it does.';
    var dlg = openDialog();
    if (dlg) hint.classList.add('help-hint--in-dialog');
    (dlg || document.body).appendChild(hint);
  }

  function hideHint() {
    if (hint && hint.parentNode) hint.parentNode.removeChild(hint);
    hint = null;
  }

  function setArmed(on) {
    armed = !!on;
    if (document.body) document.body.classList.toggle('help-mode', armed);
    syncToggles();
    if (armed) showHint();
    else hideHint();
  }

  function closePopover() {
    if (outsideTimer) {
      clearTimeout(outsideTimer);
      outsideTimer = 0;
    }
    document.removeEventListener('pointerdown', onOutside, true);
    if (popover && popover.parentNode) popover.parentNode.removeChild(popover);
    popover = null;
  }

  function placePopover(anchor) {
    if (!popover) return;
    var pad = 8;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var rect = anchor && anchor.getBoundingClientRect
      ? anchor.getBoundingClientRect()
      : { left: vw / 2, right: vw / 2, top: vh / 3, bottom: vh / 3, width: 0, height: 0 };
    var box = popover.getBoundingClientRect();
    var w = box.width || Math.min(352, vw - 1.2 * 16);
    var h = box.height || 120;
    var left = rect.left + rect.width / 2 - w / 2;
    if (left < pad) left = pad;
    if (left + w > vw - pad) left = Math.max(pad, vw - pad - w);
    var top = rect.bottom + 10;
    if (top + h > vh - pad && rect.top - 10 - h >= pad) {
      top = rect.top - 10 - h;
    }
    if (top < pad) top = pad;
    if (top + h > vh - pad) top = Math.max(pad, vh - pad - h);
    var parent = popover.parentElement;
    if (parent && parent.tagName === 'DIALOG') {
      popover.style.position = 'absolute';
      var origin = parent.getBoundingClientRect();
      var cs = window.getComputedStyle(parent);
      var borderL = parseFloat(cs.borderLeftWidth) || 0;
      var borderT = parseFloat(cs.borderTopWidth) || 0;
      var room = Math.max(160, parent.clientWidth - pad * 2);
      if (w > room) {
        popover.style.width = Math.round(room) + 'px';
        w = room;
      }
      var relLeft = left - origin.left - borderL;
      if (relLeft < pad) relLeft = pad;
      if (relLeft + w > parent.clientWidth - pad) {
        relLeft = Math.max(pad, parent.clientWidth - pad - w);
      }
      popover.style.left = Math.round(relLeft) + 'px';
      popover.style.top = Math.round(top - origin.top - borderT) + 'px';
      return;
    }
    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }

  function showPopover(topic, anchor) {
    closePopover();
    if (!topic) return;
    var root = document.createElement('div');
    root.className = 'help-popover';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-labelledby', 'helpPopoverTitle');
    var title = document.createElement('h3');
    title.id = 'helpPopoverTitle';
    title.textContent = topic.title || 'Help';
    var body = document.createElement('p');
    body.textContent = topic.body || '';
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'help-popover__close';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '\u2715';
    close.addEventListener('click', closePopover);
    root.appendChild(close);
    root.appendChild(title);
    root.appendChild(body);
    var parent = openDialog(anchor) || document.body;
    parent.appendChild(root);
    popover = root;
    placePopover(anchor);
    outsideTimer = setTimeout(function () {
      outsideTimer = 0;
      document.addEventListener('pointerdown', onOutside, true);
    }, 0);
  }

  function onOutside(e) {
    if (!popover) {
      document.removeEventListener('pointerdown', onOutside, true);
      return;
    }
    if (popover.contains(e.target)) return;
    if (isToggle(e.target)) return;
    closePopover();
    document.removeEventListener('pointerdown', onOutside, true);
  }

  function finishHelp(target) {
    var found = resolve(target);
    setArmed(false);
    swallowUntil = Date.now() + 600;
    showPopover(found.topic, found.anchor);
  }

  function shouldSwallow() {
    return Date.now() <= swallowUntil;
  }

  function onPointerDown(e) {
    if (isToggle(e.target)) return;
    if (!armed) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    finishHelp(e.target);
  }

  function onClick(e) {
    if (isToggle(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      if (armed) {
        setArmed(false);
      } else {
        closePopover();
        setArmed(true);
      }
      swallowUntil = Date.now() + 400;
      return;
    }
    if (armed) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      finishHelp(e.target);
      return;
    }
    if (shouldSwallow()) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      if (armed) {
        setArmed(false);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (popover) {
        closePopover();
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  function init() {
    if (inited) return;
    inited = true;
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  }

  return {
    init: init,
    isArmed: function () {
      return armed;
    }
  };
})();
