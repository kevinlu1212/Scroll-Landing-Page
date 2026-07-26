import json
import os
import re
import shutil
from pathlib import Path

from PIL import Image, ImageOps

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = Path(os.environ.get('GALLERY_SOURCE', REPO_ROOT / '\u4f5c\u54c1'))
OUTPUT_ROOT = Path(os.environ.get('GALLERY_OUTPUT', REPO_ROOT / 'assets' / 'gallery' / 'projects'))
MANIFEST_PATH = Path(os.environ.get('GALLERY_MANIFEST', REPO_ROOT / 'assets' / 'dome-gallery' / 'gallery-manifest.js'))
CATEGORY_MAP = [
    ('sculpture', '\u96d5\u5851'),
    ('toyculture', '\u6f6e\u73a9\u6587\u521b'),
    ('scene', '\u573a\u666f'),
    ('project', '\u9879\u76ee'),
]
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}
COVER_WORDS = ('cover', '\u5c01\u9762', '\u9996\u56fe', '\u4e3b\u56fe', 'hero')
MAX_SIZE = (1920, 1920)


def natural_key(value):
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r'(\d+)', str(value))]


def image_files(directory):
    return sorted(
        [path for path in directory.iterdir() if path.is_file() and path.suffix.casefold() in IMAGE_EXTENSIONS],
        key=lambda path: natural_key(path.name),
    )


def cover_key(path):
    name = path.stem.casefold()
    return (0 if any(word in name for word in COVER_WORDS) else 1, natural_key(path.name))


def collect_projects(category_dir, category_name):
    projects = []
    for directory, child_dirs, _ in os.walk(category_dir):
        child_dirs.sort(key=natural_key)
        current = Path(directory)
        if current == category_dir:
            continue
        files = image_files(current)
        if not files:
            continue
        relative_parts = current.relative_to(category_dir).parts
        title = relative_parts[-1]
        projects.append({
            'title': title,
            'pathLabel': ' / '.join((category_name, *relative_parts)),
            'files': sorted(files, key=cover_key),
        })

    projects.sort(key=lambda project: natural_key(project['pathLabel']))
    for path in image_files(category_dir):
        projects.append({
            'title': path.stem,
            'pathLabel': category_name,
            'files': [path],
        })
    return projects


def convert_image(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as opened:
        image = ImageOps.exif_transpose(opened)
        if getattr(image, 'is_animated', False):
            image.seek(0)
        has_alpha = image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info)
        image = image.convert('RGBA' if has_alpha else 'RGB')
        image.thumbnail(MAX_SIZE, Image.Resampling.LANCZOS)
        save_args = {'format': 'WEBP', 'quality': 84, 'method': 6}
        if has_alpha:
            save_args['alpha_quality'] = 90
        image.save(destination, **save_args)


def main():
    if OUTPUT_ROOT.exists():
        shutil.rmtree(OUTPUT_ROOT)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    manifest = {}
    total_images = 0
    for category_key, category_name in CATEGORY_MAP:
        category_dir = SOURCE_ROOT / category_name
        projects = collect_projects(category_dir, category_name) if category_dir.exists() else []
        output_projects = []
        for project_index, project in enumerate(projects, start=1):
            project_id = f'{category_key}-{project_index:02d}'
            project_output = OUTPUT_ROOT / category_key / project_id
            images = []
            for image_index, source in enumerate(project['files'], start=1):
                destination = project_output / f'image-{image_index:02d}.webp'
                convert_image(source, destination)
                relative = destination.relative_to(OUTPUT_ROOT.parent.parent.parent).as_posix()
                images.append({
                    'src': relative,
                    'alt': f"{project['title']} \u00b7 \u4f5c\u54c1 {image_index:02d}",
                })
                total_images += 1
            output_projects.append({
                'id': project_id,
                'title': project['title'],
                'pathLabel': project['pathLabel'],
                'cover': images[0],
                'images': images,
            })
        manifest[category_key] = output_projects
        print(f'{category_key}: {len(output_projects)} projects')

    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = 'export const galleryCollections = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n'
    MANIFEST_PATH.write_text(content, encoding='utf-8')
    print(f'images: {total_images}')
    print(f'manifest: {MANIFEST_PATH}')


if __name__ == '__main__':
    main()
