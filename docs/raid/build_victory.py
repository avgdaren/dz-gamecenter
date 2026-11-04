#!/usr/bin/env python3
"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。CC0 胜利曲处理；输入必须是署名文档中的原文件。"""
import array
import hashlib
from pathlib import Path
import subprocess
import sys
import tempfile

SOURCE_SHA256 = '1148060f2fbf4f84914dce2ce754beb08c98597f286d106e7c5dfc2b1c264b8f'

def main():
    source, output = map(Path, sys.argv[1:])
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError('Source SHA-256 mismatch; see BGM-CREDITS.md')
    with tempfile.TemporaryDirectory() as temp:
        normalized, ring = (Path(temp)/name for name in ('normalized.f32', 'ring.f32'))
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-af',
            'atrim=0:32,apad=pad_dur=0.5,loudnorm=I=-12.5:TP=-2:LRA=7,atrim=0:32',
            '-ar','44100','-ac','2','-f','f32le',str(normalized)],check=True)
        samples = array.array('f'); samples.frombytes(normalized.read_bytes())
        if sys.byteorder != 'little': samples.byteswap()
        n, channels = 11025, 2  # 250 ms circular crossfade after loudness normalization.
        out = samples[n*channels:-n*channels]
        for i in range(n):
            t = i/(n-1)
            for c in range(channels):
                out.append(samples[-n*channels+i*channels+c]*(1-t)+samples[i*channels+c]*t)
        # A 10 ms de-click ramp at each end also protects MP3 endpoint quantization.
        ramp = 441
        for i in range(ramp):
            gain = i/(ramp-1)
            for c in range(channels):
                out[i*channels+c] *= gain
                out[-(i+1)*channels+c] *= gain
        if sys.byteorder != 'little': out.byteswap()
        ring.write_bytes(out.tobytes())
        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','f32le','-ar','44100',
            '-ac','2','-i',str(ring),'-map_metadata','-1','-c:a','libmp3lame','-b:a','128k',str(output)],check=True)
    print(hashlib.sha256(output.read_bytes()).hexdigest(), output.stat().st_size)

if __name__ == '__main__': main()
