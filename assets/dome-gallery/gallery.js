import { galleryCollections } from './gallery-manifest.js?v=20260726-3';

const CATEGORY_DESCRIPTIONS = {
  sculpture: '图集记录作品从形体研究、材料塑造到最终呈现的过程与细节。',
  toyculture: '图集展示角色设定、造型设计、材质表现与衍生应用。',
  scene: '图集集中展示空间构思、光影氛围、材质细节与最终视觉呈现。',
  project: '图集汇总项目的概念研究、设计过程与最终成果。'
};

class StaticProjectGallery {
  constructor(root) {
    this.root = root;
    this.category = root.dataset.category || 'sculpture';
    this.projects = [];
    this.activeProject = null;
    this.activeIndex = 0;

    document.querySelectorAll('.project-gallery-view, .project-lightbox').forEach((element) => element.remove());
    this.mount();
    this.bindEvents();
    this.setCategory(this.category);
  }

  mount() {
    this.root.innerHTML = '<div class="project-index" role="list"></div>';
    this.index = this.root.querySelector('.project-index');

    this.projectView = document.createElement('section');
    this.projectView.className = 'project-gallery-view';
    this.projectView.setAttribute('aria-hidden', 'true');
    this.projectView.innerHTML = [
      '<button class="project-gallery-back" type="button"><span>←</span> BACK TO PROJECTS</button>',
      '<header class="project-gallery-header">',
      '<p class="project-gallery-path"></p>',
      '<h2 class="project-gallery-title"></h2>',
      '<p class="project-gallery-description"></p>',
      '</header>',
      '<div class="project-gallery-row" aria-label="项目图片列表"></div>',
      '<p class="project-gallery-tip">横向浏览 · 点击图片查看大图</p>'
    ].join('');
    document.body.append(this.projectView);

    this.projectTitle = this.projectView.querySelector('.project-gallery-title');
    this.projectPath = this.projectView.querySelector('.project-gallery-path');
    this.projectDescription = this.projectView.querySelector('.project-gallery-description');
    this.galleryRow = this.projectView.querySelector('.project-gallery-row');

    this.lightbox = document.createElement('div');
    this.lightbox.className = 'project-lightbox';
    this.lightbox.setAttribute('aria-hidden', 'true');
    this.lightbox.setAttribute('role', 'dialog');
    this.lightbox.setAttribute('aria-modal', 'true');
    this.lightbox.setAttribute('aria-label', '作品大图预览');
    this.lightbox.innerHTML = [
      '<button class="project-lightbox-close" type="button" aria-label="关闭大图">×</button>',
      '<button class="project-lightbox-nav project-lightbox-prev" type="button" aria-label="上一张">←</button>',
      '<figure><img alt=""><figcaption></figcaption></figure>',
      '<button class="project-lightbox-nav project-lightbox-next" type="button" aria-label="下一张">→</button>',
      '<div class="project-lightbox-thumbs" aria-label="图集缩略图"></div>'
    ].join('');
    document.body.append(this.lightbox);

    this.lightboxImage = this.lightbox.querySelector('figure img');
    this.lightboxCaption = this.lightbox.querySelector('figcaption');
    this.lightboxThumbs = this.lightbox.querySelector('.project-lightbox-thumbs');
    this.lightboxPrev = this.lightbox.querySelector('.project-lightbox-prev');
    this.lightboxNext = this.lightbox.querySelector('.project-lightbox-next');
  }

  bindEvents() {
    this.index.addEventListener('click', (event) => {
      const card = event.target.closest('[data-project-index]');
      if (!card) return;
      this.openProject(Number(card.dataset.projectIndex));
    });

    this.projectView.querySelector('.project-gallery-back').addEventListener('click', () => this.closeProject());

    this.galleryRow.addEventListener('click', (event) => {
      const imageButton = event.target.closest('[data-image-index]');
      if (!imageButton) return;
      this.openLightbox(Number(imageButton.dataset.imageIndex));
    });

    this.lightbox.querySelector('.project-lightbox-close').addEventListener('click', () => this.closeLightbox());
    this.lightboxPrev.addEventListener('click', () => this.showPrevious());
    this.lightboxNext.addEventListener('click', () => this.showNext());
    this.lightboxThumbs.addEventListener('click', (event) => {
      const thumbnail = event.target.closest('[data-thumb-index]');
      if (!thumbnail) return;
      this.setLightboxImage(Number(thumbnail.dataset.thumbIndex));
    });
    this.lightbox.addEventListener('click', (event) => {
      if (event.target === this.lightbox) this.closeLightbox();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (this.lightbox.classList.contains('is-open')) this.closeLightbox();
        else if (this.projectView.classList.contains('is-open')) this.closeProject();
      }
      if (!this.lightbox.classList.contains('is-open')) return;
      if (event.key === 'ArrowLeft') this.showPrevious();
      if (event.key === 'ArrowRight') this.showNext();
    });

    window.addEventListener('domegallery:category', (event) => this.setCategory(event.detail && event.detail.key));
    window.addEventListener('domegallery:open', () => this.announceReady());
    window.addEventListener('domegallery:close', () => {
      this.closeLightbox();
      this.closeProject();
    });
  }

  setCategory(key) {
    const selectedKey = galleryCollections[key] ? key : 'sculpture';
    this.closeLightbox();
    this.closeProject();
    this.category = selectedKey;
    this.projects = galleryCollections[selectedKey] || [];
    this.root.dataset.category = selectedKey;
    this.renderIndex();
    this.announceReady();
  }

  announceReady() {
    this.root.dispatchEvent(new CustomEvent('domegallery:ready', {
      detail: { category: this.category, count: this.projects.length }
    }));
  }

  renderIndex() {
    this.index.replaceChildren();
    if (!this.projects.length) {
      const empty = document.createElement('p');
      empty.className = 'project-index-empty';
      empty.textContent = '该分类暂未添加项目。';
      this.index.append(empty);
      return;
    }

    this.projects.forEach((project, projectIndex) => {
      const card = document.createElement('button');
      card.className = 'project-cover-card';
      card.type = 'button';
      card.dataset.projectIndex = String(projectIndex);
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', '打开项目：' + project.title);

      const frame = document.createElement('span');
      frame.className = 'project-cover-frame';
      const image = document.createElement('img');
      image.src = project.cover.src;
      image.alt = project.cover.alt || project.title;
      image.loading = projectIndex < 4 ? 'eager' : 'lazy';
      frame.append(image);

      const meta = document.createElement('span');
      meta.className = 'project-cover-meta';
      const title = document.createElement('strong');
      title.textContent = project.title;
      const count = document.createElement('small');
      count.textContent = String(project.images.length).padStart(2, '0') + ' IMAGES';
      meta.append(title, count);
      card.append(frame, meta);
      this.index.append(card);
    });
    this.index.scrollTop = 0;
  }

  openProject(projectIndex) {
    const project = this.projects[projectIndex];
    if (!project) return;
    this.activeProject = project;
    this.activeIndex = 0;
    this.projectPath.textContent = project.pathLabel;
    this.projectTitle.textContent = project.title;
    this.projectDescription.textContent = project.description || CATEGORY_DESCRIPTIONS[this.category];
    this.renderProjectImages();
    this.renderThumbnails();
    this.projectView.classList.add('is-open');
    this.projectView.setAttribute('aria-hidden', 'false');
    document.body.classList.add('project-gallery-open');
    this.galleryRow.scrollLeft = 0;
    this.projectView.querySelector('.project-gallery-back').focus({ preventScroll: true });
  }

  renderProjectImages() {
    this.galleryRow.replaceChildren();
    this.activeProject.images.forEach((item, imageIndex) => {
      const button = document.createElement('button');
      button.className = 'project-gallery-image';
      button.type = 'button';
      button.dataset.imageIndex = String(imageIndex);
      button.setAttribute('aria-label', '查看大图 ' + String(imageIndex + 1));
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = item.alt || this.activeProject.title;
      image.loading = imageIndex < 3 ? 'eager' : 'lazy';
      button.append(image);
      this.galleryRow.append(button);
    });
  }

  closeProject() {
    this.closeLightbox();
    this.projectView.classList.remove('is-open');
    this.projectView.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('project-gallery-open');
    this.activeProject = null;
  }

  openLightbox(imageIndex) {
    if (!this.activeProject) return;
    this.setLightboxImage(imageIndex);
    this.lightbox.classList.add('is-open');
    this.lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('project-lightbox-open');
    this.lightbox.querySelector('.project-lightbox-close').focus({ preventScroll: true });
  }

  closeLightbox() {
    this.lightbox.classList.remove('is-open');
    this.lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('project-lightbox-open');
  }

  setLightboxImage(imageIndex) {
    if (!this.activeProject || !this.activeProject.images.length) return;
    const total = this.activeProject.images.length;
    this.activeIndex = (imageIndex + total) % total;
    const item = this.activeProject.images[this.activeIndex];
    this.lightboxImage.src = item.src;
    this.lightboxImage.alt = item.alt || this.activeProject.title;
    this.lightboxCaption.textContent = String(this.activeIndex + 1).padStart(2, '0') + ' / ' + String(total).padStart(2, '0') + ' · ' + this.activeProject.title;
    const hasMultiple = total > 1;
    this.lightboxPrev.hidden = !hasMultiple;
    this.lightboxNext.hidden = !hasMultiple;
    this.lightboxThumbs.querySelectorAll('[data-thumb-index]').forEach((thumbnail) => {
      const active = Number(thumbnail.dataset.thumbIndex) === this.activeIndex;
      thumbnail.classList.toggle('is-active', active);
      thumbnail.setAttribute('aria-current', String(active));
      if (active) thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  }

  renderThumbnails() {
    this.lightboxThumbs.replaceChildren();
    if (!this.activeProject) return;
    this.activeProject.images.forEach((item, imageIndex) => {
      const button = document.createElement('button');
      button.className = 'project-lightbox-thumb';
      button.type = 'button';
      button.dataset.thumbIndex = String(imageIndex);
      button.setAttribute('aria-label', '切换到第 ' + String(imageIndex + 1) + ' 张');
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = '';
      image.loading = 'lazy';
      button.append(image);
      this.lightboxThumbs.append(button);
    });
  }

  showPrevious() {
    this.setLightboxImage(this.activeIndex - 1);
  }

  showNext() {
    this.setLightboxImage(this.activeIndex + 1);
  }
}

const root = document.querySelector('#dome-gallery-root');
if (root) {
  try {
    window.__domeGallery = new StaticProjectGallery(root);
  } catch (error) {
    window.__domeGalleryError = { message: error.message, stack: error.stack };
    console.error('StaticProjectGallery failed to initialize', error);
  }
}
