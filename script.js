(() => {
  const body = document.body;
  const video = document.querySelector('#gallery-video');
  const panels = [...document.querySelectorAll('.stage-panel')];
  const navLinks = [...document.querySelectorAll('[data-stage-link]')];
  const hotspots = [...document.querySelectorAll('.hotspot')];
  const currentStageLabel = document.querySelector('.current-stage');
  const stageProgress = document.querySelector('.stage-indicator div i');
  const detailView = document.querySelector('.detail-view');
  const detailTitle = document.querySelector('.detail-title');
  const categoryList = document.querySelector('.category-list');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];
  const categoryNumber = document.querySelector('.category-number');
  const categoryHeading = document.querySelector('.category-detail h2');
  const categoryDescription = document.querySelector('.category-description');
  const categoryTags = document.querySelector('.category-tags');
  const galleryRoot = document.querySelector('#dome-gallery-root');
  const galleryCount = document.querySelector('.gallery-count');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stageTimes = [1, 2, 4];
  const stageHashes = ['home', 'about', 'works'];
  const categories = {
    sculpture: {
      number: '01 / SCULPTURE',
      title: '雕塑',
      description: '研究形体、材料与光线的关系，让静态体量在不同观看角度中呈现持续变化的空间表情。',
      tags: ['FORM', 'STONE', 'LIGHT'],
      count: 7
    },
    toyculture: {
      number: '02 / ART TOY & CULTURAL CREATIVE',
      title: '潮玩文创',
      description: '从角色塑造、产品语言到文化叙事，将具有辨识度的形象转化为可收藏、可传播的当代物件。',
      tags: ['CHARACTER', 'CULTURE', 'COLLECTIBLE'],
      count: 5
    },
    scene: {
      number: '03 / SCENE DESIGN',
      title: '场景设计',
      description: '以光线、材质和观看动线组织空间，让作品与观者之间产生连续、沉浸的叙事关系。',
      tags: ['ATMOSPHERE', 'MATERIAL', 'EXPERIENCE'],
      count: 3
    },
    project: {
      number: '04 / PROJECTS',
      title: '项目',
      description: '从概念研究到视觉系统与产品落地，以完整项目串联品牌叙事、形象设计和应用场景。',
      tags: ['RESEARCH', 'SYSTEM', 'APPLICATION'],
      count: 5
    }
  };

  galleryRoot.addEventListener('domegallery:ready', (event) => {
    const count = Number(event.detail?.count) || 0;
    galleryCount.textContent = String(count).padStart(2, '0') + ' PROJECTS';
  });

  let currentStage = 0;
  let transitionLocked = true;
  let booted = false;
  let animationFrame = 0;
  let wheelTotal = 0;
  let wheelTimer = 0;
  let touchStartY = 0;
  let lanyardPulseTimer = 0;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const easeInOut = (value) => value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;

  const finishAt = (target, callback) => {
    cancelAnimationFrame(animationFrame);
    video.pause();
    try { video.currentTime = target; } catch (error) { /* metadata fallback */ }
    callback?.();
  };

  const seekTo = (target, callback) => {
    const safeTarget = clamp(target, 0, Math.max(0, (video.duration || 4.18) - 0.03));
    const startTime = video.currentTime || 0;
    const distance = safeTarget - startTime;

    if (Math.abs(distance) < 0.035 || reduceMotion) {
      finishAt(safeTarget, callback);
      return;
    }

    cancelAnimationFrame(animationFrame);
    video.pause();
    const duration = clamp(Math.abs(distance) * 520, 620, 1250);
    const startedAt = performance.now();

    const update = (now) => {
      const progress = clamp((now - startedAt) / duration, 0, 1);
      const value = startTime + distance * easeInOut(progress);
      if (!video.seeking || progress === 1) video.currentTime = value;
      if (progress < 1) animationFrame = requestAnimationFrame(update);
      else finishAt(safeTarget, callback);
    };

    animationFrame = requestAnimationFrame(update);
  };

  const playForwardTo = (target, callback) => {
    const safeTarget = clamp(target, 0, Math.max(0, (video.duration || 4.18) - 0.03));
    if (video.currentTime >= safeTarget - 0.035) {
      seekTo(safeTarget, callback);
      return;
    }

    cancelAnimationFrame(animationFrame);
    video.playbackRate = 1;
    const monitor = () => {
      if (video.currentTime >= safeTarget - 0.018 || video.ended) finishAt(safeTarget, callback);
      else animationFrame = requestAnimationFrame(monitor);
    };

    video.play().then(() => {
      animationFrame = requestAnimationFrame(monitor);
    }).catch(() => seekTo(safeTarget, callback));
  };

  const moveVideoTo = (target, callback) => {
    if (target > video.currentTime + 0.035) playForwardTo(target, callback);
    else seekTo(target, callback);
  };

  const triggerLanyardGravity = () => {
    window.clearTimeout(lanyardPulseTimer);
    window.__lanyardGravityPending = true;
    lanyardPulseTimer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('lanyard:gravity'));
    }, 620);
  };
  const updateStageInterface = (index) => {
    body.dataset.stage = String(index);
    panels.forEach((panel, panelIndex) => {
      const active = panelIndex === index;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', String(!active));
    });
    document.querySelectorAll('.nav-link').forEach((link) => {
      link.classList.toggle('is-active', Number(link.dataset.stageLink) === index);
    });
    currentStageLabel.textContent = String(index + 1).padStart(2, '0');
    stageProgress.style.transform = `scaleY(${(index + 1) / stageTimes.length})`;
    positionHotspots();
    if (index === 1) triggerLanyardGravity();
  };

  const setStage = (index, options = {}) => {
    const targetStage = clamp(index, 0, stageTimes.length - 1);
    if (!booted || (transitionLocked && !options.force)) return;

    if (body.classList.contains('detail-open')) closeDetail();
    if (targetStage === currentStage && !options.force) return;

    transitionLocked = true;
    body.classList.add('is-transitioning');
    panels.forEach((panel) => panel.classList.remove('is-active'));
    currentStage = targetStage;
    history.replaceState(null, '', `#${stageHashes[targetStage]}`);

    moveVideoTo(stageTimes[targetStage], () => {
      updateStageInterface(targetStage);
      window.setTimeout(() => {
        body.classList.remove('is-transitioning');
        transitionLocked = false;
        options.onComplete?.();
      }, 260);
    });
  };

  const setCategoryExpanded = (expanded) => {
    if (!detailTitle) {
      categoryList.setAttribute('aria-hidden', 'false');
      categoryList.classList.add('is-expanded');
      return;
    }
    detailTitle.setAttribute('aria-expanded', String(expanded));
    categoryList.setAttribute('aria-hidden', String(!expanded));
    categoryList.classList.toggle('is-expanded', expanded);
  };

  const selectCategory = (key) => {
    const selectedKey = categories[key] ? key : 'sculpture';
    const category = categories[selectedKey];
    categoryButtons.forEach((button) => {
      const active = button.dataset.category === selectedKey;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', String(active));
    });
    categoryNumber.textContent = category.number;
    categoryHeading.textContent = category.title;
    categoryDescription.textContent = category.description;
    categoryTags.innerHTML = category.tags.map((tag) => `<span>${tag}</span>`).join('');
    galleryCount.textContent = `${String(category.count).padStart(2, '0')} PROJECTS`;
    galleryRoot.dataset.category = selectedKey;
    window.dispatchEvent(new CustomEvent('domegallery:category', { detail: { key: selectedKey } }));
    history.replaceState(null, '', `#works/${selectedKey}`);
  };

  const openDetail = (key = 'sculpture', expand = false) => {
    video.pause();
    video.currentTime = Math.min(4, Math.max(0, video.duration - 0.03));
    selectCategory(key);
    setCategoryExpanded(expand);
    body.classList.add('detail-open');
    detailView.setAttribute('aria-hidden', 'false');
    window.dispatchEvent(new CustomEvent('domegallery:open'));
  };

  function closeDetail() {
    body.classList.remove('detail-open');
    detailView.setAttribute('aria-hidden', 'true');
    history.replaceState(null, '', '#works');
  }

  function positionHotspots() {
    if (!video.videoWidth || !video.videoHeight) return;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scale = Math.max(viewportWidth / video.videoWidth, viewportHeight / video.videoHeight);
    const renderedWidth = video.videoWidth * scale;
    const renderedHeight = video.videoHeight * scale;
    const objectPosition = getComputedStyle(video).objectPosition.split(' ');
    const positionX = parseFloat(objectPosition[0]) / 100 || 0.5;
    const positionY = parseFloat(objectPosition[1] || '50%') / 100 || 0.5;
    const offsetX = (viewportWidth - renderedWidth) * positionX;
    const offsetY = (viewportHeight - renderedHeight) * positionY;

    hotspots.forEach((hotspot) => {
      const rawLeft = offsetX + Number(hotspot.dataset.x) * renderedWidth;
      const rawTop = offsetY + Number(hotspot.dataset.y) * renderedHeight;
      const edgeMargin = viewportWidth < 900 ? 24 : 0;
      hotspot.style.left = `${clamp(rawLeft, edgeMargin, viewportWidth - edgeMargin)}px`;
      hotspot.style.top = `${clamp(rawTop, 70, viewportHeight - 70)}px`;
      hotspot.classList.toggle('is-edge', rawLeft < edgeMargin || rawLeft > viewportWidth - edgeMargin);
    });
  }

  const handleWheel = (event) => {
    if (body.classList.contains('detail-open')) return;
    event.preventDefault();
    if (transitionLocked) return;
    wheelTotal += event.deltaY;
    clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { wheelTotal = 0; }, 180);
    if (Math.abs(wheelTotal) < 38) return;
    const direction = wheelTotal > 0 ? 1 : -1;
    wheelTotal = 0;
    setStage(currentStage + direction);
  };

  const handleKey = (event) => {
    if (event.key === 'Escape' && body.classList.contains('detail-open')) {
      closeDetail();
      return;
    }
    if (transitionLocked || body.classList.contains('detail-open')) return;
    if (['ArrowDown', 'PageDown', ' '].includes(event.key)) {
      event.preventDefault();
      setStage(currentStage + 1);
    }
    if (['ArrowUp', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      setStage(currentStage - 1);
    }
  };

  const boot = () => {
    if (booted) return;
    booted = true;
    video.currentTime = 0;
    playForwardTo(stageTimes[0], () => {
      updateStageInterface(0);
      body.classList.remove('is-loading');
      transitionLocked = false;

      const hash = location.hash.replace('#', '');
      if (hash === 'about') setStage(1);
      if (hash.startsWith('works')) {
        setStage(2, {
          onComplete: () => {
            const category = hash.split('/')[1];
            if (category && categories[category]) openDetail(category, true);
          }
        });
      }
    });
  };

  const initLineSidebar = () => {
    const sidebar = document.querySelector('[data-line-sidebar]');
    if (!sidebar) return;
    const items = [...sidebar.querySelectorAll('[data-category]')];
    const proximityRadius = 100;
    const maxShift = 30;
    const minimumTickScale = 0.5;

    const resetItems = () => {
      items.forEach((item) => {
        item.style.setProperty('--line-shift', '0px');
        item.style.setProperty('--line-tick-scale', String(minimumTickScale));
      });
    };

    const updateItems = (clientY) => {
      items.forEach((item) => {
        const bounds = item.getBoundingClientRect();
        const distance = Math.abs(clientY - (bounds.top + bounds.height / 2));
        const proximity = clamp(1 - distance / proximityRadius, 0, 1);
        const smoothFalloff = proximity * proximity * (3 - 2 * proximity);
        item.style.setProperty('--line-shift', `${smoothFalloff * maxShift}px`);
        item.style.setProperty('--line-tick-scale', String(minimumTickScale + smoothFalloff * (1 - minimumTickScale)));
      });
    };

    sidebar.addEventListener('pointermove', (event) => updateItems(event.clientY));
    sidebar.addEventListener('pointerleave', resetItems);
    items.forEach((item) => {
      item.addEventListener('focus', () => {
        const bounds = item.getBoundingClientRect();
        updateItems(bounds.top + bounds.height / 2);
      });
      item.addEventListener('blur', resetItems);
    });
    resetItems();
  };

  initLineSidebar();
  navLinks.forEach((link) => link.addEventListener('click', () => setStage(Number(link.dataset.stageLink))));
  hotspots.forEach((hotspot) => hotspot.addEventListener('click', () => openDetail(hotspot.dataset.hotspot, true)));
  document.querySelector('.works-entry').addEventListener('click', () => openDetail('sculpture', true));
  document.querySelector('.detail-close').addEventListener('click', closeDetail);
  detailTitle?.addEventListener('click', () => setCategoryExpanded(detailTitle.getAttribute('aria-expanded') !== 'true'));
  categoryButtons.forEach((button) => button.addEventListener('click', () => selectCategory(button.dataset.category)));
  window.addEventListener('wheel', handleWheel, { passive: false });
  window.addEventListener('keydown', handleKey);
  window.addEventListener('resize', positionHotspots);
  window.addEventListener('touchstart', (event) => {
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', (event) => {
    if (window.__lanyardDragActive || performance.now() < (window.__lanyardDragGuardUntil || 0)) return;
    if (transitionLocked || body.classList.contains('detail-open')) return;
    const distance = touchStartY - event.changedTouches[0].clientY;
    if (Math.abs(distance) > 48) setStage(currentStage + (distance > 0 ? 1 : -1));
  }, { passive: true });

  video.addEventListener('loadedmetadata', boot, { once: true });
  video.addEventListener('loadeddata', positionHotspots);
  video.addEventListener('error', () => {
    body.classList.remove('is-loading');
    transitionLocked = false;
  }, { once: true });
  if (video.readyState >= 1) boot();
  window.setTimeout(() => {
    if (!booted) boot();
    body.classList.remove('is-loading');
  }, 6000);
})();