"""Prepare the pump pour; requires numpy, soundfile and imageio-ffmpeg.
Usage: python scripts/assets/prepare_pump_water.py [download-cache-directory]
"""
from pathlib import Path
import hashlib, json, subprocess, sys, tempfile, urllib.request
import numpy as np
import soundfile as sf
import imageio_ffmpeg


def prepare(cache, out):
    cache.mkdir(parents=True, exist_ok=True)
    source = cache / 'water.ogg'
    url = 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Water_flowing_pouring_trickling.ogg'
    if not source.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'VR-Snow-asset-preparation/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response:
            source.write_bytes(response.read())
    # This Ogg contains a Skeleton stream; decode with FFmpeg before processing.
    decoded = cache / 'water-decoded.wav'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y', '-i', str(source), str(decoded)], check=True)
    samples, rate = sf.read(decoded, always_2d=True)
    samples = samples[round(30*rate):round(30.95*rate)].mean(axis=1)
    width = max(1, round(rate/22050))
    samples = np.convolve(samples, np.ones(width)/width, mode='same')
    data = np.interp(np.arange(round(.95*22050))*rate/22050, np.arange(len(samples)), samples)
    data -= data.mean()
    data *= .65/np.max(np.abs(data))
    fade = round(.012*22050)
    data[:fade] *= np.linspace(0, 1, fade)
    data[-fade:] *= np.linspace(1, 0, fade)
    target = out/'pump-water.wav'
    sf.write(target, data, 22050, subtype='PCM_16')
    manifest_path = out/'sources.json'
    manifest = json.loads(manifest_path.read_text())
    manifest = [item for item in manifest if item['file'] != target.name]
    manifest.append(dict(file=target.name, original=source.name,
        source='https://commons.wikimedia.org/wiki/File:Water_flowing_pouring_trickling.ogg',
        author='stephan / PDSounds', license='Public-domain',
        sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        sha256=hashlib.sha256(target.read_bytes()).hexdigest(), seconds=round(len(data)/22050, 4),
        bytes=target.stat().st_size,
        changes='Excerpt 30-30.95 seconds; mono, low-pass/downsampled to 22050 Hz, DC removal, peak normalized, 12 ms edge fades'))
    manifest_path.write_text(json.dumps(manifest, indent=2)+'\n')
    print(f'Pump water: {target.stat().st_size:,} bytes')


if __name__ == '__main__':
    prepare(Path(sys.argv[1]) if len(sys.argv)>1 else Path(tempfile.gettempdir())/'vr-snow-audio',
            Path(__file__).resolve().parents[2]/'public/audio')
