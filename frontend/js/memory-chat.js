/* Memory Chat: ask a year of plant history. Every answer is grounded in
 * Hindsight long-term memory via POST /api/memory-chat (RECALL + REFLECT).
 * No blue, no dead controls, theme-aware via CSS vars.
 */
(function () {
  "use strict";

  var CHIPS = [
    "What fixed Weak Seal most reliably last year?",
    "Why did Increase Temperature +5\u00B0C stop working?",
    "Were there more wrinkling incidents during the monsoon?",
    "What changed on the line in February 2026?",
  ];

  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text != null) d.textContent = text;
    return d;
  }

  function esc(s) {
    return String(s == null ? "" : s);
  }

  var log, input, sendBtn, chipsBox;

  function scrollBottom() {
    log.scrollTop = log.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  }

  function addUser(text) {
    var row = el("div", "flex justify-end");
    row.appendChild(el("div",
      "max-w-[85%] px-4 py-3 rounded-2xl rounded-br-md bg-secondary text-on-secondary font-body-md text-body-md",
      text));
    log.appendChild(row);
    scrollBottom();
  }

  function addAssistant(data) {
    var row = el("div", "flex justify-start");
    var card = el("div",
      "max-w-[92%] px-4 py-3 rounded-2xl rounded-bl-md bg-surface-container-lowest border border-outline-variant/40");
    var body = el("div", "font-body-md text-body-md text-on-surface whitespace-pre-wrap",
      data.answer || "The plant's history has no record that answers this yet.");
    card.appendChild(body);

    var meta = el("div", "mt-2 flex flex-wrap items-center gap-2");
    var badge = el("button",
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant/40 font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer",
      "Recalled " + data.longterm_memories_recalled + " long-term memories");
    var dot = el("span", "w-1.5 h-1.5 rounded-full bg-tertiary-fixed");
    badge.prepend(dot);
    meta.appendChild(badge);
    if (data.recent_memories_recalled) {
      meta.appendChild(el("span", "font-label-sm text-label-sm text-on-surface-variant",
        "+ " + data.recent_memories_recalled + " recent records"));
    }
    card.appendChild(meta);

    if (data.samples && data.samples.length) {
      var samples = el("div", "mt-2 hidden flex-col gap-2");
      samples.style.display = "none";
      data.samples.forEach(function (s) {
        var sCard = el("div",
          "p-3 rounded-xl bg-surface-container-low border border-outline-variant/30 font-body-sm text-body-sm text-on-surface-variant");
        sCard.textContent = esc(s.content);
        samples.appendChild(sCard);
      });
      card.appendChild(samples);
      badge.addEventListener("click", function () {
        var open = samples.style.display !== "none";
        samples.style.display = open ? "none" : "flex";
        badge.childNodes[badge.childNodes.length - 1].textContent =
          (open ? "Recalled " : "Hide ") + (open ? data.longterm_memories_recalled + " long-term memories"
                                                 : data.samples.length + " sample memories");
      });
    }
    row.appendChild(card);
    log.appendChild(row);
    scrollBottom();
  }

  function addNotice(text) {
    var row = el("div", "flex justify-center");
    row.appendChild(el("div",
      "px-4 py-2 rounded-full bg-error-container text-on-error-container font-body-sm text-body-sm",
      text));
    log.appendChild(row);
    scrollBottom();
  }

  function addTyping() {
    var row = el("div", "flex justify-start");
    row.id = "mc-typing";
    var b = el("div",
      "px-4 py-3 rounded-2xl rounded-bl-md bg-surface-container-lowest border border-outline-variant/40 flex items-center gap-1.5");
    for (var i = 0; i < 3; i++) {
      var d = el("span", "w-2 h-2 rounded-full bg-on-surface-variant animate-pulse");
      d.style.animationDelay = (i * 0.2) + "s";
      b.appendChild(d);
    }
    var t = el("span", "font-body-sm text-body-sm text-on-surface-variant ml-1",
      "Searching a year of memory\u2026");
    b.appendChild(t);
    row.appendChild(b);
    log.appendChild(row);
    scrollBottom();
    return row;
  }

  var busy = false;
  function ask(question) {
    question = (question || "").trim();
    if (!question || busy) return;
    busy = true;
    sendBtn.disabled = true;
    sendBtn.classList.add("opacity-50");
    addUser(question);
    input.value = "";
    var typing = addTyping();
    window.ValidriftAPI.memoryChat(question).then(function (data) {
      typing.remove();
      if (data && data.ok) {
        addAssistant(data);
      } else {
        addNotice((data && data.message) || "Long-term memory is unavailable right now.");
      }
    }).catch(function (err) {
      typing.remove();
      addNotice("Could not reach the memory service: " + esc(err && err.message || err));
    }).finally(function () {
      busy = false;
      sendBtn.disabled = false;
      sendBtn.classList.remove("opacity-50");
      input.focus();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    log = document.getElementById("mc-log");
    input = document.getElementById("mc-input");
    sendBtn = document.getElementById("mc-send");
    chipsBox = document.getElementById("mc-chips");

    CHIPS.forEach(function (q) {
      var c = el("button",
        "px-3 py-1.5 rounded-full bg-surface-container-lowest border border-outline-variant/40 font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface hover:border-secondary transition-colors cursor-pointer",
        q);
      c.type = "button";
      c.addEventListener("click", function () { ask(q); });
      chipsBox.appendChild(c);
    });

    var welcome = el("div", "flex justify-start");
    var wCard = el("div",
      "max-w-[92%] px-4 py-3 rounded-2xl rounded-bl-md bg-surface-container-lowest border border-outline-variant/40");
    wCard.appendChild(el("div", "font-body-md text-body-md text-on-surface",
      "I remember every incident, fix, and outcome recorded from September 2025 to August 2026 \u2014 " +
      "439 incidents across Sealer-02 and Sealer-01. Ask me what worked, what drifted, and when the line changed. " +
      "Try a suggestion above, or ask your own question."));
    welcome.appendChild(wCard);
    log.appendChild(welcome);

    sendBtn.addEventListener("click", function () { ask(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") ask(input.value);
    });
  });
})();
