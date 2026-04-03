"""Tests for transcript JSONL parsing and partial-line buffering."""
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
import tts_daemon


def make_transcript_entry(text, type_='assistant'):
    return json.dumps({
        'type': type_,
        'message': {'content': [{'type': 'text', 'text': text}]}
    })


class TestTranscriptParsing:

    def setup_method(self):
        tts_daemon.current_session_id = None
        tts_daemon.current_transcript_path = None
        tts_daemon.current_offset = 0
        self.tmpdir = tempfile.mkdtemp()

    def _write_transcript(self, lines, path=None):
        if path is None:
            path = os.path.join(self.tmpdir, 'transcript.jsonl')
        with open(path, 'ab') as f:
            for line in lines:
                f.write((line + '\n').encode())
        return path

    def _simulate_poll(self, transcript_path, offset, trailing_buf=b''):
        """Simulate one iteration of poll_transcript's file-reading logic.

        Returns (queued_texts, new_offset, new_trailing_buf).
        """
        queued = []
        seen = set()

        try:
            with open(transcript_path, 'rb') as f:
                f.seek(offset)
                file_data = f.read()
        except OSError:
            return queued, offset, trailing_buf

        if not file_data:
            return queued, offset, trailing_buf

        new_data = trailing_buf + file_data
        trailing_buf = b''
        new_offset = offset + len(file_data)

        if not new_data.endswith(b'\n'):
            last_nl = new_data.rfind(b'\n')
            if last_nl == -1:
                return queued, new_offset, new_data
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
                    text = tts_daemon.clean_text(block['text'])
                    if not text:
                        continue
                    h = hash(text)
                    if h not in seen:
                        seen.add(h)
                        queued.append(text)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

        return queued, new_offset, trailing_buf

    def test_reads_complete_lines(self):
        path = self._write_transcript([
            make_transcript_entry("Hello world."),
            make_transcript_entry("Second message."),
        ])
        texts, offset, trailing = self._simulate_poll(path, 0)
        assert texts == ["Hello world.", "Second message."]
        assert trailing == b''
        assert offset > 0

    def test_skips_non_assistant_entries(self):
        path = self._write_transcript([
            make_transcript_entry("user msg", type_='user'),
            make_transcript_entry("assistant msg"),
            make_transcript_entry("tool result", type_='tool_result'),
        ])
        texts, _, _ = self._simulate_poll(path, 0)
        assert texts == ["assistant msg"]

    def test_buffers_partial_line(self):
        """A partial line at the end should be buffered, not parsed."""
        path = os.path.join(self.tmpdir, 'partial.jsonl')
        complete = make_transcript_entry("Complete line.")
        partial = make_transcript_entry("Partial line.")

        # Write one complete line and a partial line (no trailing newline)
        with open(path, 'wb') as f:
            f.write((complete + '\n').encode())
            f.write(partial[:20].encode())  # truncated

        texts, offset1, trailing = self._simulate_poll(path, 0)
        assert texts == ["Complete line."]
        assert trailing == partial[:20].encode()

        # Now finish writing the partial line
        with open(path, 'ab') as f:
            f.write((partial[20:] + '\n').encode())

        texts, offset2, trailing = self._simulate_poll(path, offset1, trailing)
        assert texts == ["Partial line."]
        assert trailing == b''

    def test_all_partial_no_newline(self):
        """If there are no complete lines at all, buffer everything."""
        path = os.path.join(self.tmpdir, 'allpartial.jsonl')
        chunk = b'{"type": "assis'
        with open(path, 'wb') as f:
            f.write(chunk)

        texts, offset, trailing = self._simulate_poll(path, 0)
        assert texts == []
        assert trailing == chunk

    def test_offset_advances_correctly(self):
        path = self._write_transcript([
            make_transcript_entry("First."),
        ])
        size1 = os.path.getsize(path)

        texts, offset, trailing = self._simulate_poll(path, 0)
        assert offset == size1
        assert texts == ["First."]

        # Append more data
        self._write_transcript([make_transcript_entry("Second.")], path)

        texts, offset2, trailing = self._simulate_poll(path, offset, trailing)
        assert texts == ["Second."]
        assert offset2 == os.path.getsize(path)

    def test_empty_file(self):
        path = os.path.join(self.tmpdir, 'empty.jsonl')
        with open(path, 'wb') as f:
            pass
        texts, offset, trailing = self._simulate_poll(path, 0)
        assert texts == []
        assert offset == 0

    def test_nonexistent_file(self):
        texts, offset, trailing = self._simulate_poll('/nonexistent', 0)
        assert texts == []
        assert offset == 0

    def test_cleans_markdown_in_entries(self):
        path = self._write_transcript([
            make_transcript_entry("**Bold** and `code`."),
        ])
        texts, _, _ = self._simulate_poll(path, 0)
        assert texts == ["Bold and ."]

    def test_skips_empty_after_cleaning(self):
        path = self._write_transcript([
            make_transcript_entry("```\nonly code\n```"),
        ])
        texts, _, _ = self._simulate_poll(path, 0)
        assert texts == []

    def test_multiple_incremental_reads(self):
        """Simulate the daemon polling as the file grows over time."""
        path = os.path.join(self.tmpdir, 'growing.jsonl')
        with open(path, 'wb') as f:
            pass

        offset = 0
        trailing = b''
        all_texts = []

        for i in range(5):
            self._write_transcript(
                [make_transcript_entry(f"Message {i}.")], path
            )
            texts, offset, trailing = self._simulate_poll(path, offset, trailing)
            all_texts.extend(texts)

        assert all_texts == [f"Message {i}." for i in range(5)]
        assert trailing == b''
