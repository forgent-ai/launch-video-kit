"""Record every line as one continuous read: each ElevenLabs call gets the neighbouring lines as
previous_text / next_text, so the prosody carries across lines (Tom 2026-10-23: the spliced takes sounded choppy).
English words are respelled inline (vo_respell.json: {"Forgent": "Fordschent"}) instead of spliced in.
usage: python3 tools/vo_flow.py <film-dir> <voice_id> [stability] [--only 03,05]
Writes <film-dir>/vo/body/line-<id>.wav (48 kHz mono), one file at a time."""
import json, pathlib, subprocess, sys, tempfile
sys.path.insert(0, str(pathlib.Path.home() / "reel-studio"))
import eleven_vo as e

only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
args = [a for i, a in enumerate(sys.argv) if a != "--only" and (i == 0 or sys.argv[i - 1] != "--only")]
film = pathlib.Path(args[1]); voice = args[2]; stab = float(args[3]) if len(args) > 3 else 0.55
env = e.load_env()
lines = json.load(open(film / "film.json"))["lines"]
resp = json.load(open(film / "vo_respell.json")) if (film / "vo_respell.json").exists() else {}
def say(t):
    for a, b in resp.items(): t = t.replace(a, b)
    return t
ids = list(lines)
todo = [k for k in ids if only is None or k in only]
e.budget_gate(env, sum(len(say(lines[k])) for k in todo))
TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.06,areverse"
for k in todo:
    i = ids.index(k)
    body = {"text": say(lines[k]), "model_id": env.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
            "voice_settings": {"stability": stab, "similarity_boost": 0.75, "style": 0.0},
            "previous_text": " ".join(say(lines[x]) for x in ids[max(0, i - 2):i]),
            "next_text": " ".join(say(lines[x]) for x in ids[i + 1:i + 2])}
    mp3 = e.api(env, f"/v1/text-to-speech/{voice}?output_format=mp3_44100_128", body).read()
    with tempfile.TemporaryDirectory() as td:
        raw = pathlib.Path(td) / "a.mp3"; raw.write_bytes(mp3)
        out = film / f"vo/body/line-{k}.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", TRIM, "-ar", "48000", "-ac", "1", str(out)], check=True)
    print(f"line {k}: {body['text']}")
