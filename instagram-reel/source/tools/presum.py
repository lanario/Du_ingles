"""Sum placed SFX (audio/events.json) into one 48 kHz stereo wav: python presum.py <film_dir> <seconds>"""
import json, sys, wave
from pathlib import Path
import numpy as np
film, dur, SR = Path(sys.argv[1]), float(sys.argv[2]), 48000
bus = np.zeros((int(SR * dur), 2))
for p in json.loads((film / "audio/events.json").read_text()):
    with wave.open(str(film / "audio" / p["sfx"])) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, 2) / 32767
    i = int(p["t"] * SR); x = x[: len(bus) - i] * 10 ** (p["gain"] / 20)
    bus[i:i + len(x)] += x
bus /= max(1.0, np.abs(bus).max() / .95)
with wave.open(str(film / "audio/sfx_bus.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((bus * 32767).astype("<i2").tobytes())
