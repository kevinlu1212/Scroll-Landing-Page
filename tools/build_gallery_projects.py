import hashlib
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

CATEGORY_DESCRIPTIONS = {
    'sculpture': '图集记录《{title}》从形体研究、材料塑造到最终作品呈现的过程与细节。',
    'toyculture': '图集展示《{title}》的角色设定、造型设计、材质表现与衍生应用。',
    'scene': '图集集中展示《{title}》的空间构思、光影氛围、材质细节与最终视觉呈现。',
    'project': '图集汇总《{title}》的概念研究、设计过程与最终成果。',
}
PROJECT_DESCRIPTIONS = {
    '项目 / pawooo帕呜 / pawooo✖mando蛋糕模型': '围绕宠物主题与甜品场景展开的联名造型设计，图集记录角色比例、材质表现与产品化呈现过程。',
    '项目 / pawooo帕呜 / 宠物手办周边定制': '以真实宠物特征为基础进行手办定制，通过造型提炼、神态捕捉与材质表现保留每只宠物的独特识别度。',
    '项目 / 泥人张 / 企业定制彩塑': '面向企业品牌需求进行传统彩塑的当代表达，将品牌符号、人物形象与手工艺语言整合为定制作品。',
    '项目 / 泥人张 / 陶瓷文创': '以传统文化元素为基础探索陶瓷文创产品，通过器型、釉色与视觉符号建立兼具文化感与日常价值的设计。',
    '项目 / 泥人张 / 马年限定文创作品': '围绕马年生肖主题完成限定文创系列，从角色概念、造型推演到产品展示形成完整的节日产品叙事。',
}


TITLE_DESCRIPTIONS = {
    "北齐微笑": "著名佛像《北齐微笑》临摹。",
    "漠": "作品以作者喜爱的云为意象，人物一头扎进云中，想表达在情感模式的社会现象和议题下，我们要寻找像‘云’一样的事物寻找和专注自己，完成主体性的实现。",
    "卢沟桥群雕": "以卢沟桥事变和抗日战争为主要背景，创作的一组纪念性群雕雕塑",
    "沧海日出": "沧海日出浮雕作品展示",
    "觅": "雕塑作品《觅》，表达客观与主体的矛盾，如何平衡混沌与秩序，与自我的审视",
    "IP潮玩、衍生品设计": "图集展示对潮玩的临摹模型与创作。",
    "小青岛探路者咖啡空间": "小青岛位于青岛市南区琴屿路26号，是独立在海中的一座小岛；小青岛作为户外运动品牌探路者的品牌宣发和户外活动体验场所，作为小青岛探路者咖啡空间主要负责人，结合探路者品牌调性与青岛在地气候和风格，将一座商务会客用的空间，改造设计探路者户外品牌展示与咖啡一体的咖啡空间，创造新奇的户外生活方式体验。",
    "次世代游戏模型": "图集集中展示次世代游戏建模的材质细节与最终视觉呈现。",
    "电影场景气氛图": "图集为电影小镇项目中制作的以民国时代为背景的街道场景、鸟瞰场景以及室内场景的渲染气氛图",
    "pawooo✖mando蛋糕模型": "pawooo是我个人创立负责的一个宠物定制周边品牌，图集是围绕宠物主题与甜品品牌展开的联名造型设计，为mando宠物鲜粮定制的宠物蛋糕展示模型",
    "宠物手办周边定制": "pawooo帕呜是我个人创立的一个宠物定制化周边品牌，以宠物定制场景手办为主要内容，通过造型提炼、神态捕捉与材质表现保留每只宠物的独特识别度，'每一只宠物都是我们亲手选择的家人。'",
    "企业定制彩塑": "面向企业品牌需求进行传统彩塑的当代表达，将品牌符号、手工艺语言和彩塑技艺整合为的定制彩塑作品。",
    "马年限定文创作品": "围绕马年生肖主题和泥人张彩塑技艺和泥人张的文化特征，完成限定文创的创新系列，从0-1完成从概念、造型推演到产品展示形成完整的节日产品叙事。产品包括《马上又财》彩塑摆件和《瑞马凝香》茶香浮雕香挂",
}


def project_description(category_key, project):
    return TITLE_DESCRIPTIONS.get(
        project['title'],
        PROJECT_DESCRIPTIONS.get(
            project['pathLabel'],
            CATEGORY_DESCRIPTIONS[category_key].format(title=project['title']),
        ),
    )


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
            'group': relative_parts[0] if len(relative_parts) > 1 else '',
            'pathLabel': ' / '.join((category_name, *relative_parts)),
            'files': sorted(files, key=cover_key),
        })

    projects.sort(key=lambda project: natural_key(project['pathLabel']))
    for path in image_files(category_dir):
        projects.append({
            'title': path.stem,
            'group': '',
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
                content_hash = hashlib.sha256(destination.read_bytes()).hexdigest()[:10]
                images.append({
                    'src': f'{relative}?v={content_hash}',
                    'alt': f"{project['title']} \u00b7 \u4f5c\u54c1 {image_index:02d}",
                })
                total_images += 1
            output_projects.append({
                'id': project_id,
                'title': project['title'],
                'group': project['group'],
                'pathLabel': project['pathLabel'],
                'description': project_description(category_key, project),
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
