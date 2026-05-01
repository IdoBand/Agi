# Tutor Knowledge

Each `.md` file is a self-contained lesson the tutor agent can read.
Register every file in `manifest.json` — the manifest is the only thing the
agent sees up front, and only files listed there are readable.

Manifest entry shape:
```json
{ "path": "filename.md", "title": "...", "summary": "...", "tags": ["..."] }
```
Keep `summary` tight — agent uses it to decide whether to read the file.
