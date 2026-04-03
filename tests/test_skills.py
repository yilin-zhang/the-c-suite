"""Tests for skills integrity and agentskills.io spec compliance."""

import json
import re
from pathlib import Path

import pytest
import yaml

REPO_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = REPO_DIR / "skills" / "config.json"
SKILLS_DIR = REPO_DIR / "skills"

FRONTMATTER_RE = re.compile(r"^---\n(.+?)\n---", re.DOTALL)
NAME_RE = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")


@pytest.fixture
def config():
    return json.loads(CONFIG_PATH.read_text())


def skill_dirs():
    """Return all skill directories (those with SKILL.md)."""
    return sorted(d for d in SKILLS_DIR.iterdir() if (d / "SKILL.md").is_file())


# --- config.json tests ---


def test_config_is_valid_json():
    data = json.loads(CONFIG_PATH.read_text())
    assert "skills" in data
    assert "paths" in data


def test_config_paths_are_unique(config):
    paths = config["paths"]
    assert len(paths) == len(set(paths.values())), "Duplicate paths in config"


def test_config_paths_have_expected_agents(config):
    expected = {"claude-code", "opencode", "codex"}
    assert set(config["paths"].keys()) == expected


def test_every_skill_has_directory(config):
    for skill_name in config["skills"]:
        skill_dir = SKILLS_DIR / skill_name
        assert skill_dir.is_dir(), f"Missing skill directory: {skill_dir}"


def test_every_skill_has_skill_md(config):
    for skill_name in config["skills"]:
        skill_md = SKILLS_DIR / skill_name / "SKILL.md"
        assert skill_md.is_file(), f"Missing SKILL.md: {skill_md}"


def test_skill_agents_field_is_valid(config):
    for skill_name, skill_config in config["skills"].items():
        agents = skill_config["agents"]
        if isinstance(agents, str):
            assert agents == "all", (
                f"Skill '{skill_name}' has invalid agents string: '{agents}'"
            )
        elif isinstance(agents, list):
            valid = set(config["paths"].keys())
            for agent in agents:
                assert agent in valid, (
                    f"Skill '{skill_name}' targets unknown agent: '{agent}'"
                )
        else:
            pytest.fail(f"Skill '{skill_name}' agents must be 'all' or a list")


def test_no_orphan_skill_directories(config):
    """Every skill directory should be registered in config.json."""
    registered = set(config["skills"].keys())
    for d in SKILLS_DIR.iterdir():
        if d.is_dir() and d.name != "__pycache__":
            assert d.name in registered, (
                f"Skill directory '{d.name}' exists but is not in config.json"
            )


# --- agentskills.io spec compliance tests ---


@pytest.fixture(params=skill_dirs(), ids=lambda p: p.name)
def skill_dir(request):
    return request.param


@pytest.fixture
def skill_frontmatter(skill_dir):
    content = (skill_dir / "SKILL.md").read_text()
    match = FRONTMATTER_RE.match(content)
    assert match, f"{skill_dir.name}/SKILL.md missing YAML frontmatter"
    data = yaml.safe_load(match.group(1))
    assert isinstance(data, dict), f"{skill_dir.name}/SKILL.md frontmatter is not a dict"
    return data


def test_skill_has_frontmatter(skill_dir):
    content = (skill_dir / "SKILL.md").read_text()
    assert FRONTMATTER_RE.match(content), (
        f"{skill_dir.name}/SKILL.md missing YAML frontmatter"
    )


def test_skill_has_name(skill_frontmatter, skill_dir):
    assert "name" in skill_frontmatter, (
        f"{skill_dir.name}: missing required 'name' field"
    )


def test_skill_name_matches_directory(skill_frontmatter, skill_dir):
    assert skill_frontmatter["name"] == skill_dir.name, (
        f"name '{skill_frontmatter['name']}' does not match directory '{skill_dir.name}'"
    )


def test_skill_name_format(skill_frontmatter, skill_dir):
    name = skill_frontmatter["name"]
    assert len(name) <= 64, f"{skill_dir.name}: name exceeds 64 chars"
    assert NAME_RE.match(name), (
        f"{skill_dir.name}: name '{name}' must be lowercase alphanumeric with hyphens, "
        "no leading/trailing/consecutive hyphens"
    )
    assert "--" not in name, (
        f"{skill_dir.name}: name '{name}' contains consecutive hyphens"
    )


def test_skill_has_description(skill_frontmatter, skill_dir):
    assert "description" in skill_frontmatter, (
        f"{skill_dir.name}: missing required 'description' field"
    )
    desc = skill_frontmatter["description"]
    assert isinstance(desc, str) and len(desc) > 0, (
        f"{skill_dir.name}: description must be a non-empty string"
    )
    assert len(desc) <= 1024, (
        f"{skill_dir.name}: description exceeds 1024 chars ({len(desc)})"
    )


def test_skill_optional_fields_valid(skill_frontmatter, skill_dir):
    if "compatibility" in skill_frontmatter:
        compat = skill_frontmatter["compatibility"]
        assert isinstance(compat, str) and 0 < len(compat) <= 500, (
            f"{skill_dir.name}: compatibility must be 1-500 chars"
        )

    if "metadata" in skill_frontmatter:
        meta = skill_frontmatter["metadata"]
        assert isinstance(meta, dict), (
            f"{skill_dir.name}: metadata must be a mapping"
        )

    if "license" in skill_frontmatter:
        assert isinstance(skill_frontmatter["license"], str), (
            f"{skill_dir.name}: license must be a string"
        )


def test_skill_body_under_500_lines(skill_dir):
    """Spec recommends keeping SKILL.md under 500 lines."""
    content = (skill_dir / "SKILL.md").read_text()
    match = FRONTMATTER_RE.match(content)
    body = content[match.end():] if match else content
    line_count = len(body.strip().splitlines())
    assert line_count <= 500, (
        f"{skill_dir.name}/SKILL.md body is {line_count} lines (recommended max: 500)"
    )
