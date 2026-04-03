"""Tests for clean_text() markdown stripping."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hooks'))
from tts_daemon import clean_text


def test_strips_code_blocks():
    text = "Before\n```python\nprint('hi')\n```\nAfter"
    assert clean_text(text) == "Before\n\nAfter"


def test_strips_inline_code():
    assert clean_text("Run `echo hello` now") == "Run  now"


def test_strips_bold():
    assert clean_text("This is **important** text") == "This is important text"


def test_strips_italic():
    assert clean_text("This is *emphasized* text") == "This is emphasized text"


def test_strips_headings():
    assert clean_text("# Title\n## Subtitle\nBody") == "Title\nSubtitle\nBody"


def test_strips_bullet_lists():
    assert clean_text("- item one\n* item two") == "item one\nitem two"


def test_strips_numbered_lists():
    assert clean_text("1. first\n2. second") == "first\nsecond"


def test_collapses_excess_newlines():
    assert clean_text("A\n\n\n\nB") == "A\n\nB"


def test_strips_whitespace():
    assert clean_text("  hello  ") == "hello"


def test_empty_after_strip():
    assert clean_text("```\ncode only\n```") == ""


def test_combined_markdown():
    text = "## Summary\n\n**Bold** and *italic* with `code`.\n\n- bullet"
    result = clean_text(text)
    assert "**" not in result
    assert "*" not in result
    assert "`" not in result
    assert "##" not in result
    assert "- " not in result


def test_plain_text_unchanged():
    text = "This is a plain sentence with no markdown."
    assert clean_text(text) == text


def test_nested_code_block():
    text = "Before\n```\nouter\n```\nMiddle\n```\ninner\n```\nAfter"
    result = clean_text(text)
    assert "outer" not in result
    assert "inner" not in result
    assert "Before" in result
    assert "After" in result
