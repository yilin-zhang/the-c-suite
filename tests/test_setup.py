"""Tests for setup.py sync logic."""

import shutil
from pathlib import Path

import pytest

REPO_DIR = Path(__file__).resolve().parent.parent

# Import setup module
import importlib.util

spec = importlib.util.spec_from_file_location("setup", REPO_DIR / "setup.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


@pytest.fixture
def tmp_dest(tmp_path):
    """Provide a clean temp directory for sync targets."""
    return tmp_path


class TestSymlink:
    def test_creates_symlink(self, tmp_dest):
        src = REPO_DIR / "skills" / "pdf"
        dest = tmp_dest / "pdf"
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.symlink(src, dest, dry_run=False, verbose=False, stats=stats)

        assert dest.is_symlink()
        assert dest.resolve() == src.resolve()
        assert stats["synced"] == 1

    def test_skips_existing_correct_symlink(self, tmp_dest):
        src = REPO_DIR / "skills" / "pdf"
        dest = tmp_dest / "pdf"
        dest.symlink_to(src)
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.symlink(src, dest, dry_run=False, verbose=False, stats=stats)

        assert stats["skipped"] == 1
        assert stats["synced"] == 0

    def test_replaces_wrong_symlink(self, tmp_dest):
        src = REPO_DIR / "skills" / "pdf"
        wrong_src = REPO_DIR / "skills" / "commit"
        dest = tmp_dest / "pdf"
        dest.symlink_to(wrong_src)
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.symlink(src, dest, dry_run=False, verbose=False, stats=stats)

        assert dest.resolve() == src.resolve()
        assert stats["synced"] == 1

    def test_warns_on_existing_non_symlink(self, tmp_dest):
        src = REPO_DIR / "skills" / "pdf"
        dest = tmp_dest / "pdf"
        dest.mkdir()
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.symlink(src, dest, dry_run=False, verbose=False, stats=stats)

        assert stats["warned"] == 1
        assert stats["synced"] == 0

    def test_dry_run_does_not_create(self, tmp_dest):
        src = REPO_DIR / "skills" / "pdf"
        dest = tmp_dest / "pdf"
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.symlink(src, dest, dry_run=True, verbose=False, stats=stats)

        assert not dest.exists()
        assert stats["synced"] == 1  # counted but not created

    def test_creates_parent_dirs(self, tmp_dest):
        src = REPO_DIR / "skills" / "pdf"
        dest = tmp_dest / "nested" / "dir" / "pdf"
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.symlink(src, dest, dry_run=False, verbose=False, stats=stats)

        assert dest.is_symlink()


class TestCopyFile:
    def test_copies_file(self, tmp_dest):
        src = REPO_DIR / "skills" / "config.json"
        dest = tmp_dest / "config.json"
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.copy_file(src, dest, dry_run=False, verbose=False, stats=stats)

        assert dest.exists()
        assert dest.read_bytes() == src.read_bytes()
        assert stats["synced"] == 1

    def test_skips_identical_file(self, tmp_dest):
        src = REPO_DIR / "skills" / "config.json"
        dest = tmp_dest / "config.json"
        shutil.copy2(src, dest)
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.copy_file(src, dest, dry_run=False, verbose=False, stats=stats)

        assert stats["skipped"] == 1
        assert stats["synced"] == 0

    def test_overwrites_different_file(self, tmp_dest):
        src = REPO_DIR / "skills" / "config.json"
        dest = tmp_dest / "config.json"
        dest.write_text("old content")
        stats = {"synced": 0, "skipped": 0, "warned": 0}

        setup.copy_file(src, dest, dry_run=False, verbose=False, stats=stats)

        assert dest.read_bytes() == src.read_bytes()
        assert stats["synced"] == 1


class TestSyncPiPlugins:
    def test_discover_pi_plugin_paths(self):
        stats = {"synced": 0, "skipped": 0, "warned": 0}
        pi_src = REPO_DIR / "pi-plugins"

        plugin_paths = setup.discover_pi_plugin_paths(pi_src, verbose=False, stats=stats)

        assert plugin_paths
        assert all(path.endswith("/index.ts") for path in plugin_paths)

    def test_sync_pi_plugins_adds_missing_plugins(self, tmp_path, monkeypatch):
        home = tmp_path / "home"
        settings_path = home / ".pi" / "agent" / "settings.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings_path.write_text('{"extensions": ["/tmp/existing.ts"]}\n')

        monkeypatch.setattr(setup, "REPO_DIR", REPO_DIR)
        monkeypatch.setattr(Path, "home", staticmethod(lambda: home))

        stats = setup.sync_pi_plugins(dry_run=False, verbose=False)
        settings = setup.load_json_file(settings_path)
        plugin_paths = setup.discover_pi_plugin_paths(REPO_DIR / "pi-plugins", verbose=False, stats={"synced": 0, "skipped": 0, "warned": 0})

        assert stats["synced"] == len(plugin_paths)
        assert settings["extensions"][0] == "/tmp/existing.ts"
        assert settings["extensions"][1:] == plugin_paths

    def test_sync_pi_plugins_removes_stale_managed_entries(self, tmp_path, monkeypatch):
        home = tmp_path / "home"
        settings_path = home / ".pi" / "agent" / "settings.json"
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        stale = str((REPO_DIR / "pi-plugins" / "stale-plugin" / "index.ts").resolve())
        settings_path.write_text(
            '{"extensions": ["/tmp/existing.ts", ' + repr(stale).replace("'", '"') + ']}\n'
        )

        monkeypatch.setattr(setup, "REPO_DIR", REPO_DIR)
        monkeypatch.setattr(Path, "home", staticmethod(lambda: home))

        stats = setup.sync_pi_plugins(dry_run=False, verbose=False)
        settings = setup.load_json_file(settings_path)

        assert stale not in settings["extensions"]
        assert "/tmp/existing.ts" in settings["extensions"]
        assert stats["synced"] >= 1
