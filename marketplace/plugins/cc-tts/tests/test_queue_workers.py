"""Tests for queue workers and clear_queues."""
import os
import subprocess
import sys
import tempfile
import threading
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
import tts_daemon


class TestClearQueues:

    def test_drains_text_queue(self):
        tts_daemon.text_queue.put("hello")
        tts_daemon.text_queue.put("world")
        tts_daemon.clear_queues()
        assert tts_daemon.text_queue.empty()

    def test_drains_audio_queue_and_cleans_files(self):
        _, path = tempfile.mkstemp(suffix='.mp3')
        with open(path, 'wb') as f:
            f.write(b'fake mp3')
        tts_daemon.audio_queue.put(path)
        tts_daemon.clear_queues()
        assert tts_daemon.audio_queue.empty()
        assert not os.path.exists(path)

    def test_handles_missing_audio_file(self):
        tts_daemon.audio_queue.put("/tmp/nonexistent_cc_tts_test.mp3")
        tts_daemon.clear_queues()  # should not raise
        assert tts_daemon.audio_queue.empty()

    def test_handles_none_in_audio_queue(self):
        tts_daemon.audio_queue.put(None)
        tts_daemon.clear_queues()  # should not raise
        assert tts_daemon.audio_queue.empty()

    def test_empty_queues_noop(self):
        tts_daemon.clear_queues()  # should not raise
        assert tts_daemon.text_queue.empty()
        assert tts_daemon.audio_queue.empty()


class TestGeneratorWorker:

    def test_poison_pill_stops_worker(self):
        tts_daemon.text_queue.put(None)
        t = threading.Thread(target=tts_daemon.generator_worker, daemon=True)
        t.start()
        t.join(timeout=2)
        assert not t.is_alive()
        # Poison pill should propagate to audio_queue
        item = tts_daemon.audio_queue.get(timeout=1)
        assert item is None

    @mock.patch('tts_daemon.generate_mp3')
    def test_generates_and_concatenates(self, mock_gen):
        """Generator should split sentences, call generate_mp3, and produce a combined file."""
        def fake_gen(text, outfile):
            with open(outfile, 'wb') as f:
                f.write(text.encode())
        mock_gen.side_effect = fake_gen

        tts_daemon.text_queue.put("Hello world. How are you?")
        tts_daemon.text_queue.put(None)  # poison pill to stop

        t = threading.Thread(target=tts_daemon.generator_worker, daemon=True)
        t.start()
        t.join(timeout=5)

        combined_path = tts_daemon.audio_queue.get(timeout=1)
        assert combined_path is not None
        assert os.path.exists(combined_path)

        with open(combined_path, 'rb') as f:
            content = f.read()
        assert b"Hello world." in content
        assert b"How are you?" in content
        os.unlink(combined_path)

    @mock.patch('tts_daemon.generate_mp3')
    def test_handles_generate_failure(self, mock_gen):
        """If edge-tts fails to create a file, generator should not crash."""
        def fail_gen(text, outfile):
            pass  # don't create the file
        mock_gen.side_effect = fail_gen

        tts_daemon.text_queue.put("Test sentence.")
        tts_daemon.text_queue.put(None)

        t = threading.Thread(target=tts_daemon.generator_worker, daemon=True)
        t.start()
        t.join(timeout=5)
        assert not t.is_alive()

        # Should still produce a (empty) combined file
        combined_path = tts_daemon.audio_queue.get(timeout=1)
        assert combined_path is not None
        os.unlink(combined_path)


class TestPlayerWorker:

    def test_poison_pill_stops_worker(self):
        tts_daemon.audio_queue.put(None)
        t = threading.Thread(target=tts_daemon.player_worker, daemon=True)
        t.start()
        t.join(timeout=2)
        assert not t.is_alive()

    @mock.patch('subprocess.run')
    def test_plays_and_cleans_up(self, mock_run):
        _, path = tempfile.mkstemp(suffix='.mp3')
        with open(path, 'wb') as f:
            f.write(b'fake')

        tts_daemon.audio_queue.put(path)
        tts_daemon.audio_queue.put(None)

        t = threading.Thread(target=tts_daemon.player_worker, daemon=True)
        t.start()
        t.join(timeout=2)

        mock_run.assert_called_with(
            ['afplay', path],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        assert not os.path.exists(path)

    @mock.patch('subprocess.run')
    def test_handles_missing_file(self, mock_run):
        tts_daemon.audio_queue.put("/tmp/nonexistent_cc_tts_test.mp3")
        tts_daemon.audio_queue.put(None)

        t = threading.Thread(target=tts_daemon.player_worker, daemon=True)
        t.start()
        t.join(timeout=2)
        assert not t.is_alive()  # should not crash
