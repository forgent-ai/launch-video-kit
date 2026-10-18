"""Clone film/ (the DE master) into film-<name>/ with new lines, hook text and hero/blocks text.
usage: python3 tools/make_variant.py <variants.json> <name>"""
import json, shutil, sys, pathlib
spec = json.load(open(sys.argv[1]))[sys.argv[2]]
src, dst = pathlib.Path("film"), pathlib.Path(f"film-{sys.argv[2]}")
if dst.exists(): shutil.rmtree(dst)
shutil.copytree(src, dst, ignore=shutil.ignore_patterns("renders", "review", "compositions", "index*.html", "timing-*", "mix", "snapshots", "line-*.wav", "lines.json", "takes.json", "film.acme.json"))
f = json.load(open(dst / "film.json"))
f["lines"] = spec["lines"]
heroes = iter(spec["heroes"]); pushes = iter(spec["push_at"])
for b in f["beats"]:
    if b["type"] == "name": b["tagline"] = spec["tagline"]
    elif b["type"] == "hero": b.update(next(heroes))
    elif b["type"] == "product": b["push_at"] = next(pushes)
    elif b["type"] == "blocks": b.update(spec["blocks"])
json.dump(f, open(dst / "film.json", "w"), indent=2, ensure_ascii=False)
h = json.load(open(dst / "hooks/forgent-type/hook.json"))
h["text"] = spec["hook"]["text"]; h["duration"] = spec["hook"]["duration"]
h["sfx"] = [{"t": t["words"][0][1], "sound": "felt_thump", "gain_db": -18} for t in spec["hook"]["text"]]
h["about"] = spec["about"]
json.dump(h, open(dst / "hooks/forgent-type/hook.json", "w"), indent=1, ensure_ascii=False)
json.dump(spec.get("segments", {}), open(dst / "vo_segments.json", "w"), indent=1, ensure_ascii=False)
print(f"{dst}: {len(spec['lines'])} lines, hook {spec['hook']['duration']} s")
