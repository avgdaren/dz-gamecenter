"""作者：GPT / Codex；原插件 (C) 2026 Carinoasd。FFmpeg探测与跨版本输出解析回归。"""
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch
spec = importlib.util.spec_from_file_location('music_assets', Path(__file__).with_name('music-assets-check.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class ParserTests(unittest.TestCase):
    def test_stderr(self):
        self.assertEqual(module.parse_loudnorm('prefix\n{"input_i":"-12.50","input_tp":"-1.9"}')['input_i'], '-12.50')
    def test_stdout_fallback(self):
        self.assertEqual(module.parse_loudnorm(None, '{"input_i":"-12.49","input_tp":"-1"}')['input_tp'], '-1')
    def test_unrelated_braces(self):
        self.assertEqual(module.parse_loudnorm('{not json}\n{}\n{"input_i":-12,"input_tp":-1}')['input_i'], -12)
    def test_missing_diagnostic(self):
        with self.assertRaisesRegex(ValueError, 'stderr.*unsupported'):
            module.parse_loudnorm('unsupported loudnorm version', None)
    def test_none_diagnostic(self):
        with self.assertRaisesRegex(ValueError, 'JSON missing'):
            module.parse_loudnorm(None, None)
    def test_missing_executable(self):
        with patch.dict(module.os.environ, {'FFMPEG_BIN': '/no-such-ffmpeg'}), patch.object(module.shutil, 'which', return_value=None):
            self.assertIsNone(module.executable())
if __name__ == '__main__':
    unittest.main()
