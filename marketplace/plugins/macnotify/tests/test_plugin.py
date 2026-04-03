"""Tests for macnotify plugin integrity."""

import json
from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent.parent


def test_plugin_json_is_valid():
    path = PLUGIN_DIR / ".claude-plugin" / "plugin.json"
    data = json.loads(path.read_text())
    assert data["name"] == "macnotify"
    assert "description" in data
    assert "version" in data


def test_hooks_json_is_valid():
    path = PLUGIN_DIR / "hooks" / "hooks.json"
    data = json.loads(path.read_text())
    assert "hooks" in data
    for event_type, entries in data["hooks"].items():
        assert isinstance(entries, list), f"hooks.{event_type} should be a list"
        for entry in entries:
            assert "matcher" in entry
            assert "hooks" in entry


def test_referenced_commands_exist():
    plugin_json = json.loads(
        (PLUGIN_DIR / ".claude-plugin" / "plugin.json").read_text()
    )
    for cmd_path in plugin_json.get("commands", []):
        full_path = PLUGIN_DIR / cmd_path
        assert full_path.is_file(), f"Referenced command missing: {cmd_path}"


def test_referenced_scripts_exist():
    hooks_json = json.loads(
        (PLUGIN_DIR / "hooks" / "hooks.json").read_text()
    )
    for entries in hooks_json["hooks"].values():
        for entry in entries:
            for hook in entry["hooks"]:
                cmd = hook["command"]
                # Extract script path from command string
                # Commands use ${CLAUDE_PLUGIN_ROOT} which maps to PLUGIN_DIR
                script = cmd.replace("${CLAUDE_PLUGIN_ROOT}", str(PLUGIN_DIR))
                script = script.replace('"', "")
                # Take just the script path (before any args)
                script_path = script.split()[0]
                assert Path(script_path).is_file(), (
                    f"Referenced script missing: {script_path}"
                )


def test_notify_script_is_executable():
    script = PLUGIN_DIR / "bin" / "notify.sh"
    assert script.is_file()
    import os
    assert os.access(script, os.X_OK), "bin/notify.sh is not executable"


def test_default_sounds_config_exists():
    sounds = PLUGIN_DIR / "config" / "sounds.sh"
    assert sounds.is_file()
    content = sounds.read_text()
    for var in ["SOUND_STOP", "SOUND_SUBAGENT_STOP", "SOUND_PLAN_READY",
                "SOUND_QUESTION", "SOUND_PERMISSION"]:
        assert var in content, f"Missing sound variable: {var}"
