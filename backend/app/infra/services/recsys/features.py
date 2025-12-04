import json
import numpy as np

FEATURE_KEYS = ["tempo", "energy", "valence", "danceability", "loudness", "popularity"]

def feature_vector(track) -> np.ndarray:
    if not getattr(track, "features_json", None):
        return np.zeros(len(FEATURE_KEYS), dtype=float)
    f = json.loads(track.features_json)
    vals = [float(f.get(k, 0.0)) for k in FEATURE_KEYS]
    return np.array(vals, dtype=float)
