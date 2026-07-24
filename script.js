(() => {
  const body = document.body;
  const video = document.querySelector('#scroll-video');
  const header = document.querySelector('.site-header');
  const footer = document.querySelector('.site-footer');
  const progressBar = document.querySelector('.scroll-progress span');
  const revealHeading = document.querySelector('.scroll-reveal');
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
  const words = revealHeading.dataset.revealText.trim().split(/\s+/);

  revealHeading.innerHTML = words
    .map((word) => `<span class="word">${word}</span>`)
    .join(' ');

  const wordElements = [...revealHeading.querySelectorAll('.word')];
  let videoReady = false;
  let frameRequested = false;

  const finishLoading = () => {
    body.classList.remove('is-loading');
  };

  const markVideoReady = () => {
    if (videoReady) return;
    videoReady = true;
    if (video.duration && Number.isFinite(video.duration)) {
      video.currentTime = Math.min(0.01, video.duration);
    }
    window.setTimeout(finishLoading, 250);
    requestTick();
  };

  video.addEventListener('loadedmetadata', markVideoReady, { once: true });
  video.addEventListener('canplay', markVideoReady, { once: true });
  video.addEventListener('error', finishLoading, { once: true });
  window.setTimeout(finishLoading, 4000);

  const updateRevealText = () => {
    if (reduceMotion) return;
    const rect = revealHeading.getBoundingClientRect();
    const travel = window.innerHeight + rect.height * 0.55;
    const sectionProgress = clamp((window.innerHeight * 0.9 - rect.top) / travel);
    const spread = 0.22;

    wordElements.forEach((word, index) => {
      const start = (index / Math.max(wordElements.length - 1, 1)) * (1 - spread);
      const localProgress = clamp((sectionProgress - start) / spread);
      word.style.setProperty('--word-opacity', String(0.1 + localProgress * 0.9));
      word.style.setProperty('--word-blur', `${(1 - localProgress) * 5}px`);
      word.style.setProperty('--word-y', `${(1 - localProgress) * 18}px`);
      word.style.setProperty('--word-rotate', `${(1 - localProgress) * 12}deg`);
    });
  };

  const updateVideo = () => {
    if (!videoReady || !video.duration || video.seeking || reduceMotion) return;
    const footerTop = footer.offsetTop;
    const stopScroll = Math.max(1, footerTop - window.innerHeight * 0.2);
    const scrollProgress = clamp(window.scrollY / stopScroll);
    const targetTime = scrollProgress * Math.max(0, video.duration - 0.08);

    if (Math.abs(video.currentTime - targetTime) > 0.035) {
      video.currentTime = targetTime;
    }
  };

  const updateInterface = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = clamp(window.scrollY / maxScroll);
    progressBar.style.transform = `scaleY(${progress})`;

    const headerProgress = clamp((window.scrollY - 500) / 300);
    header.style.transform = `translate3d(0, ${headerProgress * -150}px, 0)`;

    updateRevealText();
    updateVideo();
    frameRequested = false;
  };

  function requestTick() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(updateInterface);
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

  const setMenuState = (open) => {
    body.classList.toggle('menu-open', open);
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileMenu.setAttribute('aria-hidden', String(!open));
  };

  menuToggle.addEventListener('click', () => setMenuState(!body.classList.contains('menu-open')));
  mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuState(false)));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(false);
  });

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', requestTick);
  requestTick();
})();