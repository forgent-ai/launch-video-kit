"""Record lines as German/English segments in ONE ElevenLabs voice and splice them, so brand and
English terms ("Forgent", "bid, no-bid") are spoken in English inside German lines (Tom 2026-10-16).
usage: python3 tools/vo_splice.py <film-dir> <voice_id> [stability]
Segments come from <film-dir>/vo_segments.json: {"02": [["en","Forgent."],["de","Die KI-Plattform ..."]], ...}
Lines without an entry are recorded whole. Writes <film-dir>/vo/body/line-<id>.wav (48 kHz mono) one file at a time."""
import json, pathlib, subprocess, sys, tempfile
sys.path.insert(0, str(pathlib.Path.home() / "reel-studio"))
import eleven_vo as e

film = pathlib.Path(sys.argv[1]); voice = sys.argv[2]; stab = sys.argv[3] if len(sys.argv) > 3 else "0.8"
env = e.load_env(); env["ELEVENLABS_STABILITY"] = stab; env["ELEVENLABS_STYLE"] = "0"
lines = json.load(open(film / "film.json"))["lines"]
segs = json.load(open(film / "vo_segments.json")) if (film / "vo_segments.json").exists() else {}
plan = {k: segs.get(k, [["de", t]]) for k, t in lines.items()}
e.budget_gate(env, sum(len(s[1]) * (4 if s[0] == 'en' else 1) for v in plan.values() for s in v))
import re
def norm(t): return re.sub(r"[^a-z ]", " ", t.lower().replace("-", ""))
def hear(wav, td):
    w16 = td / "h.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ar", "16000", "-ac", "1", str(w16)], check=True)
    out = subprocess.run(["whisper-cli", "-m", str(pathlib.Path(__file__).resolve().parent.parent / "models/ggml-small.bin"), "-l", "en", "-f", str(w16), "-np", "-nt"], capture_output=True, text=True).stdout
    return norm(out).split()
TRIM = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.04,areverse"
for k, parts in plan.items():
    with tempfile.TemporaryDirectory() as td:
        td = pathlib.Path(td); files = []
        for i, (lang, text) in enumerate(parts):
            raw = td / f"s{i}.wav"
            if lang == "en":   # English takes vary: keep the first one whisper (en) hears as intended, max 4
                want = [w for w in norm(text.replace("FOR-jent", "Forgent")).split() if w]
                for take in range(4):
                    e.tts(env, text, voice, raw)
                    heard = hear(raw, td)
                    if "".join(want) in "".join(heard): break   # compare joined: "no bid" == "nobid", "for gent" == "forgent"
                    print(f"  line {k} seg {i} take {take + 1}: heard {heard}, want {want}; retry")
            else:
                e.tts(env, text, voice, raw)
            cut = td / f"c{i}.wav"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-af", TRIM, "-ar", "48000", "-ac", "1", str(cut)], check=True)
            files.append(cut)
            if i < len(parts) - 1:   # pause: longer after a full stop
                gap = td / f"g{i}.wav"; dur = 0.32 if text.rstrip().endswith(".") else 0.07
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"anullsrc=r=48000:cl=mono", "-t", str(dur), str(gap)], check=True)
                files.append(gap)
        lst = td / "list.txt"; lst.write_text("".join(f"file '{p}'\n" for p in files))
        out = film / f"vo/body/line-{k}.wav"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-ar", "48000", "-ac", "1", str(out)], check=True)
        print(f"line {k}: {' | '.join(f'{l}:{t}' for l, t in parts)}")
