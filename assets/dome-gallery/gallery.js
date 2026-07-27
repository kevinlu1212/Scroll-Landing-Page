import { galleryCollections } from './gallery-manifest.js?v=20260727-1';

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
    this.activeFolder = null;
    this.activeProject = null;
    this.activeIndex = 0;

    document.querySelectorAll('.project-lightbox').forEach((element) => element.remove());
    this.mount();
    this.bindEvents();
    this.setCategory(this.category);
  }

  mount() {
    this.root.innerHTML = [
      '<div class="project-index-toolbar" aria-hidden="true">',
      '<button class="project-folder-back" type="button"><span>←</span> BACK TO FOLDERS</button>',
      '<p><small>PROJECT FOLDER</small><strong></strong></p>',
      '</div>',
      '<div class="project-index" role="list"></div>'
    ].join('');
    this.index = this.root.querySelector('.project-index');
    this.toolbar = this.root.querySelector('.project-index-toolbar');
    this.folderTitle = this.toolbar.querySelector('strong');

    this.lightbox = document.createElement('div');
    this.lightbox.className = 'project-lightbox';
    this.lightbox.setAttribute('aria-hidden', 'true');
    this.lightbox.setAttribute('role', 'dialog');
    this.lightbox.setAttribute('aria-modal', 'true');
    this.lightbox.setAttribute('aria-label', '作品大图预览');
    this.lightbox.innerHTML = [
      '<header class="project-lightbox-project">',
      '<p class="project-lightbox-path"></p>',
      '<h2 class="project-lightbox-title"></h2>',
      '<p class="project-lightbox-description"></p>',
      '</header>',
      '<button class="project-lightbox-close" type="button" aria-label="关闭大图">×</button>',
      '<button class="project-lightbox-nav project-lightbox-prev" type="button" aria-label="上一张">←</button>',
      '<figure><img alt=""><figcaption></figcaption></figure>',
      '<button class="project-lightbox-nav project-lightbox-next" type="button" aria-label="下一张">→</button>',
      '<div class="project-lightbox-thumbs" aria-label="图集缩略图"></div>'
    ].join('');
    document.body.append(this.lightbox);

    this.lightboxPath = this.lightbox.querySelector('.project-lightbox-path');
    this.lightboxTitle = this.lightbox.querySelector('.project-lightbox-title');
    this.lightboxDescription = this.lightbox.querySelector('.project-lightbox-description');
    this.lightboxImage = this.lightbox.querySelector('figure img');
    this.lightboxCaption = this.lightbox.querySelector('figcaption');
    this.lightboxThumbs = this.lightbox.querySelector('.project-lightbox-thumbs');
    this.lightboxPrev = this.lightbox.querySelector('.project-lightbox-prev');
    this.lightboxNext = this.lightbox.querySelector('.project-lightbox-next');
  }

  bindEvents() {
    this.index.addEventListener('click', (event) => {
      const folderCard = event.target.closest('[data-folder]');
      if (folderCard) {
        this.openFolder(folderCard.dataset.folder);
        return;
      }
      const projectCard = event.target.closest('[data-project-id]');
      if (projectCard) this.openProject(projectCard.dataset.projectId);
    });

    this.toolbar.querySelector('.project-folder-back').addEventListener('click', () => this.closeFolder());
    this.lightbox.querySelector('.project-lightbox-close').addEventListener('click', () => this.closeLightbox());
    this.lightboxPrev.addEventListener('click', () => this.showPrevious());
    this.lightboxNext.addEventListener('click', () => this.showNext());
    this.lightboxThumbs.addEventListener('click', (event) => {
      const thumbnail = event.target.closest('[data-thumb-index]');
      if (thumbnail) this.setLightboxImage(Number(thumbnail.dataset.thumbIndex));
    });
    this.lightbox.addEventListener('click', (event) => {
      if (event.target === this.lightbox) this.closeLightbox();
    });

    window.addEventListener('keydown', (event) => {
      if (this.lightbox.classList.contains('is-open')) {
        if (event.key === 'Escape') this.closeLightbox();
        if (event.key === 'ArrowLeft') this.showPrevious();
        if (event.key === 'ArrowRight') this.showNext();
        return;
      }
      if (event.key === 'Escape' && this.activeFolder) this.closeFolder();
    });

    window.addEventListener('domegallery:category', (event) => this.setCategory(event.detail && event.detail.key));
    window.addEventListener('domegallery:open', () => this.announceReady());
    window.addEventListener('domegallery:close', () => {
      this.closeLightbox();
      this.activeFolder = null;
      this.renderIndex();
    });
  }

  setCategory(key) {
    const selectedKey = galleryCollections[key] ? key : 'sculpture';
    this.closeLightbox();
    this.category = selectedKey;
    this.projects = galleryCollections[selectedKey] || [];
    this.activeFolder = null;
    this.root.dataset.category = selectedKey;
    this.renderIndex();
    this.announceReady();
  }

  announceReady() {
    const count = this.category === 'project' && !this.activeFolder ? this.getFolders().length : this.visibleProjects().length;
    this.root.dispatchEvent(new CustomEvent('domegallery:ready', {
      detail: { category: this.category, count, unit: this.category === 'project' && !this.activeFolder ? 'FOLDERS' : 'GALLERIES' }
    }));
  }

  getFolders() {
    const folders = new Map();
    this.projects.forEach((project) => {
      if (!project.group) return;
      if (!folders.has(project.group)) folders.set(project.group, []);
      folders.get(project.group).push(project);
    });
    return Array.from(folders, ([name, projects]) => ({ name, projects }));
  }

  visibleProjects() {
    if (this.category !== 'project' || !this.activeFolder) return this.projects;
    return this.projects.filter((project) => project.group === this.activeFolder);
  }

  renderIndex() {
    this.index.replaceChildren();
    const showFolders = this.category === 'project' && !this.activeFolder;
    this.root.classList.toggle('is-folder-index', showFolders);
    this.root.classList.toggle('is-folder-open', Boolean(this.activeFolder));
    this.toolbar.setAttribute('aria-hidden', String(!this.activeFolder));
    this.folderTitle.textContent = this.activeFolder || '';

    if (showFolders) this.renderFolders();
    else this.renderProjects(this.visibleProjects());
    this.index.scrollTop = 0;
  }

  renderFolders() {
    const folders = this.getFolders();
    folders.forEach((folder) => {
      const card = document.createElement('button');
      card.className = 'project-folder-card';
      card.type = 'button';
      card.dataset.folder = folder.name;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', '打开文件夹：' + folder.name);

      const frame = document.createElement('span');
      frame.className = 'project-folder-frame';
      const coverProjects = folder.projects.slice(0, 2);
      coverProjects.forEach((project) => {
        const image = document.createElement('img');
        image.src = project.cover.src;
        image.alt = '';
        frame.append(image);
      });
      const folderMark = document.createElement('span');
      folderMark.className = 'project-folder-mark';
      folderMark.textContent = 'FOLDER';
      frame.append(folderMark);

      const meta = document.createElement('span');
      meta.className = 'project-cover-meta';
      const title = document.createElement('strong');
      title.textContent = folder.name;
      const count = document.createElement('small');
      count.textContent = String(folder.projects.length).padStart(2, '0') + ' GALLERIES';
      meta.append(title, count);
      card.append(frame, meta);
      this.index.append(card);
    });
  }

  renderProjects(projects) {
    if (!projects.length) {
      const empty = document.createElement('p');
      empty.className = 'project-index-empty';
      empty.textContent = '该分类暂未添加图集。';
      this.index.append(empty);
      return;
    }

    projects.forEach((project, projectIndex) => {
      const card = document.createElement('button');
      card.className = 'project-cover-card';
      card.type = 'button';
      card.dataset.projectId = project.id;
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', '打开图集：' + project.title);

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
  }

  openFolder(folderName) {
    if (!this.getFolders().some((folder) => folder.name === folderName)) return;
    this.activeFolder = folderName;
    this.renderIndex();
    this.announceReady();
    this.toolbar.querySelector('.project-folder-back').focus({ preventScroll: true });
  }

  closeFolder() {
    if (!this.activeFolder) return;
    this.activeFolder = null;
    this.renderIndex();
    this.announceReady();
  }

  openProject(projectId) {
    const project = this.projects.find((item) => item.id === projectId);
    if (!project) return;
    this.activeProject = project;
    this.activeIndex = 0;
    this.lightboxPath.textContent = project.pathLabel;
    this.lightboxTitle.textContent = project.title;
    this.lightboxDescription.textContent = project.description || CATEGORY_DESCRIPTIONS[this.category];
    this.renderThumbnails();
    this.openLightbox(0);
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
    console.error('StaticProjectGallery failed to initialize', error);
  }
}
