"""Convertit les images du catalogue livré (issue n°8).

Lit le manifeste écrit par `build-official-catalog.mjs` (fichier `images/…` -> archive et membre),
extrait chaque membre des archives `images-*.zip` de la publication dofus-sqlite et l'enregistre
en WebP, 256 px au plus sur le grand côté (jamais agrandi), dans `resources/images/`.

Usage : python -I scripts/catalog/convert-images.py <manifeste> <dossier des archives> <sortie>
Dépendance : Pillow. Outil ponctuel de mise à jour des données, absent de la CI.
"""

import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image

MAX_SIDE = 256


def main() -> int:
    if len(sys.argv) != 4:
        print(__doc__)
        return 2
    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    archives_dir = Path(sys.argv[2])
    out_dir = Path(sys.argv[3])
    out_dir.mkdir(parents=True, exist_ok=True)

    opened: dict[str, zipfile.ZipFile] = {}
    total = 0
    for target, src in sorted(manifest["images"].items()):
        archive = opened.setdefault(src["archive"], zipfile.ZipFile(archives_dir / src["archive"]))
        with archive.open(src["member"]) as f:
            img = Image.open(io.BytesIO(f.read()))
            img.load()
        img = img.convert("RGBA")
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        dest = out_dir / Path(target).name
        img.save(dest, "WEBP", quality=82, method=6)
        total += dest.stat().st_size
    print(f"{len(manifest['images'])} images, {total // 1024} Ko -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
