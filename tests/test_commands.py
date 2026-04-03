"""Tests for command file integrity."""

import re
from pathlib import Path

import pytest
import yaml

REPO_DIR = Path(__file__).resolve().parent.parent
COMMANDS_DIR = REPO_DIR / "commands"

FRONTMATTER_RE = re.compile(r"^---\n(.+?)\n---", re.DOTALL)


def command_files():
    return sorted(COMMANDS_DIR.glob("*.md"))


@pytest.fixture(params=command_files(), ids=lambda p: p.name)
def command_file(request):
    return request.param


def test_has_yaml_frontmatter(command_file):
    content = command_file.read_text()
    match = FRONTMATTER_RE.match(content)
    assert match, f"{command_file.name} is missing YAML frontmatter"


def test_frontmatter_is_valid_yaml(command_file):
    content = command_file.read_text()
    match = FRONTMATTER_RE.match(content)
    assert match
    data = yaml.safe_load(match.group(1))
    assert isinstance(data, dict), f"{command_file.name} frontmatter is not a dict"


def test_frontmatter_has_description(command_file):
    content = command_file.read_text()
    match = FRONTMATTER_RE.match(content)
    assert match
    data = yaml.safe_load(match.group(1))
    assert "description" in data, f"{command_file.name} missing 'description'"
    assert isinstance(data["description"], str)
    assert len(data["description"]) > 0


def test_frontmatter_has_allowed_tools(command_file):
    content = command_file.read_text()
    match = FRONTMATTER_RE.match(content)
    assert match
    data = yaml.safe_load(match.group(1))
    assert "allowed-tools" in data, f"{command_file.name} missing 'allowed-tools'"
