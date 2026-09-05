/* AutoInstaDM landing — motion. Progressive enhancement only. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* year */
  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* sticky nav state */
  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('is-stuck', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* scroll reveal */
  var reveals = [].slice.call(document.querySelectorAll('.reveal'));
  if (reduce || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* duplicate marquee content for a seamless loop */
  var row = document.getElementById('marquee');
  if (row && !reduce) { row.innerHTML += row.innerHTML; }

  /* ---- the DM thread plays itself out ---- */
  var thread = document.getElementById('thread');
  if (!thread) return;

  var script = [
    { t: 'in',  text: 'hey! are you actually you or is this a bot lol' },
    { t: 'typing' },
    { t: 'out', badge: 'AI assistant', text: "Honest answer — I'm an automated assistant for @yourhandle. A real person can jump in anytime. What can I help with?" },
    { t: 'in',  text: 'ok haha. how much is the subscription?' },
    { t: 'typing' },
    { t: 'out', text: "It's $12/month right now. Want the link?" },
    { t: 'in',  text: 'yeah send it' },
    { t: 'out', text: 'Here you go → the link is in the bio, or I can drop it: yoursite.com/join' },
    { t: 'sys', text: 'fan typed "human" — a person is taking over' }
  ];

  function bubble(step) {
    var el = document.createElement('div');
    if (step.t === 'typing') {
      el.className = 'typing';
      el.innerHTML = '<i></i><i></i><i></i>';
    } else if (step.t === 'sys') {
      el.className = 'msg msg--sys';
      el.textContent = step.text;
    } else {
      el.className = 'msg msg--' + step.t;
      el.innerHTML = (step.badge ? '<span class="msg__badge">' + step.badge + '</span>' : '') +
        step.text.replace(/</g, '&lt;');
    }
    return el;
  }

  if (reduce) {
    script.filter(function (s) { return s.t !== 'typing'; }).forEach(function (s) {
      var b = bubble(s); b.style.animation = 'none'; b.style.opacity = 1; b.style.transform = 'none';
      thread.appendChild(b);
    });
    return;
  }

  var i = 0, last = null;
  function next() {
    if (i >= script.length) { return; }
    var step = script[i++];
    if (last && last.className === 'typing') { thread.removeChild(last); last = null; }
    var b = bubble(step);
    thread.appendChild(b);
    last = b;
    thread.scrollTop = thread.scrollHeight;
    var delay = step.t === 'typing' ? 900 : step.t === 'in' ? 1100 : 1500;
    setTimeout(next, delay);
  }

  /* start once the hero thread is on screen */
  if ('IntersectionObserver' in window) {
    var start = new IntersectionObserver(function (entries, obs) {
      if (entries[0].isIntersecting) { obs.disconnect(); setTimeout(next, 500); }
    }, { threshold: 0.3 });
    start.observe(thread);
  } else {
    setTimeout(next, 600);
  }
})();
