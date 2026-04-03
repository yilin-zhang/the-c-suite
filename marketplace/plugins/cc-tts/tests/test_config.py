"""Tests for load_config() and generate_mp3() rate flag."""
import json
import os
import subprocess
import sys
import tempfile
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
import tts_daemon


class TestLoadConfig:

    def _write_config(self, data, dir_):
        path = os.path.join(dir_, 'config.json')
        with open(path, 'w') as f:
            json.dump(data, f)
        return path

    def test_returns_defaults_when_file_missing(self):
        voice, rate = tts_daemon.load_config('/nonexistent/config.json')
        assert voice == tts_daemon.DEFAULT_VOICE
        assert rate == '+0%'

    def test_returns_defaults_when_path_is_none(self):
        voice, rate = tts_daemon.load_config(None)
        assert voice == tts_daemon.DEFAULT_VOICE
        assert rate == '+0%'

    def test_reads_custom_voice(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_config({'voice': 'en-GB-SoniaNeural', 'rate': 1.0}, d)
            voice, rate = tts_daemon.load_config(path)
            assert voice == 'en-GB-SoniaNeural'

    def test_rate_1_gives_plus_zero(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_config({'rate': 1.0}, d)
            _, rate = tts_daemon.load_config(path)
            assert rate == '+0%'

    def test_rate_above_1_gives_positive(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_config({'rate': 1.5}, d)
            _, rate = tts_daemon.load_config(path)
            assert rate == '+50%'

    def test_rate_below_1_gives_negative(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_config({'rate': 0.75}, d)
            _, rate = tts_daemon.load_config(path)
            assert rate == '-25%'

    def test_invalid_json_returns_defaults(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, 'config.json')
            with open(path, 'w') as f:
                f.write('not valid json')
            voice, rate = tts_daemon.load_config(path)
            assert voice == tts_daemon.DEFAULT_VOICE
            assert rate == '+0%'

    def test_invalid_rate_value_returns_defaults(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_config({'rate': 'fast'}, d)
            voice, rate = tts_daemon.load_config(path)
            assert voice == tts_daemon.DEFAULT_VOICE
            assert rate == '+0%'

    def test_missing_keys_use_defaults(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_config({}, d)
            voice, rate = tts_daemon.load_config(path)
            assert voice == tts_daemon.DEFAULT_VOICE
            assert rate == '+0%'


class TestGenerateMp3Rate:

    @mock.patch('subprocess.run')
    def test_rate_flag_passed_to_edge_tts(self, mock_run):
        tts_daemon.VOICE = 'en-US-ChristopherNeural'
        tts_daemon.RATE = '+50%'
        tts_daemon.generate_mp3('Hello.', '/tmp/out.mp3')
        args = mock_run.call_args[0][0]
        assert '--rate' in args
        assert '+50%' in args

    @mock.patch('subprocess.run')
    def test_voice_flag_passed_to_edge_tts(self, mock_run):
        tts_daemon.VOICE = 'en-GB-SoniaNeural'
        tts_daemon.RATE = '+0%'
        tts_daemon.generate_mp3('Hello.', '/tmp/out.mp3')
        args = mock_run.call_args[0][0]
        assert '--voice' in args
        assert 'en-GB-SoniaNeural' in args
