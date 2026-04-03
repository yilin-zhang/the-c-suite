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
