"""Tests for pi theme layout."""

from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent
PI_THEMES_DIR = REPO_DIR / "pi-themes"


def discover_pi_themes():
    return sorted(path for path in PI_THEMES_DIR.glob("*.json"))


def test_pi_themes_have_files():
    themes = discover_pi_themes()
    assert themes, "expected at least one pi theme"

    for theme_path in themes:
        assert theme_path.is_file(), f"missing theme file: {theme_path.name}"
