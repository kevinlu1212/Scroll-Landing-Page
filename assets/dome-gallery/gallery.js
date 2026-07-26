import { galleryCollections } from './gallery-manifest.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const normalizeAngle = (value) => ((value + 180) % 360 + 360) % 360 - 180;

class DomeGallery {
  constructor(root, options = {}) {
    this.root = root;
    this.options = {
      fit: 0.92,
      minRadius: 420,
      maxVerticalRotationDeg: 0,
      segments: 34,
      dragDampening: 2,
      grayscale: false,
      autoSpeed: -2.2,
      ...options
    };
    this.rotation = 0;
    this.velocity = 0;
    this.dragging = false;
    this.pointerId = null;
    this.lastPointerX = 0;
    this.dragDistance = 0;
    this.pressedCard = null;
    this.autoPausedByInteraction = false;
    this.renderVersion = 0;
    this.images = [];
    this.activeIndex = 0;
    this.category = 'sculpture';
    this.frame = 0;
    this.lastFrameTime = 0;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.root.innerHTML = `
      <div class="dome-gallery-viewport" tabindex="0" role="region" aria-label="可拖拽圆顶作品画廊">
        <div class="dome-gallery-stage"></div>
        <div class="dome-gallery-vignette" aria-hidden="true"></div>
        <div class="dome-gallery-axis" aria-hidden="true"><i></i><span>DRAG TO ORBIT</span><i></i></div>
      </div>
      <div class="dome-lightbox" aria-hidden="true" role="dialog" aria-modal="true" aria-label="作品大图预览">
        <button class="dome-lightbox-close" type="button" aria-label="关闭大图">×</button>
        <button class="dome-lightbox-nav dome-lightbox-prev" type="button" aria-label="上一张作品">←</button>
        <figure><img alt="" /><figcaption></figcaption></figure>
        <button class="dome-lightbox-nav dome-lightbox-next" type="button" aria-label="下一张作品">→</button>
      </div>
    `;

    this.viewport = this.root.querySelector('.dome-gallery-viewport');
    this.stage = this.root.querySelector('.dome-gallery-stage');
    this.lightbox = this.root.querySelector('.dome-lightbox');
    document.body.append(this.lightbox);
    this.lightboxImage = this.lightbox.querySelector('img');
    this.lightboxCaption = this.lightbox.querySelector('figcaption');
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.layout());
    this.resizeObserver.observe(this.root);
    this.setCategory(this.root.dataset.category || 'sculpture', true);
    this.animate();
  }

  bindEvents() {
    this.viewport.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      this.dragging = true;
      this.pointerId = event.pointerId;
      this.lastPointerX = event.clientX;
      this.dragDistance = 0;
      this.pressedCard = event.target.closest('.dome-gallery-card');
      this.velocity = 0;
      this.viewport.setPointerCapture(event.pointerId);
      this.root.classList.add('is-dragging');
      event.preventDefault();
    });

    this.viewport.addEventListener('pointermove', (event) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      const deltaX = event.clientX - this.lastPointerX;
      this.lastPointerX = event.clientX;
      this.dragDistance += Math.abs(deltaX);
      if (this.dragDistance > 4) this.autoPausedByInteraction = true;
      const deltaRotation = deltaX / (this.options.dragDampening * 1.8);
      this.rotation = normalizeAngle(this.rotation + deltaRotation);
      this.velocity = 0;
      this.applyTransform();
      event.preventDefault();
    });

    const releasePointer = (event) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      const clickedCard = event.type === 'pointerup' && this.dragDistance <= 7 ? this.pressedCard : null;
      this.dragging = false;
      this.pointerId = null;
      this.pressedCard = null;
      this.root.classList.remove('is-dragging');
      this.lastFrameTime = performance.now();
      if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
      if (clickedCard) this.openLightbox(Number(clickedCard.dataset.index));
    };

    this.viewport.addEventListener('pointerup', releasePointer);
    this.viewport.addEventListener('pointercancel', releasePointer);
    this.viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = clamp(event.deltaY, -120, 120) * -0.045;
      this.autoPausedByInteraction = true;
      this.rotation = normalizeAngle(this.rotation + delta);
      this.velocity = 0;
      this.applyTransform();
    }, { passive: false });

    this.viewport.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      this.autoPausedByInteraction = true;
      this.rotation += event.key === 'ArrowLeft' ? 12 : -12;
      this.velocity = 0;
      this.applyTransform();
    });

    this.lightbox.querySelector('.dome-lightbox-close').addEventListener('click', () => this.closeLightbox());
    this.lightbox.querySelector('.dome-lightbox-prev').addEventListener('click', () => this.stepLightbox(-1));
    this.lightbox.querySelector('.dome-lightbox-next').addEventListener('click', () => this.stepLightbox(1));
    this.lightbox.addEventListener('click', (event) => {
      if (event.target === this.lightbox) this.closeLightbox();
    });
    window.addEventListener('keydown', (event) => {
      if (!this.lightbox.classList.contains('is-open')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.closeLightbox();
      }
      if (event.key === 'ArrowLeft') this.stepLightbox(-1);
      if (event.key === 'ArrowRight') this.stepLightbox(1);
    }, true);
  }

  setCategory(key, immediate = false) {
    const nextImages = galleryCollections[key] || galleryCollections.sculpture;
    this.category = galleryCollections[key] ? key : 'sculpture';
    this.root.dataset.category = this.category;
    const update = () => {
      this.images = nextImages;
      this.rotation = 0;
      this.velocity = 0;
      this.autoPausedByInteraction = false;
      this.lastFrameTime = performance.now();
      this.renderCards();
      this.stage.classList.remove('is-changing');
      this.root.dispatchEvent(new CustomEvent('domegallery:ready', { detail: { key: this.category, count: this.images.length } }));
    };
    if (immediate || !this.stage.children.length) update();
    else {
      this.stage.classList.add('is-changing');
      window.setTimeout(update, 180);
    }
  }

  renderCards() {
    const fragment = document.createDocumentFragment();
    const renderVersion = ++this.renderVersion;
    const readiness = [];
    this.stage.classList.add('is-loading');
    this.images.forEach((image, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dome-gallery-card';
      button.dataset.index = String(index);
      button.setAttribute('aria-label', `查看${image.alt}`);
      const picture = document.createElement('img');
      picture.src = image.src;
      picture.alt = image.alt;
      picture.draggable = false;
      picture.loading = 'eager';
      picture.decoding = 'async';
      readiness.push(new Promise((resolve) => {
        const finalizeImage = () => {
          button.dataset.ratio = String(picture.naturalWidth / picture.naturalHeight || 1);
          resolve();
        };
        if (picture.complete) finalizeImage();
        else {
          picture.addEventListener('load', finalizeImage, { once: true });
          picture.addEventListener('error', resolve, { once: true });
        }
      }));
      button.append(picture);
      button.addEventListener('click', (event) => {
        if (event.detail !== 0) return;
        this.openLightbox(index);
      });
      fragment.append(button);
    });
    this.stage.replaceChildren(fragment);
    this.layout();
    Promise.all(readiness).then(() => {
      if (renderVersion !== this.renderVersion) return;
      this.layout();
      requestAnimationFrame(() => this.stage.classList.remove('is-loading'));
    });
  }

  layout() {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (!width || !height || !this.images.length) return;
    const baseHeight = clamp(Math.min(width * 0.2, height * 0.46) * this.options.fit, 118, 230);
    const angleStep = 360 / this.images.length;
    const angleStepRadians = Math.PI * 2 / this.images.length;
    const maximumCardWidth = baseHeight * 1.72;
    const cardGap = clamp(baseHeight * 0.38, 42, 92);
    const radiusForSpacing = this.images.length > 2
      ? (maximumCardWidth + cardGap) / (2 * Math.tan(angleStepRadians / 2))
      : this.options.minRadius;
    const radius = Math.max(this.options.minRadius, width * 0.53, radiusForSpacing);
    const rowPattern = [0, -1, 1];
    this.radius = radius;
    this.root.style.setProperty('--dome-radius', `${radius}px`);
    [...this.stage.children].forEach((card, index) => {
      const ratio = clamp(Number(card.dataset.ratio) || 1.34, 0.56, 2.1);
      let cardHeight = ratio < 1 ? baseHeight * 1.08 : baseHeight;
      let cardWidth = cardHeight * ratio;
      const maxWidth = baseHeight * 1.72;
      if (cardWidth > maxWidth) {
        cardWidth = maxWidth;
        cardHeight = cardWidth / ratio;
      }
      const angle = index * angleStep;
      const row = rowPattern[index % rowPattern.length];
      const offsetY = row * baseHeight * 0.72;
      const tilt = row * -5;
      card.dataset.angle = String(angle);
      card.style.setProperty('--card-width', `${cardWidth}px`);
      card.style.setProperty('--card-height', `${cardHeight}px`);
      card.style.transform = `rotateY(${angle}deg) translateZ(${radius}px) translateY(${offsetY}px) rotateX(${tilt}deg)`;
    });
    this.applyTransform();
  }

  applyTransform() {
    if (!this.radius) return;
    this.stage.style.transform = `translate3d(0, 0, ${-this.radius}px) rotateY(${this.rotation}deg)`;
    [...this.stage.children].forEach((card) => {
      const facingAngle = Math.abs(normalizeAngle(Number(card.dataset.angle) + this.rotation));
      const visibility = clamp(1 - Math.max(0, facingAngle - 44) / 18, 0, 1);
      const isInteractive = facingAngle < 60 && visibility > 0.08;
      card.style.opacity = String(visibility);
      card.style.pointerEvents = isInteractive ? 'auto' : 'none';
      card.tabIndex = isInteractive ? 0 : -1;
      card.style.zIndex = String(Math.round(100 - facingAngle));
    });
  }

  animate(now = performance.now()) {
    if (!this.lastFrameTime) this.lastFrameTime = now;
    const elapsed = Math.min(now - this.lastFrameTime, 40);
    this.lastFrameTime = now;
    const canAutoRotate = !this.reduceMotion && !this.dragging && !this.autoPausedByInteraction && document.body.classList.contains('detail-open') && !this.lightbox.classList.contains('is-open');
    if (canAutoRotate) {
      this.rotation = normalizeAngle(this.rotation + this.options.autoSpeed * (elapsed / 1000));
      this.applyTransform();
    }
    this.frame = requestAnimationFrame((time) => this.animate(time));
  }

  resumeAuto() {
    this.autoPausedByInteraction = false;
    this.lastFrameTime = performance.now();
  }

  openLightbox(index) {
    this.activeIndex = index;
    this.updateLightbox();
    this.lightbox.classList.add('is-open');
    this.lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-lightbox-open');
    this.lightbox.querySelector('.dome-lightbox-close').focus();
  }

  closeLightbox() {
    this.lightbox.classList.remove('is-open');
    this.lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-lightbox-open');
    this.viewport.focus({ preventScroll: true });
  }

  stepLightbox(direction) {
    this.activeIndex = (this.activeIndex + direction + this.images.length) % this.images.length;
    this.updateLightbox();
  }

  updateLightbox() {
    const image = this.images[this.activeIndex];
    if (!image) return;
    this.lightboxImage.src = image.src;
    this.lightboxImage.alt = image.alt;
    this.lightboxCaption.textContent = `${image.alt} · ${String(this.activeIndex + 1).padStart(2, '0')} / ${String(this.images.length).padStart(2, '0')}`;
  }
}

const root = document.querySelector('#dome-gallery-root');
if (root) {
  const hashCategory = location.hash.startsWith('#works/') ? location.hash.split('/')[1] : '';
  if (galleryCollections[hashCategory]) root.dataset.category = hashCategory;
  const gallery = new DomeGallery(root, {
    fit: 0.92,
    minRadius: 420,
    maxVerticalRotationDeg: 0,
    segments: 34,
    dragDampening: 2,
    grayscale: false,
    autoSpeed: -2.2
  });
  window.addEventListener('domegallery:category', (event) => gallery.setCategory(event.detail?.key || 'sculpture'));
  window.addEventListener('domegallery:open', () => {
    gallery.resumeAuto();
    const activeKey = root.dataset.category || 'sculpture';
    if (gallery.category !== activeKey) gallery.setCategory(activeKey, true);
    requestAnimationFrame(() => gallery.layout());
  });
  window.__domeGallery = gallery;
}