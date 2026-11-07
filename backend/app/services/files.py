from pathlib import Path

from werkzeug.datastructures import FileStorage
from werkzeug.utils import secure_filename


def save_attachments(files: list[FileStorage], folder: Path) -> list[dict]:
    """Save uploaded files into `folder` and return info about each one.

    Any file type is accepted. Filenames are sanitised, and duplicates get
    a _1, _2... suffix so nothing is overwritten.
    """
    saved = []
    for upload in files:
        folder.mkdir(parents=True, exist_ok=True)
        safe = secure_filename(upload.filename or "") or "file"
        stem, suffix = Path(safe).stem, Path(safe).suffix

        path = folder / safe
        counter = 1
        while path.exists():
            path = folder / f"{stem}_{counter}{suffix}"
            counter += 1

        upload.save(path)
        saved.append(
            {
                "name": path.name,
                "original_name": upload.filename,
                "size": path.stat().st_size,
                "content_type": upload.mimetype,
            }
        )
    return saved
