"""Vendor the pinned browser runtime; network is needed only when updating it."""

import base64
import hashlib
import io
from pathlib import Path
import tarfile
from urllib.request import urlopen

VERSION = "25.6.0"
INTEGRITY = "tTn8fLrwBYtnclpL5aPXK/tAYBLWVvoHM1zdfXoRNLcI+RvtMsoZRV98ePlaW3khHYKuNh/Q65W/+NVFUeIwVw=="
TARGET = Path(__file__).resolve().parents[1] / "web" / "vendor"


def main():
    with urlopen(f"https://registry.npmjs.org/i18next/-/i18next-{VERSION}.tgz", timeout=30) as response:
        data = response.read()
    if base64.b64encode(hashlib.sha512(data).digest()).decode() != INTEGRITY:
        raise ValueError("i18next archive integrity mismatch")
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        assets = {f"i18next-{VERSION}.min.js": "package/dist/umd/i18next.min.js",
                  "i18next.LICENSE": "package/LICENSE"}
        TARGET.mkdir(parents=True, exist_ok=True)
        for name, member in assets.items():
            content = archive.extractfile(member).read()
            (TARGET / name).write_bytes(content)
            print(name, hashlib.sha256(content).hexdigest())


if __name__ == "__main__":
    main()
