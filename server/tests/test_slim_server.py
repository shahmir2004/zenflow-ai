"""Guards the yoga-only extraction.

Every other test in this suite passes whether or not the extraction held. If
someone restores a convenience re-export in ``exercises/__init__.py``, or puts
``BaseExercise`` back into ``exercises/base.py``, the server keeps working
perfectly — it just quietly loads scipy, the HMM classifier and the rep counter
on every boot again, which is the entire cost this server exists to avoid.

This is the test that notices.
"""

import ast
import subprocess
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent

# Modules from the exercise pipeline. None should ever be reachable from here:
# some do not ship at all, and the rest live in the upstream repo.
FORBIDDEN = [
    "scipy",
    "exercises.classifier",
    "exercises.squat",
    "exercises.pushup",
    "exercises.bicep_curl",
    "pipeline.rep_counter",
    "state_machine.manager",
    "api.routes",
    "api.upload",
]


def _imported_modules_after(statement: str) -> set[str]:
    """Import in a clean interpreter and report what ended up in sys.modules.

    A subprocess is required: pytest has already imported most of the tree by
    the time this runs, so checking the current sys.modules would report the
    test session's imports rather than the server's.
    """
    # repr() of a list, parsed back with literal_eval — no escape sequences to
    # survive the trip through the shell.
    code = f"import sys; {statement}; print(sorted(m for m in sys.modules if m))"
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=SERVER_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, f"import failed:\n{result.stderr}"
    return set(ast.literal_eval(result.stdout.strip()))


def test_app_does_not_load_the_exercise_pipeline():
    loaded = _imported_modules_after("import main")
    leaked = sorted(m for m in FORBIDDEN if m in loaded)
    assert not leaked, (
        "the exercise pipeline leaked into the yoga server: "
        + ", ".join(leaked)
        + ". Check the package __init__ files and exercises/base.py."
    )


def test_pose_modules_do_not_load_the_exercise_pipeline():
    """The detectors are also imported directly, bypassing main."""
    loaded = _imported_modules_after(
        "from exercises.yoga_registry import YOGA_POSE_MODULES"
    )
    leaked = sorted(m for m in FORBIDDEN if m in loaded)
    assert not leaked, "leaked via the pose registry: " + ", ".join(leaked)


def test_removed_modules_are_absent_from_the_tree():
    """Nothing from the exercise pipeline was copied across by accident."""
    present = sorted(
        p.relative_to(SERVER_ROOT).as_posix()
        for name in ("classifier.py", "squat.py", "pushup.py", "bicep_curl.py",
                     "rep_counter.py", "manager.py", "routes.py", "upload.py")
        for p in SERVER_ROOT.rglob(name)
    )
    assert not present, f"exercise-pipeline files present: {present}"


def test_base_exposes_geometry_only():
    """base.py must not grow a rep-counting base class again."""
    import exercises.base as base

    assert hasattr(base, "calculate_angle")
    assert hasattr(base, "landmarks_to_dict")
    assert hasattr(base, "JointName")
    assert not hasattr(base, "BaseExercise"), (
        "BaseExercise is back in exercises/base.py — it imports the rep counter "
        "at module level, which pulls the exercise pipeline into this server."
    )
