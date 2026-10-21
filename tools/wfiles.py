"""Write several project files from a JSON payload on stdin.
Payload: {"root": "<dir>", "files": {"<relpath>": "<content>", ...}}
"""
import json, os, sys

payload = json.load(sys.stdin)
root = payload.get("root", ".")
written = []
for rel, content in payload["files"].items():
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
    written.append(f"{rel} ({len(content)}b)")
print("\n".join(written))
print(f"-- {len(written)} file(s) written under {root}")
