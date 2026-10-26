(function () {
  "use strict";

  // ------------------------------------------------------------ constants

  var LEVELS = [
    { id: "new", label: "New", long: "New (never rated)" },
    { id: "not", label: "Don't understand", long: "Don't understand" },
    { id: "partial", label: "Kinda", long: "Kinda understand" },
    { id: "understand", label: "Understand", long: "Understand" }
  ];
  var LEVEL_BY_ID = {};
  LEVELS.forEach(function (l) { LEVEL_BY_ID[l.id] = l; });
  var RATE_KEYS = { "1": "not", "2": "partial", "3": "understand" };
  var PREFS_KEY = "examFlashcards.prefs";

  // ---------------------------------------------------------------- state

  var state = {
    decks: [],
    deckById: {},
    materials: {},
    progress: {},
    selectedDecks: new Set(),
    levels: new Set(LEVELS.map(function (l) { return l.id; }))
  };
  var session = null;

  var $ = function (id) { return document.getElementById(id); };

  // ---------------------------------------------------------------- utils

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k === "html") node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== false && attrs[k] != null) node.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c != null) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function cardKey(deckId, cardId) { return deckId + "::" + cardId; }

  function levelOf(deckId, cardId) {
    var p = state.progress[cardKey(deckId, cardId)];
    return p && p.level ? p.level : "new";
  }

  function api(path, body) {
    var opts = body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    };
    return fetch(path, opts).then(function (r) {
      if (!r.ok) throw new Error(path + " failed (" + r.status + ")");
      return r.json();
    });
  }

  var toastTimer = null;
  function toast(msg, isError) {
    var t = $("toast");
    t.textContent = msg;
    t.className = "toast" + (isError ? " error" : "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, isError ? 6000 : 2500);
  }

  function serverDown(err) {
    console.error(err);
    toast("Can't reach the flashcard server – is start.py still running?", true);
  }

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        decks: Array.from(state.selectedDecks),
        levels: Array.from(state.levels)
      }));
    } catch (e) { /* storage unavailable: preferences just won't be remembered */ }
  }

  function showView(name) {
    ["home", "study", "summary"].forEach(function (v) {
      $("view-" + v).hidden = v !== name;
    });
    document.body.dataset.view = name;
    window.scrollTo(0, 0);
  }

  function materialUrl(doc) {
    return "/files/" + doc.file.split("/").map(encodeURIComponent).join("/");
  }

  function sourceLabel(src) {
    var doc = state.materials[src.doc];
    if (!doc) return src.doc;
    return (doc.kind === "exam" ? "page " : "slide ") + src.page;
  }

  // -------------------------------------------------------------- loading

  function load() {
    return api("/api/state").then(function (data) {
      state.decks = data.decks;
      state.materials = data.materials;
      state.progress = data.progress || {};
      state.deckById = {};
      data.decks.forEach(function (d) { state.deckById[d.id] = d; });

      var prefs = loadPrefs();
      var known = (prefs.decks || []).filter(function (id) { return state.deckById[id]; });
      state.selectedDecks = new Set(known.length ? known : data.decks.map(function (d) { return d.id; }));
      if (prefs.levels && prefs.levels.length) state.levels = new Set(prefs.levels);

      renderErrors(data.errors || []);
      renderHome();
    });
  }

  function renderErrors(errors) {
    var box = $("errors");
    box.innerHTML = "";
    box.hidden = !errors.length;
    if (!errors.length) return;
    box.appendChild(el("strong", { text: "Some deck files have problems (those cards are skipped):" }));
    box.appendChild(el("ul", null, errors.map(function (e) { return el("li", { text: e }); })));
  }

  // ----------------------------------------------------------------- home

  function deckCounts(deck) {
    var c = { new: 0, not: 0, partial: 0, understand: 0 };
    deck.cards.forEach(function (card) { c[levelOf(deck.id, card.id)]++; });
    return c;
  }

  function stackedBar(counts, total) {
    var bar = el("div", { class: "stack" });
    ["understand", "partial", "not", "new"].forEach(function (lvl) {
      if (!counts[lvl]) return;
      bar.appendChild(el("span", {
        class: "seg " + lvl,
        style: "flex-grow:" + counts[lvl],
        title: LEVEL_BY_ID[lvl].long + ": " + counts[lvl] + " of " + total
      }));
    });
    return bar;
  }

  function renderHome() {
    var list = $("deck-list");
    list.innerHTML = "";

    if (!state.decks.length) {
      list.appendChild(el("p", { class: "muted empty", text: "No decks yet. Put deck files (.json) in the decks/ folder and reload this page." }));
    }

    var groups = [];
    var byGroup = {};
    state.decks.forEach(function (d) {
      if (!byGroup[d.group]) { byGroup[d.group] = []; groups.push(d.group); }
      byGroup[d.group].push(d);
    });

    groups.forEach(function (g) {
      var decks = byGroup[g];
      var allOn = decks.every(function (d) { return state.selectedDecks.has(d.id); });
      list.appendChild(el("div", { class: "group-head" }, [
        el("h3", { text: g }),
        el("button", {
          class: "link", text: allOn ? "Deselect group" : "Select group",
          onclick: function () {
            decks.forEach(function (d) { allOn ? state.selectedDecks.delete(d.id) : state.selectedDecks.add(d.id); });
            savePrefs(); renderHome();
          }
        })
      ]));

      decks.forEach(function (deck) {
        var counts = deckCounts(deck);
        var total = deck.cards.length;
        var checked = state.selectedDecks.has(deck.id);
        var input = el("input", { type: "checkbox", checked: checked ? "checked" : false, "aria-label": deck.name });
        input.addEventListener("change", function () {
          input.checked ? state.selectedDecks.add(deck.id) : state.selectedDecks.delete(deck.id);
          savePrefs(); renderHome();
        });
        var legend = el("div", { class: "legend" }, ["not", "partial", "understand", "new"].map(function (lvl) {
          return el("span", { class: "legend-item " + lvl, title: LEVEL_BY_ID[lvl].long },
            [el("i"), String(counts[lvl])]);
        }));
        list.appendChild(el("label", { class: "deck" + (checked ? " on" : "") }, [
          input,
          el("div", { class: "deck-main" }, [
            el("div", { class: "deck-title" }, [
              el("span", { class: "deck-name", text: deck.name }),
              el("span", { class: "deck-count muted", text: total + (total === 1 ? " card" : " cards") })
            ]),
            deck.description ? el("div", { class: "deck-desc muted", text: deck.description }) : null,
            el("div", { class: "deck-progress" }, [stackedBar(counts, total), legend])
          ])
        ]));
      });
    });

    renderFilters();
  }

  function selectedCounts() {
    var c = { new: 0, not: 0, partial: 0, understand: 0 };
    state.decks.forEach(function (d) {
      if (!state.selectedDecks.has(d.id)) return;
      var dc = deckCounts(d);
      Object.keys(c).forEach(function (k) { c[k] += dc[k]; });
    });
    return c;
  }

  function renderFilters() {
    var counts = selectedCounts();
    var box = $("level-filters");
    box.innerHTML = "";
    LEVELS.forEach(function (lvl) {
      var on = state.levels.has(lvl.id);
      box.appendChild(el("button", {
        class: "chip " + lvl.id + (on ? " on" : ""),
        "aria-pressed": on ? "true" : "false",
        onclick: function () {
          on ? state.levels.delete(lvl.id) : state.levels.add(lvl.id);
          savePrefs(); renderFilters();
        }
      }, [el("i", { class: "dot" }), lvl.long, el("span", { class: "chip-count", text: String(counts[lvl.id]) })]));
    });

    var n = buildPool().length;
    var btn = $("start-btn");
    btn.disabled = n === 0;
    btn.textContent = n ? "Start – " + n + (n === 1 ? " card" : " cards") : "Start";
    var info = $("start-info");
    if (!state.selectedDecks.size) info.textContent = "Pick at least one deck.";
    else if (!state.levels.size) info.textContent = "Pick at least one card type.";
    else if (!n) info.textContent = "No cards match – try including more card types.";
    else info.textContent = "Cards are shown in random order.";
  }

  function buildPool() {
    var pool = [];
    state.decks.forEach(function (deck) {
      if (!state.selectedDecks.has(deck.id)) return;
      deck.cards.forEach(function (card) {
        if (state.levels.has(levelOf(deck.id, card.id))) pool.push({ deck: deck, card: card });
      });
    });
    return pool;
  }

  // ---------------------------------------------------------------- study

  function startSession(queue, label) {
    if (!queue.length) { toast("No cards to study."); return; }
    session = {
      queue: shuffle(queue.slice()),
      index: 0,
      flipped: false,
      history: [],          // [{item, level, prev}] in the order rated
      label: label
    };
    showView("study");
    showCard();
  }

  function currentItem() { return session && session.queue[session.index]; }

  function showCard() {
    closeSlide();
    var item = currentItem();
    if (!item) { finishSession(); return; }

    var total = session.queue.length;
    $("progress-text").textContent = (session.index + 1) + " / " + total;
    $("progress-fill").style.width = (session.index / total * 100) + "%";
    $("undo-btn").disabled = session.history.length === 0;

    $("card-deck").textContent = item.deck.name;
    var lvl = levelOf(item.deck.id, item.card.id);
    var badge = $("card-level");
    badge.className = "level-badge " + lvl;
    badge.textContent = lvl === "new" ? "New" : "Last: " + LEVEL_BY_ID[lvl].label;

    $("card-front").innerHTML = window.renderMarkdown(item.card.front);
    $("card-answer").innerHTML = window.renderMarkdown(item.card.back);
    renderSources(item.card.sources);
    setFlipped(session.flipped);
  }

  function setFlipped(flipped) {
    session.flipped = flipped;
    $("card-back").hidden = !flipped;
    $("flip-btn").hidden = flipped;
    $("rate-btns").hidden = !flipped;
    $("card").classList.toggle("flipped", flipped);
  }

  function renderSources(sources) {
    var box = $("card-sources");
    box.innerHTML = "";
    if (!sources || !sources.length) return;
    box.appendChild(el("div", { class: "sources-title", text: sources.length > 1 ? "Sources" : "Source" }));
    sources.forEach(function (src, i) {
      var doc = state.materials[src.doc];
      if (!doc) return;
      box.appendChild(el("div", { class: "source" }, [
        el("span", { class: "source-icon", "aria-hidden": "true", text: doc.kind === "exam" ? "📝" : "📄" }),
        el("div", { class: "source-text" }, [
          el("div", { class: "source-doc", text: doc.title }),
          el("div", { class: "source-page muted", text: sourceLabel(src) + (src.note ? " – " + src.note : "") })
        ]),
        el("button", {
          class: "small",
          title: i === 0 ? "Open (S)" : "Open",
          onclick: function () { openSlide(src); }
        }, ["Open " + (doc.kind === "exam" ? "page" : "slide")])
      ]));
    });
  }

  function flip() {
    if (!session || session.flipped) return;
    setFlipped(true);
  }

  function rate(level) {
    var item = currentItem();
    if (!item || !session.flipped) return;
    var key = cardKey(item.deck.id, item.card.id);
    var prev = state.progress[key] || null;
    var prevReviews = prev ? prev.reviews || 0 : 0;

    // Update locally first so the UI stays snappy; the server confirms below.
    state.progress[key] = { level: level, updated: new Date().toISOString(), reviews: prevReviews + 1 };
    session.history.push({ item: item, level: level, prev: prev });
    session.index++;
    session.flipped = false;
    showCard();

    api("/api/rate", { deck: item.deck.id, card: item.card.id, level: level })
      .then(function (res) { state.progress[res.key] = res.entry; })
      .catch(serverDown);
  }

  function undo() {
    if (!session || !session.history.length) return;
    var last = session.history.pop();
    var key = cardKey(last.item.deck.id, last.item.card.id);
    if (last.prev) state.progress[key] = last.prev; else delete state.progress[key];
    session.index--;
    session.flipped = true;
    showCard();
    api("/api/restore", { deck: last.item.deck.id, card: last.item.card.id, entry: last.prev })
      .catch(serverDown);
  }

  function finishSession() {
    closeSlide();
    var s = session;
    var finalLevel = {};   // card key -> last rating this session
    var finalItem = {};
    s.history.forEach(function (h) {
      var k = cardKey(h.item.deck.id, h.item.card.id);
      finalLevel[k] = h.level;
      finalItem[k] = h.item;
    });
    var counts = { not: 0, partial: 0, understand: 0 };
    Object.keys(finalLevel).forEach(function (k) { counts[finalLevel[k]]++; });
    var rated = Object.keys(finalLevel).length;
    var weak = Object.keys(finalLevel).filter(function (k) { return finalLevel[k] !== "understand"; })
      .map(function (k) { return finalItem[k]; });

    var done = s.index >= s.queue.length;
    $("summary-title").textContent = done ? "Session complete 🎉" : "Session ended";
    $("summary-sub").textContent = done
      ? "You went through all " + s.queue.length + " cards."
      : "You rated " + rated + " of " + s.queue.length + " cards.";

    var stats = $("summary-stats");
    stats.innerHTML = "";
    ["not", "partial", "understand"].forEach(function (lvl) {
      stats.appendChild(el("div", { class: "stat " + lvl }, [
        el("div", { class: "stat-num", text: String(counts[lvl]) }),
        el("div", { class: "stat-label", text: LEVEL_BY_ID[lvl].long })
      ]));
    });

    var repeat = $("repeat-btn");
    repeat.hidden = weak.length === 0;
    repeat.textContent = "Repeat the " + weak.length + " card" + (weak.length === 1 ? "" : "s") + " I didn't fully get";
    repeat.onclick = function () { startSession(weak, "repeat"); };

    session = null;
    showView("summary");
  }

  function endSession() {
    if (!session) return;
    if (!session.history.length) { session = null; goHome(); return; }
    finishSession();
  }

  function goHome() {
    session = null;
    closeSlide();
    renderHome();
    showView("home");
  }

  // ---------------------------------------------------------- slide panel

  function openSlide(src) {
    var doc = state.materials[src.doc];
    if (!doc) return;
    var url = materialUrl(doc);
    // page/view/navpanes are read by Chrome & Edge, page/zoom/pagemode by Firefox.
    var withPage = url + "#page=" + src.page + "&view=Fit&navpanes=0&zoom=page-fit&pagemode=none";
    $("slide-title").textContent = doc.title + " · " + sourceLabel(src);
    $("slide-newtab").href = url + "#page=" + src.page;
    // A fresh iframe every time: browsers ignore #page changes on an already-loaded PDF.
    var frameBox = $("slide-frame");
    frameBox.innerHTML = "";
    frameBox.appendChild(el("iframe", { src: withPage, title: doc.title }));
    $("slide-panel").hidden = false;
    $("study-layout").classList.add("with-slide");
  }

  function closeSlide() {
    var panel = $("slide-panel");
    if (panel.hidden) return false;
    panel.hidden = true;
    $("slide-frame").innerHTML = "";
    $("study-layout").classList.remove("with-slide");
    return true;
  }

  // ---------------------------------------------------------------- reset

  function openReset() {
    var n = state.selectedDecks.size;
    var sel = $("reset-selected");
    sel.disabled = n === 0;
    sel.textContent = "Reset the " + n + " selected deck" + (n === 1 ? "" : "s");
    var dialog = $("reset-dialog");
    dialog.returnValue = "";  // closing with Esc keeps the old value otherwise
    dialog.showModal();
  }

  function onResetClose() {
    var choice = $("reset-dialog").returnValue;
    if (choice !== "selected" && choice !== "all") return;
    var body = choice === "all" ? {} : { decks: Array.from(state.selectedDecks) };
    api("/api/reset", body).then(function (res) {
      toast("Progress reset (" + res.removed + " card" + (res.removed === 1 ? "" : "s") + " back to new).");
      return load();
    }).catch(serverDown);
  }

  // ------------------------------------------------------------- keyboard

  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ($("reset-dialog").open) return;
    var tag = (e.target && e.target.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    if (document.body.dataset.view === "study" && session) {
      var k = e.key;
      if (k === " " || k === "Enter") {
        e.preventDefault();
        flip();
      } else if (RATE_KEYS[k] && session.flipped) {
        e.preventDefault();
        rate(RATE_KEYS[k]);
      } else if (k === "s" || k === "S") {
        var item = currentItem();
        if (item && item.card.sources.length) {
          e.preventDefault();
          if (!session.flipped) setFlipped(true);
          openSlide(item.card.sources[0]);
        }
      } else if (k === "u" || k === "U" || k === "Backspace") {
        e.preventDefault();
        undo();
      } else if (k === "Escape") {
        e.preventDefault();
        if (!closeSlide()) endSession();
      }
    }
  }

  // ----------------------------------------------------------------- wire

  function init() {
    $("brand").addEventListener("click", function () {
      if (session) endSession(); else goHome();
    });
    $("sel-all").addEventListener("click", function () {
      state.decks.forEach(function (d) { state.selectedDecks.add(d.id); });
      savePrefs(); renderHome();
    });
    $("sel-none").addEventListener("click", function () {
      state.selectedDecks.clear();
      savePrefs(); renderHome();
    });
    $("start-btn").addEventListener("click", function () { startSession(buildPool(), "main"); });
    $("flip-btn").addEventListener("click", flip);
    Array.prototype.forEach.call(document.querySelectorAll("#rate-btns button"), function (b) {
      b.addEventListener("click", function () { b.blur(); rate(b.dataset.level); });
    });
    $("undo-btn").addEventListener("click", function () { $("undo-btn").blur(); undo(); });
    $("end-btn").addEventListener("click", endSession);
    $("slide-close").addEventListener("click", closeSlide);
    $("again-btn").addEventListener("click", function () {
      var pool = buildPool();
      if (!pool.length) { toast("No cards match your filters any more – pick other card types."); goHome(); return; }
      startSession(pool, "main");
    });
    $("home-btn").addEventListener("click", goHome);
    $("reset-open").addEventListener("click", openReset);
    $("reset-dialog").addEventListener("close", onResetClose);
    document.addEventListener("keydown", onKey);

    showView("home");
    load().catch(serverDown);
  }

  init();
})();
