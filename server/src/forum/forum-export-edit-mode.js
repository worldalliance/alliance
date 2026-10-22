(function () {
  "use strict";

  var STORAGE_KEY = "allianceForumAdminEdits:v1";

  var ADMIN_CSS =
    "\n" +
    "/* --- admin edit mode (hidden from the printed/PDF export) --- */\n" +
    ".admin-bar { position: sticky; top: 0; z-index: 10; display: flex;\n" +
    "  align-items: center; gap: .75rem; flex-wrap: wrap; background: #14181d;\n" +
    "  color: #e4e4e7; font-size: .8125rem; padding: .6rem 1.25rem; }\n" +
    ".admin-bar strong { color: #fff; }\n" +
    ".admin-bar button { font: inherit; color: inherit; background: #3f3f46;\n" +
    "  border: 1px solid #52525b; border-radius: .3rem; padding: .2rem .6rem;\n" +
    "  cursor: pointer; }\n" +
    ".admin-bar button:hover { background: #52525b; }\n" +
    ".admin-count { color: #a1a1aa; }\n" +
    ".author { cursor: pointer; border-bottom: 1px dotted transparent;\n" +
    "  border-radius: .15rem; }\n" +
    ".author:hover { border-bottom-color: currentColor; background: #fef9c3; }\n" +
    ".avatar { cursor: pointer; }\n" +
    ".avatar:hover { box-shadow: inset 0 0 0 1px #d4d4d8, 0 0 0 2px #62a124; }\n" +
    ".avatar svg { position: absolute; inset: 0; width: 100%; height: 100%; }\n" +
    ".admin-rename-input { font: inherit; color: inherit; background: #fff;\n" +
    "  border: 1px solid var(--link); border-radius: .2rem; padding: 0 .25rem;\n" +
    "  max-width: 12rem; }\n" +
    ".admin-promote { margin-left: auto; display: inline-flex; align-items: center;\n" +
    "  border: none; background: none; color: #a1a1aa; cursor: pointer;\n" +
    "  padding: 0 .2rem; }\n" +
    ".admin-promote svg { width: 1rem; height: 1rem; }\n" +
    ".admin-promote:hover { color: var(--link); }\n" +
    ".admin-close { border: none; background: none;\n" +
    "  color: #a1a1aa; font-size: 1rem; line-height: 1; cursor: pointer;\n" +
    "  padding: 0 .2rem; }\n" +
    ".admin-close:hover { color: #dc2626; }\n" +
    ".hidden-note { list-style: none; }\n" +
    "@media print {\n" +
    "  .admin-bar, .admin-promote, .admin-close { display: none !important; }\n" +
    "}\n";

  var ADMIN_BAR_HTML =
    "" +
    "<strong>Admin edit mode</strong>" +
    "<span>Click a name to rename it &middot; click an avatar to anonymize it &middot; " +
    "click &uarr; to move a comment to the top of its list &middot; " +
    "click &times; to remove a comment. " +
    "<strong>When you&rsquo;re done, use your browser&rsquo;s Print command to &ldquo;Save as PDF.&rdquo;</strong></span>" +
    '<span class="admin-count" id="admin-edit-count"></span>' +
    '<button type="button" id="admin-reset">Reset all edits</button>';

  var GRADIENTS = [
    ["#F97316", "#FACC15"],
    ["#6366F1", "#EC4899"],
    ["#10B981", "#3B82F6"],
    ["#F43F5E", "#F97316"],
    ["#0EA5E9", "#8B5CF6"],
    ["#22C55E", "#14B8A6"],
    ["#A855F7", "#6366F1"],
    ["#F59E0B", "#EF4444"],
    ["#84CC16", "#0EA5E9", "#6366F1"],
    ["#FB7185", "#FBBF24", "#34D399"],
  ];
  var gradientCursor = Math.floor(Math.random() * GRADIENTS.length);

  var state = loadState();

  function loadState() {
    var fallback = {
      names: {},
      avatars: {},
      removedTop: [],
      removedNested: [],
      order: {},
    };
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return {
        names: parsed.names || {},
        avatars: parsed.avatars || {},
        removedTop: parsed.removedTop || [],
        removedNested: parsed.removedNested || [],
        order: parsed.order || {},
      };
    } catch (e) {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {}
    updateEditCount();
  }

  function updateEditCount() {
    var el = document.getElementById("admin-edit-count");
    if (!el) return;
    var n =
      Object.keys(state.names).length +
      Object.keys(state.avatars).length +
      state.removedTop.length +
      state.removedNested.length +
      Object.keys(state.order).length;
    el.textContent = n
      ? "(" + n + " saved edit" + (n === 1 ? "" : "s") + ")"
      : "(no edits yet)";
  }

  // --- give every byline's name + avatar a stable key tied to the name the
  // page shipped with, so a rename or avatar swap can find every occurrence
  // of that same person even after earlier renames have changed their text.
  function assignUserKeys() {
    document.querySelectorAll(".byline").forEach(function (byline) {
      var author = byline.querySelector(".author");
      var avatar = byline.querySelector(".avatar");
      if (!author) return;
      var key = author.textContent;
      author.dataset.userKey = key;
      if (avatar) avatar.dataset.userKey = key;
    });
  }

  // A real comment <li> - excludes the synthetic "And N other comments" note,
  // which also carries the .comment class so it inherits its spacing/type size.
  function isCommentLi(el) {
    return (
      el.tagName === "LI" &&
      el.classList.contains("comment") &&
      el.id !== "hidden-comments-note"
    );
  }

  function findNestedThread(li) {
    return Array.prototype.find.call(li.children, function (el) {
      return el.tagName === "OL" && el.classList.contains("thread");
    });
  }

  // --- give every comment a stable path id ("0", "0.1", "0.1.0", ...)
  // reflecting its position in the thread tree the page shipped with, so
  // closed/promoted comments stay that way across reloads even once
  // promotions have shuffled their visible order.
  function assignCommentIds() {
    var root = document.querySelector("section.comments > ol.thread");
    if (!root) return;
    (function walk(ol, prefix) {
      var items = Array.prototype.filter.call(ol.children, isCommentLi);
      items.forEach(function (li, i) {
        var id = prefix ? prefix + "." + i : String(i);
        li.dataset.commentId = id;
        li.dataset.topLevel = prefix ? "false" : "true";
        var nested = findNestedThread(li);
        if (nested) walk(nested, id);
      });
    })(root, "");
  }

  // Identifies a comment's own reply list (or the root list, for a
  // top-level comment) by the stable id of the comment that contains it -
  // used as the key under which we persist that list's display order.
  function getListKey(ol) {
    var parent = ol.parentElement;
    if (parent && parent.classList && parent.classList.contains("comment")) {
      return parent.dataset.commentId;
    }
    return "root";
  }

  function recordOrder(ol) {
    var key = getListKey(ol);
    state.order[key] = Array.prototype.filter
      .call(ol.children, isCommentLi)
      .map(function (li) {
        return li.dataset.commentId;
      });
  }

  // Reapplies any saved display order by re-appending each listed comment in
  // turn - appendChild on a node already in the document just moves it, so
  // walking the saved order into place also leaves any unlisted sibling
  // (there shouldn't be any, since recordOrder always saves a full list)
  // exactly where it already was.
  function applyOrder() {
    Object.keys(state.order).forEach(function (key) {
      var ol;
      if (key === "root") {
        ol = document.querySelector("section.comments > ol.thread");
      } else {
        var parentLi = document.querySelector(
          'li.comment[data-comment-id="' + cssEscape(key) + '"]',
        );
        ol = parentLi && findNestedThread(parentLi);
      }
      if (!ol) return;
      state.order[key].forEach(function (id) {
        var li = Array.prototype.find.call(ol.children, function (el) {
          return isCommentLi(el) && el.dataset.commentId === id;
        });
        if (li) ol.appendChild(li);
      });
    });
  }

  function svgGradient(colors) {
    var id = "g" + Math.random().toString(36).slice(2, 9);
    var stops = colors
      .map(function (c, i) {
        var offset = colors.length > 1 ? (i / (colors.length - 1)) * 100 : 0;
        return '<stop offset="' + offset + '%" stop-color="' + c + '"/>';
      })
      .join("");
    return (
      '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
      '<defs><linearGradient id="' +
      id +
      '" x1="0" y1="0" x2="1" y2="1">' +
      stops +
      "</linearGradient></defs>" +
      '<rect width="100" height="100" fill="url(#' +
      id +
      ')"/></svg>'
    );
  }

  function applyNameToPage(key, value) {
    document.querySelectorAll(".author").forEach(function (el) {
      if (el.dataset.userKey === key) el.textContent = value;
    });
  }

  function applyAvatarToPage(key, colors) {
    document.querySelectorAll(".avatar").forEach(function (el) {
      if (el.dataset.userKey === key) el.innerHTML = svgGradient(colors);
    });
  }

  function applySavedState() {
    Object.keys(state.names).forEach(function (key) {
      applyNameToPage(key, state.names[key]);
    });
    Object.keys(state.avatars).forEach(function (key) {
      applyAvatarToPage(key, state.avatars[key]);
    });
    state.removedNested.forEach(removeCommentById);
    state.removedTop.forEach(removeCommentById);
    applyOrder();
    updateHiddenNote();
  }

  function removeCommentById(id) {
    var li = document.querySelector(
      'li.comment[data-comment-id="' + cssEscape(id) + '"]',
    );
    if (li) li.remove();
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape
      ? CSS.escape(value)
      : value.replace(/["\\]/g, "\\$&");
  }

  function updateHiddenNote() {
    var root = document.querySelector("section.comments > ol.thread");
    if (!root) return;
    var note = document.getElementById("hidden-comments-note");
    var n = state.removedTop.length;
    if (n === 0) {
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement("li");
      note.id = "hidden-comments-note";
      note.className = "comment empty hidden-note";
      root.appendChild(note);
    } else {
      root.appendChild(note); // keep it pinned to the bottom
    }
    note.textContent = "And " + n + " other comment" + (n === 1 ? "" : "s");
  }

  function addActionButtons() {
    document.querySelectorAll("li.comment").forEach(function (li) {
      var byline = li.querySelector(":scope > .byline");
      if (!byline) return;
      if (!byline.querySelector(":scope > .admin-promote")) {
        var promoteBtn = document.createElement("button");
        promoteBtn.type = "button";
        promoteBtn.className = "admin-promote";
        promoteBtn.title = "Move to top of list";
        promoteBtn.setAttribute("aria-label", "Move to top of list");
        promoteBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
          'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 7-7 7 7"/>' +
          '<path d="M12 19V5"/></svg>';
        byline.appendChild(promoteBtn);
      }
      if (!byline.querySelector(":scope > .admin-close")) {
        var closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "admin-close";
        closeBtn.title = "Remove this comment";
        closeBtn.setAttribute("aria-label", "Remove this comment");
        closeBtn.textContent = "\u00d7";
        byline.appendChild(closeBtn);
      }
    });
  }

  function handleClose(li) {
    var id = li.dataset.commentId;
    var isTop = li.dataset.topLevel === "true";
    li.remove();
    if (!id) {
      saveState();
      return;
    }
    if (isTop) {
      state.removedTop.push(id);
      updateHiddenNote();
    } else {
      state.removedNested.push(id);
    }
    saveState();
  }

  function handlePromote(li) {
    var parent = li.parentNode;
    if (!parent) return;
    parent.insertBefore(li, parent.firstChild);
    recordOrder(parent);
    saveState();
  }

  function startRename(nameEl) {
    var key = nameEl.dataset.userKey;
    var current = nameEl.textContent;
    var input = document.createElement("input");
    input.type = "text";
    input.className = "admin-rename-input";
    input.value = current;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    var done = false;
    function commit() {
      if (done) return;
      done = true;
      var value = input.value.trim() || current;
      input.replaceWith(nameEl);
      if (value !== current) {
        state.names[key] = value;
        applyNameToPage(key, value);
        saveState();
      }
    }
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
      if (e.key === "Escape") {
        input.value = current;
        input.blur();
      }
    });
  }

  function randomizeAvatar(avatarEl) {
    var key = avatarEl.dataset.userKey;
    var colors = GRADIENTS[gradientCursor % GRADIENTS.length];
    gradientCursor++;
    state.avatars[key] = colors;
    applyAvatarToPage(key, colors);
    saveState();
  }

  function attachHandlers() {
    document.body.addEventListener("click", function (e) {
      var closeBtn = e.target.closest(".admin-close");
      if (closeBtn) {
        var closeLi = closeBtn.closest("li.comment");
        if (closeLi) handleClose(closeLi);
        return;
      }
      var promoteBtn = e.target.closest(".admin-promote");
      if (promoteBtn) {
        var promoteLi = promoteBtn.closest("li.comment");
        if (promoteLi) handlePromote(promoteLi);
        return;
      }
      var avatarEl = e.target.closest(".avatar");
      if (avatarEl) {
        randomizeAvatar(avatarEl);
        return;
      }
      var nameEl = e.target.closest(".author");
      if (nameEl) {
        startRename(nameEl);
        return;
      }
    });

    var resetBtn = document.getElementById("admin-reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (
          !window.confirm(
            "Discard all saved renames, avatar swaps, and removed comments?",
          )
        )
          return;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}
        location.reload();
      });
    }
  }

  function injectStyles() {
    var style = document.createElement("style");
    style.id = "admin-edit-mode-styles";
    style.textContent = ADMIN_CSS;
    document.head.appendChild(style);
  }

  function injectAdminBar() {
    var bar = document.createElement("div");
    bar.className = "admin-bar";
    bar.id = "admin-bar";
    bar.innerHTML = ADMIN_BAR_HTML;
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function init() {
    injectStyles();
    injectAdminBar();
    assignUserKeys();
    assignCommentIds();
    applySavedState();
    addActionButtons();
    attachHandlers();
    updateEditCount();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
