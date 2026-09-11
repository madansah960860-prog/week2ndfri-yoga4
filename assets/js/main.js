/* ==========================================================================
   Aruna Yoga Method - shared behavior
   Vanilla JS, no dependencies, no build step.
   Every module guards for its own markup so one file serves every page.
   ========================================================================== */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ------------------------------------------------------------------
     1. Header. Tucks away while reading down, returns on scroll-up.
     rAF throttled so the scroll handler never runs layout per frame.
     ------------------------------------------------------------------ */
  (function header() {
    var head = $('#siteHead');
    if (!head) return;
    var last = window.pageYOffset;
    var ticking = false;

    function update() {
      var y = window.pageYOffset;
      var goingDown = y > last;
      head.classList.toggle('is-stuck', y > 8);
      if (y > 160 && goingDown && !document.body.classList.contains('nav-open')) {
        head.classList.add('is-tucked');
      } else {
        head.classList.remove('is-tucked');
      }
      last = y < 0 ? 0 : y;
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  })();

  /* ------------------------------------------------------------------
     2. Mobile menu and dropdowns
     ------------------------------------------------------------------ */
  (function nav() {
    var burger = $('#burger');
    var nav = $('#nav');
    if (burger && nav) {
      burger.addEventListener('click', function () {
        var open = burger.getAttribute('aria-expanded') === 'true';
        burger.setAttribute('aria-expanded', String(!open));
        burger.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
        nav.classList.toggle('is-open', !open);
        document.body.classList.toggle('nav-open', !open);
      });
    }

    $$('.has-menu').forEach(function (item) {
      var btn = $('.nav-toggle', item);
      if (!btn) return;

      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var open = item.classList.contains('is-open');
        $$('.has-menu.is-open').forEach(function (o) {
          if (o !== item) { o.classList.remove('is-open'); $('.nav-toggle', o).setAttribute('aria-expanded', 'false'); }
        });
        item.classList.toggle('is-open', !open);
        btn.setAttribute('aria-expanded', String(!open));
      });

      // Pointer users get hover on desktop widths only.
      item.addEventListener('mouseenter', function () {
        if (window.innerWidth >= 1024) { item.classList.add('is-open'); btn.setAttribute('aria-expanded', 'true'); }
      });
      item.addEventListener('mouseleave', function () {
        if (window.innerWidth >= 1024) { item.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.has-menu.is-open').forEach(function (o) {
        o.classList.remove('is-open');
        $('.nav-toggle', o).setAttribute('aria-expanded', 'false');
      });
      if (nav && nav.classList.contains('is-open') && burger) { burger.click(); burger.focus(); }
    });

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.has-menu')) return;
      $$('.has-menu.is-open').forEach(function (o) {
        o.classList.remove('is-open');
        $('.nav-toggle', o).setAttribute('aria-expanded', 'false');
      });
    });
  })();

  /* ------------------------------------------------------------------
     3. Reveal on scroll. Enhancement only; content ships visible
        without JS because .reveal is opaque until html.js is set.
     ------------------------------------------------------------------ */
  (function reveal() {
    var items = $$('.reveal');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  })();

  /* ------------------------------------------------------------------
     4. Accordions
     ------------------------------------------------------------------ */
  (function accordions() {
    $$('.acc-btn').forEach(function (btn) {
      var panel = document.getElementById(btn.getAttribute('aria-controls'));
      if (!panel) return;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.style.maxHeight = open ? null : panel.scrollHeight + 'px';
      });
    });
    window.addEventListener('resize', function () {
      $$('.acc-btn[aria-expanded="true"]').forEach(function (btn) {
        var panel = document.getElementById(btn.getAttribute('aria-controls'));
        if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
      });
    });
  })();

  /* ------------------------------------------------------------------
     5. Back to top
     ------------------------------------------------------------------ */
  (function toTop() {
    var btn = $('#toTop');
    if (!btn) return;
    var ticking = false;
    function check() {
      btn.classList.toggle('is-shown', window.pageYOffset > 900);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { window.requestAnimationFrame(check); ticking = true; }
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var skip = $('.skip');
      if (skip) skip.focus();
    });
  })();

  /* ------------------------------------------------------------------
     6. Signature detail: the amber hold timer.
        Counts a pose hold down and dims the page as it runs, so a long
        hold physically lowers the light in the room.
        No non-essential cookies here; state is session-only.
     ------------------------------------------------------------------ */
  (function holdTimer() {
    var root = $('#holdTimer');
    if (!root) return;

    var readout  = $('#holdReadout', root);
    var fill     = $('#holdFill', root);
    var startBtn = $('#holdStart', root);
    var resetBtn = $('#holdReset', root);
    var dimBox   = $('#holdDimToggle', root);
    var collapse = $('#holdCollapse', root);
    var dimmer   = $('#hold-dim');
    var presets  = $$('.hold-presets button', root);

    var total = 60;
    var left = 60;
    var running = false;
    var tick = null;

    function fmt(s) {
      var m = Math.floor(s / 60);
      var r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function paint() {
      readout.textContent = fmt(left);
      var done = (total - left) / total;
      fill.style.width = (done * 100).toFixed(1) + '%';
      if (dimmer) {
        dimmer.style.opacity = (dimBox && dimBox.checked && running) ? (done * 0.55).toFixed(3) : 0;
      }
    }

    function stop() {
      running = false;
      root.classList.remove('is-running');
      startBtn.textContent = 'Start';
      if (tick) { clearInterval(tick); tick = null; }
      if (dimmer) dimmer.style.opacity = 0;
    }

    function run() {
      running = true;
      root.classList.add('is-running');
      startBtn.textContent = 'Pause';
      tick = setInterval(function () {
        left -= 1;
        if (left <= 0) {
          left = 0;
          paint();
          stop();
          readout.textContent = 'rest';
          return;
        }
        paint();
      }, 1000);
    }

    startBtn.addEventListener('click', function () {
      if (running) { stop(); paint(); return; }
      if (left <= 0) { left = total; }
      paint();
      run();
    });

    resetBtn.addEventListener('click', function () {
      stop();
      left = total;
      paint();
    });

    presets.forEach(function (b) {
      b.addEventListener('click', function () {
        presets.forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        total = parseInt(b.getAttribute('data-seconds'), 10) || 60;
        stop();
        left = total;
        paint();
      });
    });

    if (dimBox) {
      dimBox.addEventListener('change', function () {
        if (!dimBox.checked && dimmer) dimmer.style.opacity = 0;
      });
    }

    if (collapse) {
      collapse.addEventListener('click', function () {
        var isCollapsed = root.classList.toggle('is-collapsed');
        collapse.setAttribute('aria-expanded', String(!isCollapsed));
        collapse.textContent = isCollapsed ? '+' : '−';
      });
    }

    // Any "hold this pose" link on the page can load its own duration.
    $$('[data-hold-seconds]').forEach(function (trigger) {
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        total = parseInt(trigger.getAttribute('data-hold-seconds'), 10) || 60;
        presets.forEach(function (o) {
          o.setAttribute('aria-pressed', String(parseInt(o.getAttribute('data-seconds'), 10) === total));
        });
        stop();
        left = total;
        paint();
        run();
      });
    });

    paint();
  })();

  /* ------------------------------------------------------------------
     7. Breath pacer. Four count in, six count out by default.
     ------------------------------------------------------------------ */
  (function pacer() {
    var root = $('#pacer');
    if (!root) return;
    var orb = $('#pacerOrb', root);
    var phase = $('#pacerPhase', root);
    var btn = $('#pacerBtn', root);
    var inMs = parseInt(root.getAttribute('data-in') || '4', 10) * 1000;
    var outMs = parseInt(root.getAttribute('data-out') || '6', 10) * 1000;
    var timer = null;
    var on = false;

    orb.style.transitionDuration = inMs + 'ms';

    function breatheIn() {
      orb.style.transitionDuration = inMs + 'ms';
      orb.classList.add('is-in');
      phase.textContent = 'Breathe in';
      timer = setTimeout(breatheOut, inMs);
    }
    function breatheOut() {
      orb.style.transitionDuration = outMs + 'ms';
      orb.classList.remove('is-in');
      phase.textContent = 'Breathe out';
      timer = setTimeout(breatheIn, outMs);
    }

    btn.addEventListener('click', function () {
      on = !on;
      btn.textContent = on ? 'Stop pacer' : 'Start pacer';
      btn.setAttribute('aria-pressed', String(on));
      if (on) {
        breatheIn();
      } else {
        clearTimeout(timer);
        orb.classList.remove('is-in');
        phase.textContent = 'Paused';
      }
    });
  })();

  /* ------------------------------------------------------------------
     8. Sequence player. Steps come from the printed list so the page
        works with JS off, and the player just reads the same data.
     ------------------------------------------------------------------ */
  (function player() {
    var root = $('#player');
    if (!root) return;

    var steps = $$('#playerSteps li');
    if (!steps.length) return;

    var nameEl = $('#playerNow', root);
    var sansEl = $('#playerSans', root);
    var clock  = $('#playerClock', root);
    var playBtn = $('#playerPlay', root);
    var nextBtn = $('#playerNext', root);
    var prevBtn = $('#playerPrev', root);
    var resetBtn = $('#playerReset', root);

    var i = 0;
    var left = 0;
    var running = false;
    var tick = null;

    function fmt(s) {
      var m = Math.floor(s / 60), r = s % 60;
      return m + ':' + (r < 10 ? '0' : '') + r;
    }

    function load(index) {
      i = Math.max(0, Math.min(index, steps.length - 1));
      steps.forEach(function (s, n) { s.classList.toggle('is-current', n === i); });
      var s = steps[i];
      nameEl.textContent = s.getAttribute('data-name') || '';
      sansEl.textContent = s.getAttribute('data-sanskrit') || '';
      left = parseInt(s.getAttribute('data-hold'), 10) || 30;
      clock.textContent = fmt(left);
    }

    function stop() {
      running = false;
      playBtn.textContent = 'Play';
      if (tick) { clearInterval(tick); tick = null; }
    }

    function play() {
      running = true;
      playBtn.textContent = 'Pause';
      tick = setInterval(function () {
        left -= 1;
        if (left <= 0) {
          if (i < steps.length - 1) { load(i + 1); return; }
          stop();
          clock.textContent = 'done';
          nameEl.textContent = 'Practice complete';
          sansEl.textContent = '';
          return;
        }
        clock.textContent = fmt(left);
      }, 1000);
    }

    playBtn.addEventListener('click', function () { running ? stop() : play(); });
    nextBtn.addEventListener('click', function () { var was = running; stop(); load(i + 1); if (was) play(); });
    prevBtn.addEventListener('click', function () { var was = running; stop(); load(i - 1); if (was) play(); });
    resetBtn.addEventListener('click', function () { stop(); load(0); });

    // Steps are selectable by pointer and by keyboard. They are list items
    // rather than buttons so the printed sheet stays a plain checklist.
    steps.forEach(function (s, n) {
      function select() { var was = running; stop(); load(n); if (was) play(); }
      s.setAttribute('tabindex', '0');
      s.setAttribute('role', 'button');
      s.setAttribute('aria-label', 'Go to ' + (s.getAttribute('data-name') || 'this step'));
      s.style.cursor = 'pointer';
      s.addEventListener('click', select);
      s.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); select(); }
      });
    });

    load(0);
  })();

  /* ------------------------------------------------------------------
     9. Pose library filter. Difficulty, body area, prop.
     ------------------------------------------------------------------ */
  (function poseFilter() {
    var root = $('#poseFilters');
    if (!root) return;
    var rows = $$('#poseList .pose-row');
    var count = $('#poseCount');
    var search = $('#poseSearch');
    var state = { level: 'all', area: 'all', prop: 'all', q: '' };

    function apply() {
      var shown = 0;
      rows.forEach(function (row) {
        var okLevel = state.level === 'all' || (row.getAttribute('data-level') || '') === state.level;
        var okArea  = state.area === 'all' || (row.getAttribute('data-area') || '').indexOf(state.area) > -1;
        var okProp  = state.prop === 'all' || (row.getAttribute('data-prop') || '').indexOf(state.prop) > -1;
        var okQ     = !state.q || (row.textContent || '').toLowerCase().indexOf(state.q) > -1;
        var ok = okLevel && okArea && okProp && okQ;
        row.classList.toggle('is-hidden', !ok);
        if (ok) shown++;
      });
      if (count) {
        count.textContent = shown === rows.length
          ? 'Showing all ' + rows.length + ' poses'
          : 'Showing ' + shown + ' of ' + rows.length + ' poses';
      }
    }

    $$('.chip', root).forEach(function (chip) {
      chip.addEventListener('click', function () {
        var group = chip.getAttribute('data-group');
        $$('.chip[data-group="' + group + '"]', root).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        chip.setAttribute('aria-pressed', 'true');
        state[group] = chip.getAttribute('data-value');
        apply();
      });
    });

    if (search) {
      search.addEventListener('input', function () {
        state.q = search.value.trim().toLowerCase();
        apply();
      });
    }

    var clear = $('#poseClear');
    if (clear) {
      clear.addEventListener('click', function () {
        state = { level: 'all', area: 'all', prop: 'all', q: '' };
        if (search) search.value = '';
        $$('.chip', root).forEach(function (c) {
          c.setAttribute('aria-pressed', String(c.getAttribute('data-value') === 'all'));
        });
        apply();
      });
    }

    apply();
  })();

  /* ------------------------------------------------------------------
     10. Forms. Inline validation, errors next to the field.
     ------------------------------------------------------------------ */
  (function forms() {
    var forms = $$('form[data-validate]');
    if (!forms.length) return;

    var emailRe = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

    function errorFor(field) {
      var id = field.getAttribute('aria-describedby');
      return id ? document.getElementById(id.split(' ').filter(function (x) { return x.indexOf('err-') === 0; })[0] || id) : null;
    }

    function validate(field) {
      var msg = '';
      var val = (field.value || '').trim();
      var label = field.getAttribute('data-label') || 'This field';

      if (field.hasAttribute('required')) {
        if (field.type === 'checkbox' && !field.checked) msg = 'Please confirm to continue.';
        else if (!val && field.type !== 'checkbox') msg = label + ' is required.';
      }
      if (!msg && val && field.type === 'email' && !emailRe.test(val)) {
        msg = 'Enter an email address in the format name@example.com.';
      }
      if (!msg && val && field.type === 'tel' && !/^[0-9()+\-.\s]{7,}$/.test(val)) {
        msg = 'Enter a phone number, for example +1 (555) 555-0100.';
      }
      if (!msg && field.hasAttribute('minlength') && val && val.length < parseInt(field.getAttribute('minlength'), 10)) {
        msg = label + ' needs at least ' + field.getAttribute('minlength') + ' characters.';
      }

      var errEl = errorFor(field);
      if (errEl) errEl.textContent = msg;
      field.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    }

    forms.forEach(function (form) {
      var fields = $$('[data-label], [required]', form).filter(function (f) {
        return ['INPUT', 'TEXTAREA', 'SELECT'].indexOf(f.tagName) > -1;
      });

      fields.forEach(function (f) {
        f.addEventListener('blur', function () { validate(f); });
        f.addEventListener('input', function () {
          if (f.getAttribute('aria-invalid') === 'true') validate(f);
        });
      });

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        var first = null;
        fields.forEach(function (f) {
          var good = validate(f);
          if (!good && !first) first = f;
          ok = ok && good;
        });
        var status = $('.form-status', form);
        if (!ok) {
          if (first) first.focus();
          if (status) {
            status.classList.add('is-shown');
            status.textContent = 'Please correct the highlighted fields and send again.';
          }
          return;
        }
        if (status) {
          status.classList.add('is-shown');
          status.textContent = form.getAttribute('data-success') ||
            'Thank you. Your message has been queued for our team and you will hear back within two business days.';
        }
        form.reset();
        fields.forEach(function (f) { f.setAttribute('aria-invalid', 'false'); var er = errorFor(f); if (er) er.textContent = ''; });
      });
    });
  })();

  /* ------------------------------------------------------------------
     11. Cookie consent. No non-essential cookies before a choice.
     ------------------------------------------------------------------ */
  (function cookies() {
    var bar = $('#cookieBar');
    if (!bar) return;
    var KEY = 'aruna_consent_v1';
    var stored = null;
    try { stored = window.localStorage.getItem(KEY); } catch (err) { stored = null; }

    if (!stored) {
      // Delay slightly so it never competes with first paint or shifts layout.
      window.setTimeout(function () { bar.classList.add('is-shown'); }, 900);
    }

    function save(value) {
      try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch (err) { /* storage blocked */ }
      bar.classList.remove('is-shown');
    }

    var accept = $('#ckAccept', bar);
    var reject = $('#ckReject', bar);
    var manage = $('#ckManage', bar);
    var prefs  = $('#ckPrefs', bar);
    var savePrefs = $('#ckSave', bar);

    if (accept) accept.addEventListener('click', function () { save({ analytics: true, ads: true, at: Date.now() }); });
    if (reject) reject.addEventListener('click', function () { save({ analytics: false, ads: false, at: Date.now() }); });
    if (manage) manage.addEventListener('click', function () {
      var open = prefs.classList.toggle('is-shown');
      manage.setAttribute('aria-expanded', String(open));
    });
    if (savePrefs) savePrefs.addEventListener('click', function () {
      save({
        analytics: $('#ckAnalytics', bar).checked,
        ads: $('#ckAds', bar).checked,
        at: Date.now()
      });
    });

    // Any page can reopen the banner, for example from the Cookie Policy.
    $$('[data-cookie-reopen]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        bar.classList.add('is-shown');
        if (accept) accept.focus();
      });
    });
  })();

  /* ------------------------------------------------------------------
     12. Photography fallback. If a hosted photo ever fails to load,
         swap in a known-good frame so no broken image is shown.
     ------------------------------------------------------------------ */
  (function photoFallback() {
    var FALLBACK = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=1200&q=70';
    $$('img').forEach(function (img) {
      img.addEventListener('error', function handle() {
        img.removeEventListener('error', handle);
        if (img.src.indexOf('photo-1544367567-0f2fcb009e0b') === -1) img.src = FALLBACK;
      });
    });
  })();

  /* ------------------------------------------------------------------
     13. Print triggers (sequence sheets)
     ------------------------------------------------------------------ */
  (function print() {
    $$('[data-print]').forEach(function (btn) {
      btn.addEventListener('click', function () { window.print(); });
    });
  })();

  /* ------------------------------------------------------------------
     14. Current year in the footer
     ------------------------------------------------------------------ */
  (function year() {
    $$('[data-year]').forEach(function (el) { el.textContent = String(new Date().getFullYear()); });
  })();

})();
