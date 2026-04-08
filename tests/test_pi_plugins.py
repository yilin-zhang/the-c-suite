"""Tests for pi plugin layout."""

from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent.parent
PI_PLUGINS_DIR = REPO_DIR / "pi-plugins"


def discover_pi_plugins():
    return sorted(path for path in PI_PLUGINS_DIR.iterdir() if path.is_dir())


def test_pi_plugins_have_entrypoint_and_readme():
    plugins = discover_pi_plugins()
    assert plugins, "expected at least one pi plugin"

    for plugin_dir in plugins:
        assert (plugin_dir / "index.ts").is_file(), f"{plugin_dir.name}: missing index.ts"
        assert (plugin_dir / "README.md").is_file(), f"{plugin_dir.name}: missing README.md"
