"""Synthesize a small SFX kit and place it on the film's motion events.
Usage: python sfx.py <film_dir>   -> <film_dir>/audio/sfx/*.wav and <film_dir>/audio/events.json"""
import json, sys, wave
from pathlib import Path
import numpy as np

SR = 48000
film = Path(sys.argv[1])
out = film / "audio" / "sfx"
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(SR * d)) / SR


def lowpass(x, cut):  # one-pole, cutoff may vary per sample
    cut = np.broadcast_to(cut, x.shape)
    a = 1 - np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc); y[i] = acc
    return y


def save(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.89
    st = np.stack([x, x], 1)
    with wave.open(str(out / f"{name}.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype("<i2").tobytes())


def whoosh(d, peak, lo, hi):
    tt = t(d); n = rng.standard_normal(len(tt))
    env = np.where(tt < peak, (tt / peak) ** 2.2, np.exp(-(tt - peak) / (d - peak) * 4))
    cut = lo + (hi - lo) * np.clip(env, 0, 1)
    band = lowpass(n, cut) - lowpass(n, cut * .25)
    return band * env


def blip(f0, f1, d, k):
    tt = t(d); f = f0 + (f1 - f0) * np.clip(tt / d, 0, 1)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * k)


def bell(f, d, k):
    tt = t(d)
    return (np.sin(2 * np.pi * f * tt) + .35 * np.sin(2 * np.pi * f * 2.01 * tt) + .12 * np.sin(2 * np.pi * f * 3.02 * tt)) * np.exp(-tt * k) * np.minimum(tt / .004, 1)


save("whoosh", whoosh(.55, .38, 500, 5200))
save("whip", whoosh(.32, .12, 900, 7000))
tt = t(.4)
save("thump", np.sin(2 * np.pi * np.cumsum(70 - 28 * tt / .4) / SR) * np.exp(-tt * 11) + .3 * rng.standard_normal(len(tt)) * np.exp(-tt * 160))
save("pop", blip(520, 880, .09, 45))
save("pop_hi", blip(760, 1180, .08, 50))
save("tick", blip(1500, 1400, .03, 160))
tt = t(.05)
save("click", .7 * lowpass(rng.standard_normal(len(tt)), 6000) * np.exp(-tt * 400) + np.sin(2 * np.pi * 2200 * tt) * np.exp(-tt * 260))
for i in range(3):
    tt = t(.035)
    save(f"key{i}", lowpass(rng.standard_normal(len(tt)), 3500 + 900 * i) * np.exp(-tt * 220) + .3 * np.sin(2 * np.pi * (180 + 40 * i) * tt) * np.exp(-tt * 120))
save("count", blip(3000, 2900, .018, 300))
save("ding", bell(1318.5, 1.0, 4.5))
c = np.zeros(int(SR * 1.4)); a = bell(880, 1.2, 4); b = bell(1318.5, 1.2, 3.6); o = int(SR * .09)
c[:len(a)] += a; c[o:o + len(b)] += b
save("chime", c)
tt = t(1.3)
boom = np.sin(2 * np.pi * np.cumsum(62 - 22 * np.clip(tt / .5, 0, 1)) / SR) * np.exp(-tt * 4.5)
shimmer = sum(np.sin(2 * np.pi * f * tt) for f in (1760, 2637, 3520)) / 3 * np.exp(-tt * 2.6) * .25
save("impact", boom + .5 * lowpass(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 22) + shimmer)

# air bed: soft low room tone that swells into each cut (keeps the film from going digitally silent)
DUR = 33.0
tt = t(DUR); n = lowpass(rng.standard_normal(len(tt)), 900) - lowpass(rng.standard_normal(len(tt)), 120) * .5
cuts = [e["t"] for e in json.loads((film / "final.mp4.events.json").read_text(encoding="utf-8")) if e["type"] == "cut"]
sw = np.full(len(tt), .35)
for c in cuts: sw += .65 * np.exp(-((tt - c + .15) / .35) ** 2)
fade = np.minimum(1, tt / .3) * np.minimum(1, (DUR - tt) / .15)
save("bed", n * sw * fade * .5)

# --- place on the film's motion events ---
ev = json.loads((film / "final.mp4.events.json").read_text(encoding="utf-8"))
P = []
def add(sec, name, gain):
    P.append({"t": round(max(sec, 0), 3), "sfx": f"sfx/{name}.wav", "gain": gain})

last_word = -9
for e in ev:
    s, ty, lab = e["t"], e["type"], e.get("label", "")
    if ty == "cut":
        add(s - .38, "whoosh", -5)
        if not any(x["t"] == s and x["type"] in ("snap",) or (x["t"] == s and x.get("label") == "#logo") for x in ev):
            add(s, "thump", -11)
    elif ty == "whip":
        add(s - .05, "whip", -4)
    elif ty == "snap":
        add(s, "thump", -7)
    elif ty == "press":
        add(s, "click", -4)
    elif ty == "enter" and lab.startswith("#"):
        if lab == "#logo": add(s, "impact", -1)
        elif lab == "#sb": add(s - .08, "whip", -9)
        elif lab == "#dim": pass
        elif lab.startswith("#ev") or lab.startswith("#n"): add(s, "pop_hi" if int(e["frame"]) % 2 else "pop", -15)
        else: add(s, "pop", -11)
    elif ty == "enter":  # a word rising: soft tick, never two in one frame
        if e["frame"] - last_word >= 2: add(s, "tick", -22)
        last_word = e["frame"]
    elif ty == "show":
        if "conclu" in lab: add(s, "chime", -2)
        elif "B2" in lab: add(s, "ding", -6)
        else: add(s, "ding", -14)
    elif ty == "count" and lab.startswith("start"):
        for k in range(0, 22, 2): add(s + k / 30, "count", -21)

types = [x for x in ev if x["type"] == "type"]
if len(types) == 2:  # key ticks with an irregular, repeatable rhythm
    f, i = types[0]["frame"], 0
    gaps = [2, 3, 2, 1, 3, 2, 4, 2, 2, 3]
    while f <= types[1]["frame"]:
        add(f / 30, f"key{i % 3}", -14); f += gaps[i % len(gaps)]; i += 1

add(0, "bed", -20)
P.sort(key=lambda x: x["t"])
(film / "audio" / "events.json").write_text(json.dumps(P, indent=0), encoding="utf-8")
print(len(P), "placements")
