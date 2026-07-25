import { galleryCollections } from './gallery-manifest.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

class DomeGallery {
  constructor(root, options = {}) {
    this.root = root;
    this.options = {
      fit: 0.8,
      minRadius: 600,
      maxVerticalRotationDeg: 0,
      segments: 34,
      dragDampening: 2,
      grayscale: true,
      ...options
    };
    this.rotation = 0;
    this.velocity = 0;
    this.dragging = false;
    this.pointerId = null;
    this.lastPointerX = 0;
    this.dragDistance = 0;
    this.images = [];
    this.activeIndex = 0;
    this.category = 'sculpture';
    this.frame = 0;

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
      const deltaRotation = deltaX / (this.options.dragDampening * 9);
      this.rotation += deltaRotation;
      this.velocity = deltaRotation * 0.18;
      this.applyTransform();
    });

    const releasePointer = (event) => {
      if (!this.dragging || event.pointerId !== this.pointerId) return;
      this.dragging = false;
      this.pointerId = null;
      this.root.classList.remove('is-dragging');
      if (this.viewport.hasPointerCapture(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
    };

    this.viewport.addEventListener('pointerup', releasePointer);
    this.viewport.addEventListener('pointercancel', releasePointer);
    this.viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = clamp(event.deltaY, -120, 120) * -0.035;
      this.rotation += delta;
      this.velocity = delta * 0.32;
      this.applyTransform();
    }, { passive: false });

    this.viewport.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
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
      picture.loading = index < 8 ? 'eager' : 'lazy';
      picture.decoding = 'async';
      button.append(picture);
      button.addEventListener('click', () => {
        if (this.dragDistance > 7) return;
        this.openLightbox(index);
      });
      fragment.append(button);
    });
    this.stage.replaceChildren(fragment);
    this.layout();
  }

  layout() {
    const width = this.root.clientWidth;
    const height = this.root.clientHeight;
    if (!width || !height || !this.images.length) return;
    const radius = Math.max(this.options.minRadius, width * 0.78);
    const cardWidth = clamp(width * 0.245 * this.options.fit, 150, 280);
    const cardHeight = clamp(cardWidth * 0.72, 112, 210);
    const angleStep = 360 / this.options.segments;
    const center = (this.images.length - 1) / 2;
    const rowPattern = [0, -1, 1];
    this.radius = radius;
    this.root.style.setProperty('--dome-card-width', `${cardWidth}px`);
    this.root.style.setProperty('--dome-card-height', `${cardHeight}px`);
    this.root.style.setProperty('--dome-radius', `${radius}px`);
    [...this.stage.children].forEach((card, index) => {
      const angle = (index - center) * angleStep * 1.08;
      const row = rowPattern[index % rowPattern.length];
      const offsetY = row * cardHeight * 0.78;
      const tilt = row * -7;
      card.style.setProperty('--card-delay', `${Math.min(index * 18, 260)}ms`);
      card.style.transform = `rotateY(${angle}deg) translateZ(${radius}px) translateY(${offsetY}px) rotateX(${tilt}deg)`;
    });
    this.applyTransform();
  }

  applyTransform() {
    if (!this.radius) return;
    this.stage.style.transform = `translate3d(0, 0, ${-this.radius}px) rotateY(${this.rotation}deg)`;
  }

  animate() {
    if (!this.dragging) {
      this.rotation += this.velocity;
      this.velocity *= 0.94;
      if (Math.abs(this.velocity) < 0.015) {
        this.velocity = 0;
        if (!document.hidden && document.body.classList.contains('detail-open') && !this.lightbox.classList.contains('is-open')) this.rotation -= 0.012;
      }
      this.applyTransform();
    }
    this.frame = requestAnimationFrame(() => this.animate());
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
  const gallery = new DomeGallery(root, {
    fit: 0.8,
    minRadius: 600,
    maxVerticalRotationDeg: 0,
    segments: 34,
    dragDampening: 2,
    grayscale: true
  });
  window.addEventListener('domegallery:category', (event) => gallery.setCategory(event.detail?.key || 'sculpture'));
  window.addEventListener('domegallery:open', () => requestAnimationFrame(() => gallery.layout()));
  window.__domeGallery = gallery;
}