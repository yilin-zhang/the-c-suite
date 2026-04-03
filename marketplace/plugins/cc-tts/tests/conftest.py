import os
import queue
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
import tts_daemon


@pytest.fixture(autouse=True)
def reset_queues():
    """Drain both queues before each test."""
    for q in (tts_daemon.text_queue, tts_daemon.audio_queue):
        while True:
            try:
                q.get_nowait()
                q.task_done()
            except queue.Empty:
                break
