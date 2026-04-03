#!/usr/bin/env python3
"""Bootstrap the-c-suite: sync skills and OpenCode plugins."""

import argparse
import json
import sys
from pathlib import Path

REPO_DIR = Path(__file__).resolve().parent


def symlink(src: Path, dest: Path, dry_run: bool, verbose: bool, stats: dict):
    """Create a symlink, skipping if already correct."""
    if dest.is_symlink():
        existing = dest.resolve()
        if existing == src.resolve():
            if verbose:
                print(f"  SKIP: {dest} (already linked)")
            stats["skipped"] += 1
            return
        else:
            if verbose:
                print(f"  REPLACE: {dest} (was → {existing})")
            if not dry_run:
                dest.unlink()
    elif dest.exists():
        if verbose:
            print(f"  WARN: {dest} exists and is not a symlink, skipping")
        stats["warned"] += 1
        return

    if dry_run:
        print(f"  [dry-run] ln -s {src} → {dest}")
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.symlink_to(src)
        if verbose:
            print(f"  CREATED: {dest} → {src}")
    stats["synced"] += 1


def copy_file(src: Path, dest: Path, dry_run: bool, verbose: bool, stats: dict):
    """Copy a file, skipping if already identical."""
    if dest.exists() and src.read_bytes() == dest.read_bytes():
        if verbose:
            print(f"  SKIP: {dest} (already up to date)")
        stats["skipped"] += 1
        return

    if dry_run:
        print(f"  [dry-run] cp {src} → {dest}")
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(src.read_bytes())
        if verbose:
            print(f"  COPIED: {src} → {dest}")
    stats["synced"] += 1


def sync_skills(dry_run: bool, verbose: bool) -> dict:
    """Symlink skills into agent-specific directories based on config.json."""
    stats = {"synced": 0, "skipped": 0, "warned": 0}
    config_path = REPO_DIR / "skills" / "config.json"

    if not config_path.exists():
        print(f"Error: {config_path} not found", file=sys.stderr)
        return stats

    config = json.loads(config_path.read_text())
    paths = {
        agent: Path(path.replace("~", str(Path.home())))
        for agent, path in config["paths"].items()
    }
    all_agents = list(paths.keys())

    for skill_name, skill_config in config["skills"].items():
        skill_src = REPO_DIR / "skills" / skill_name
        if not skill_src.is_dir():
            if verbose:
                print(f"  WARN: skill directory {skill_src} does not exist")
            stats["warned"] += 1
            continue

        agents_val = skill_config["agents"]
        if agents_val == "all":
            targets = all_agents
        else:
            targets = agents_val

        for agent in targets:
            agent = agent.strip()
            dest_dir = paths.get(agent)
            if dest_dir is None:
                if verbose:
                    print(f"  WARN: no path configured for agent '{agent}'")
                stats["warned"] += 1
                continue
            symlink(skill_src, dest_dir / skill_name, dry_run, verbose, stats)

    return stats


def sync_oc_plugins(dry_run: bool, verbose: bool) -> dict:
    """Copy OpenCode .ts plugins, symlink .md commands."""
    stats = {"synced": 0, "skipped": 0, "warned": 0}
    oc_src = REPO_DIR / "oc-plugins"
    plugin_dest = Path.home() / ".config" / "opencode" / "plugins"
    command_dest = Path.home() / ".config" / "opencode" / "commands"

    if not oc_src.is_dir():
        print(f"No oc-plugins directory found at {oc_src}")
        return stats

    for plugin_dir in sorted(oc_src.iterdir()):
        if not plugin_dir.is_dir():
            continue

        # Copy .ts files (not symlink — imports break with symlinks)
        for ts_file in sorted(plugin_dir.glob("*.ts")):
            if ts_file.name.endswith((".test.ts", ".spec.ts")):
                continue
            copy_file(ts_file, plugin_dest / ts_file.name, dry_run, verbose, stats)

        # Symlink .md command files
        for md_file in sorted(plugin_dir.glob("*.md")):
            if md_file.name.lower() == "readme.md":
                continue
            symlink(md_file, command_dest / md_file.name, dry_run, verbose, stats)

    return stats


def main():
    parser = argparse.ArgumentParser(description="Bootstrap the-c-suite")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    parser.add_argument("--verbose", action="store_true", help="Print every action")
    parser.add_argument("--skills-only", action="store_true")
    parser.add_argument("--oc-only", action="store_true")
    args = parser.parse_args()

    do_skills = not args.oc_only
    do_oc = not args.skills_only

    steps = []
    if do_skills:
        steps.append(("Syncing skills", sync_skills))
    if do_oc:
        steps.append(("Syncing OpenCode plugins", sync_oc_plugins))

    print("the-c-suite setup")
    print("==================\n")

    for i, (label, func) in enumerate(steps, 1):
        print(f"Step {i}/{len(steps)}: {label}...")
        stats = func(args.dry_run, args.verbose)
        parts = [f"{stats['synced']} synced", f"{stats['skipped']} skipped"]
        if stats.get("warned"):
            parts.append(f"{stats['warned']} warnings")
        print(f"{label.split()[-1]}: {', '.join(parts)}\n")

    print("Done!")


if __name__ == "__main__":
    main()
