"""Tests for Claude Code plugin integrity (excludes submodules)."""

import json
import os
import subprocess
from pathlib import Path

import pytest

REPO_DIR = Path(__file__).resolve().parent.parent
PLUGINS_DIR = REPO_DIR / "marketplace" / "plugins"


def get_submodule_paths():
    """Return set of submodule paths relative to repo root."""
    try:
        result = subprocess.run(
            ["git", "submodule", "--quiet", "foreach", "echo $sm_path"],
            capture_output=True, text=True, cwd=REPO_DIR,
        )
        return {line.strip() for line in result.stdout.splitlines() if line.strip()}
    except FileNotFoundError:
        return set()


def discover_plugins():
    """Find all plugin dirs that have plugin.json, excluding submodules."""
    submodules = get_submodule_paths()
    plugins = []
    for d in sorted(PLUGINS_DIR.iterdir()):
        if not d.is_dir():
            continue
        rel = str(d.relative_to(REPO_DIR))
        if rel in submodules:
            continue
        if (d / ".claude-plugin" / "plugin.json").exists():
            plugins.append(d)
    return plugins


PLUGINS = discover_plugins()


@pytest.fixture(params=PLUGINS, ids=lambda p: p.name)
def plugin_dir(request):
    return request.param


@pytest.fixture
def plugin_json(plugin_dir):
    return json.loads((plugin_dir / ".claude-plugin" / "plugin.json").read_text())


@pytest.fixture
def hooks_json(plugin_dir):
    path = plugin_dir / "hooks" / "hooks.json"
    if not path.exists():
        return None
    return json.loads(path.read_text())


def test_plugin_json_is_valid(plugin_json, plugin_dir):
    assert "name" in plugin_json, f"{plugin_dir.name}: missing 'name'"
    assert "description" in plugin_json, f"{plugin_dir.name}: missing 'description'"


def test_hooks_json_is_valid(hooks_json, plugin_dir):
    if hooks_json is None:
        pytest.skip(f"{plugin_dir.name} has no hooks.json")
    assert "hooks" in hooks_json
    for event_type, entries in hooks_json["hooks"].items():
        assert isinstance(entries, list), (
            f"{plugin_dir.name}: hooks.{event_type} should be a list"
        )
        for entry in entries:
            assert "matcher" in entry, (
                f"{plugin_dir.name}: hook entry missing 'matcher'"
            )
            assert "hooks" in entry, (
                f"{plugin_dir.name}: hook entry missing 'hooks'"
            )


def test_referenced_commands_exist(plugin_json, plugin_dir):
    for cmd_path in plugin_json.get("commands", []):
        full_path = plugin_dir / cmd_path
        assert full_path.is_file(), (
            f"{plugin_dir.name}: referenced command missing: {cmd_path}"
        )


def test_referenced_hook_scripts_exist(hooks_json, plugin_dir):
    if hooks_json is None:
        pytest.skip(f"{plugin_dir.name} has no hooks.json")
    for entries in hooks_json["hooks"].values():
        for entry in entries:
            for hook in entry["hooks"]:
                cmd = hook["command"]
                script = cmd.replace("${CLAUDE_PLUGIN_ROOT}", str(plugin_dir))
                script = script.replace('"', "")
                script_path = script.split()[0]
                assert Path(script_path).is_file(), (
                    f"{plugin_dir.name}: referenced script missing: {script_path}"
                )


def test_hook_scripts_are_executable(hooks_json, plugin_dir):
    if hooks_json is None:
        pytest.skip(f"{plugin_dir.name} has no hooks.json")
    for entries in hooks_json["hooks"].values():
        for entry in entries:
            for hook in entry["hooks"]:
                cmd = hook["command"]
                script = cmd.replace("${CLAUDE_PLUGIN_ROOT}", str(plugin_dir))
                script = script.replace('"', "")
                script_path = script.split()[0]
                assert os.access(script_path, os.X_OK), (
                    f"{plugin_dir.name}: {script_path} is not executable"
                )
