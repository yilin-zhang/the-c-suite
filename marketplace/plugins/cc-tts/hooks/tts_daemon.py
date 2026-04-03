#!/usr/bin/env python3
"""
TTS Daemon for Claude Code.

Watches the active session transcript for new assistant text blocks
and plays them via edge-tts in order, streaming as Claude responds.

Communication: reads JSON lines from a named FIFO (path passed as argv[1]).
Message format: {"session_id": "...", "transcript_path": "...", "offset": N}
"""

import json
import os
import queue
import re
import signal
import subprocess
import sys
import tempfile
import threading
import time
from contextlib import suppress

POLL_INTERVAL = 0.2
DEFAULT_VOICE = 'en-US-ChristopherNeural'
DEFAULT_SPEED = 1.0


def load_config(config_path):
    """Load voice and speed from config.json. Returns (voice, rate_str)."""
    voice = DEFAULT_VOICE
    speed = DEFAULT_SPEED
    try:
        if config_path and os.path.exists(config_path):
            with open(config_path) as f:
                cfg = json.load(f)
            voice = cfg.get('voice', DEFAULT_VOICE)
            speed = float(cfg.get('rate', DEFAULT_SPEED))
    except (json.JSONDecodeError, OSError, ValueError):
        pass
    rate_pct = int((speed - 1.0) * 100)
    rate_str = f'+{rate_pct}%' if rate_pct >= 0 else f'{rate_pct}%'
    return voice, rate_str


VOICE, RATE = DEFAULT_VOICE, '+0%'

_CLEAN_PATTERNS = [
    (re.compile(r'```[\s\S]*?```'), ''),
    (re.compile(r'\*\*([^*]*)\*\*'), r'\1'),
    (re.compile(r'\*([^*]*)\*'), r'\1'),
    (re.compile(r'`[^`]*`'), ''),
    (re.compile(r'^#{1,6} ', re.MULTILINE), ''),
    (re.compile(r'^\s*[-*] ', re.MULTILINE), ''),
    (re.compile(r'^\s*\d+\. ', re.MULTILINE), ''),
    (re.compile(r'\n{3,}'), '\n\n'),
]
_SENTENCE_SPLIT = re.compile(r'(?<=[.!?…])\s+')

text_queue = queue.Queue()
audio_queue = queue.Queue()

state_lock = threading.Lock()
current_session_id = None
current_transcript_path = None
current_offset = 0


def clean_text(text):
    for pat, repl in _CLEAN_PATTERNS:
        text = pat.sub(repl, text)
    return text.strip()


def generate_mp3(text, outfile):
    subprocess.run(
        ['edge-tts', '--voice', VOICE, '--rate', RATE, '--text', text, '--write-media', outfile],
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )


def generator_worker():
    while True:
        text = text_queue.get()
        if text is None:
            audio_queue.put(None)
            return

        sentences = [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]
        if not sentences:
            text_queue.task_done()
            continue

        sentence_files = [tempfile.mkstemp(suffix='.mp3', prefix='cc_tts_')[1] for _ in sentences]
        threads = [threading.Thread(target=generate_mp3, args=(s, f)) for s, f in zip(sentences, sentence_files)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        _, combined_path = tempfile.mkstemp(suffix='.mp3', prefix='cc_tts_combined_')
        with open(combined_path, 'wb') as out:
            for f in sentence_files:
                with suppress(FileNotFoundError):
                    with open(f, 'rb') as part:
                        out.write(part.read())
                with suppress(FileNotFoundError):
                    os.unlink(f)

        audio_queue.put(combined_path)
        text_queue.task_done()


def player_worker():
    while True:
        outfile = audio_queue.get()
        if outfile is None:
            return
        subprocess.run(['afplay', outfile],
                       stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        with suppress(FileNotFoundError):
            os.unlink(outfile)
        audio_queue.task_done()


def clear_queues():
    for q in (text_queue, audio_queue):
        while True:
            try:
                item = q.get_nowait()
                if q is audio_queue and item:
                    with suppress(FileNotFoundError):
                        os.unlink(item)
                q.task_done()
            except queue.Empty:
                break


def poll_transcript(pipe_path):
    """
    Main loop: polls active transcript for new assistant text blocks,
    and reads session updates from the named pipe.
    """
    global current_session_id, current_transcript_path, current_offset

    # Open pipe (non-blocking reads via os.read)
    pipe_fd = os.open(pipe_path, os.O_RDONLY | os.O_NONBLOCK)
    pipe_buf = b''

    seen_text_hashes = set()
    trailing_buf = b''

    while True:
        time.sleep(POLL_INTERVAL)

        # --- Read session updates from pipe ---
        try:
            chunk = os.read(pipe_fd, 4096)
            if chunk:
                pipe_buf += chunk
                while b'\n' in pipe_buf:
                    line, pipe_buf = pipe_buf.split(b'\n', 1)
                    try:
                        msg = json.loads(line.decode())
                        new_session_id = msg.get('session_id')
                        new_transcript = msg.get('transcript_path')
                        new_offset = msg.get('offset', 0)
                        with state_lock:
                            if new_session_id != current_session_id:
                                clear_queues()
                                seen_text_hashes.clear()
                                trailing_buf = b''
                            current_session_id = new_session_id
                            current_transcript_path = new_transcript
                            current_offset = new_offset
                    except json.JSONDecodeError:
                        pass
        except BlockingIOError:
            pass

        # --- Poll active transcript ---
        with state_lock:
            transcript_path = current_transcript_path
            offset = current_offset

        if not transcript_path:
            continue

        try:
            with open(transcript_path, 'rb') as f:
                f.seek(offset)
                file_data = f.read()

            if not file_data:
                continue

            # Prepend any leftover partial line from last read
            new_data = trailing_buf + file_data
            trailing_buf = b''

            # Always advance file offset by exactly what we read from disk;
            # trailing_buf is carried separately and prepended next iteration.
            with state_lock:
                current_offset = offset + len(file_data)

            # Split into lines; keep trailing incomplete line buffered
            if not new_data.endswith(b'\n'):
                last_nl = new_data.rfind(b'\n')
                if last_nl == -1:
                    trailing_buf = new_data
                    continue
                trailing_buf = new_data[last_nl + 1:]
                new_data = new_data[:last_nl + 1]

            for raw_line in new_data.splitlines():
                if not raw_line.strip():
                    continue
                try:
                    entry = json.loads(raw_line.decode())
                    if entry.get('type') != 'assistant':
                        continue
                    for block in entry.get('message', {}).get('content', []):
                        if block.get('type') != 'text':
                            continue
                        text = clean_text(block['text'])
                        if not text:
                            continue
                        h = hash(text)
                        if h in seen_text_hashes:
                            continue
                        seen_text_hashes.add(h)
                        text_queue.put(text)
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass

        except OSError:
            pass


def stop_playback(signum, frame):
    """SIGUSR1: kill current afplay and drain queues."""
    subprocess.run(['pkill', '-x', 'afplay'],
                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    clear_queues()


def shutdown(signum, frame):
    sys.exit(0)


def main():
    if len(sys.argv) < 2:
        print("Usage: tts_daemon.py <pipe_path>", file=sys.stderr)
        sys.exit(1)

    pipe_path = sys.argv[1]
    config_path = sys.argv[2] if len(sys.argv) > 2 else None

    global VOICE, RATE
    VOICE, RATE = load_config(config_path)

    # Create named pipe if needed
    if not os.path.exists(pipe_path):
        os.mkfifo(pipe_path)

    signal.signal(signal.SIGTERM, shutdown)
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGUSR1, stop_playback)

    # Start worker threads (daemon=True so they die with main thread)
    gen_thread = threading.Thread(target=generator_worker, daemon=True)
    gen_thread.start()

    play_thread = threading.Thread(target=player_worker, daemon=True)
    play_thread.start()

    poll_transcript(pipe_path)


if __name__ == '__main__':
    main()
