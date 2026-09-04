"""Tests for the 8 static yoga pose detectors and the yoga registry.

Each pose gets a synthetic 33-landmark "correct" skeleton (should be detected
as in-pose with no violations) and a "wrong" skeleton (should be rejected with
a violation and a flagged joint color).
"""

import pytest

from exercises.yoga_poses import (
    OCCLUDED_CORRECTION,
    OCCLUDED_VIOLATION,
    OUT_OF_FRAME_CORRECTION,
    OUT_OF_FRAME_VIOLATION,
)
from exercises.yoga_registry import (
    SUPPORTED_YOGA_LABELS,
    YOGA_POSE_MODULES,
    supported_yoga_payload,
)
from pipeline.framing import BAD_FRAMES as FRAMING_BAD_FRAMES
from pipeline.framing import GOOD_FRAMES as FRAMING_GOOD_FRAMES


def _skeleton(joints: dict[int, tuple[float, float]]) -> list[dict]:
    """Build a 33-landmark list; `joints` overrides specific MediaPipe indices."""
    lms = [{"x": 0.5, "y": 0.5, "z": 0.0, "visibility": 0.9} for _ in range(33)]
    for idx, (x, y) in joints.items():
        lms[idx] = {"x": x, "y": y, "z": 0.0, "visibility": 0.95}
    return lms


# Index legend: 11/12 shoulders, 13/14 elbows, 15/16 wrists,
# 23/24 hips, 25/26 knees, 27/28 ankles.

MOUNTAIN_OK = {
    11: (0.42, 0.25), 12: (0.58, 0.25), 13: (0.40, 0.40), 14: (0.60, 0.40),
    15: (0.40, 0.55), 16: (0.60, 0.55), 23: (0.45, 0.55), 24: (0.55, 0.55),
    25: (0.45, 0.75), 26: (0.55, 0.75), 27: (0.45, 0.95), 28: (0.55, 0.95),
}
MOUNTAIN_BAD = {**MOUNTAIN_OK, 27: (0.60, 0.77), 28: (0.40, 0.77)}  # bent knees

TREE_OK = {
    11: (0.42, 0.25), 12: (0.58, 0.25), 23: (0.45, 0.55), 24: (0.55, 0.55),
    25: (0.45, 0.75), 26: (0.64, 0.64), 27: (0.45, 0.95), 28: (0.47, 0.72),
}
TREE_BAD = {  # both feet planted
    11: (0.42, 0.25), 12: (0.58, 0.25), 23: (0.45, 0.55), 24: (0.55, 0.55),
    25: (0.45, 0.75), 26: (0.55, 0.75), 27: (0.45, 0.95), 28: (0.55, 0.95),
}

WARRIOR1_OK = {
    11: (0.42, 0.25), 12: (0.58, 0.25), 13: (0.43, 0.17), 14: (0.57, 0.17),
    15: (0.44, 0.08), 16: (0.56, 0.08), 23: (0.42, 0.55), 24: (0.55, 0.55),
    25: (0.40, 0.72), 26: (0.58, 0.75), 27: (0.55, 0.74), 28: (0.60, 0.95),
}
WARRIOR1_BAD = {**WARRIOR1_OK, 15: (0.40, 0.55), 16: (0.60, 0.55)}  # arms down

WARRIOR2_OK = {
    11: (0.42, 0.25), 12: (0.58, 0.25), 13: (0.28, 0.25), 14: (0.72, 0.25),
    15: (0.15, 0.25), 16: (0.85, 0.25), 23: (0.42, 0.55), 24: (0.55, 0.55),
    25: (0.40, 0.72), 26: (0.58, 0.75), 27: (0.55, 0.74), 28: (0.60, 0.95),
}
WARRIOR2_BAD = {**WARRIOR2_OK, 15: (0.40, 0.55), 16: (0.60, 0.55)}  # arms down

CHAIR_OK = {
    11: (0.42, 0.25), 12: (0.58, 0.25), 15: (0.44, 0.08), 16: (0.56, 0.08),
    23: (0.45, 0.50), 24: (0.55, 0.50), 25: (0.45, 0.70), 26: (0.55, 0.70),
    27: (0.60, 0.80), 28: (0.40, 0.80),
}
CHAIR_BAD = {  # straight legs, arms up
    11: (0.42, 0.25), 12: (0.58, 0.25), 15: (0.44, 0.08), 16: (0.56, 0.08),
    23: (0.45, 0.55), 24: (0.55, 0.55), 25: (0.45, 0.75), 26: (0.55, 0.75),
    27: (0.45, 0.95), 28: (0.55, 0.95),
}

TRIANGLE_OK = {
    11: (0.30, 0.40), 12: (0.45, 0.35), 15: (0.27, 0.85), 16: (0.50, 0.10),
    23: (0.40, 0.55), 24: (0.60, 0.55), 25: (0.30, 0.72), 26: (0.70, 0.72),
    27: (0.25, 0.92), 28: (0.75, 0.92),
}
TRIANGLE_BAD = {  # upright torso, arms together
    11: (0.42, 0.25), 12: (0.58, 0.25), 15: (0.40, 0.55), 16: (0.60, 0.55),
    23: (0.45, 0.55), 24: (0.55, 0.55), 25: (0.45, 0.75), 26: (0.55, 0.75),
    27: (0.45, 0.95), 28: (0.55, 0.95),
}

DOWNDOG_OK = {
    11: (0.30, 0.45), 12: (0.30, 0.45), 13: (0.25, 0.60), 14: (0.25, 0.60),
    15: (0.20, 0.75), 16: (0.20, 0.75), 23: (0.50, 0.30), 24: (0.50, 0.30),
    25: (0.65, 0.55), 26: (0.65, 0.55), 27: (0.75, 0.75), 28: (0.75, 0.75),
}
DOWNDOG_BAD = {  # flat plank, hips not lifted
    11: (0.30, 0.55), 12: (0.30, 0.55), 13: (0.25, 0.55), 14: (0.25, 0.55),
    15: (0.20, 0.55), 16: (0.20, 0.55), 23: (0.50, 0.55), 24: (0.50, 0.55),
    25: (0.65, 0.55), 26: (0.65, 0.55), 27: (0.75, 0.55), 28: (0.75, 0.55),
}

COBRA_OK = {
    11: (0.35, 0.55), 12: (0.35, 0.55), 23: (0.55, 0.72), 24: (0.55, 0.72),
    25: (0.70, 0.74), 26: (0.70, 0.74), 27: (0.80, 0.74), 28: (0.80, 0.74),
}
COBRA_BAD = {  # flat on floor, chest not lifted
    11: (0.35, 0.74), 12: (0.35, 0.74), 23: (0.55, 0.74), 24: (0.55, 0.74),
    25: (0.70, 0.74), 26: (0.70, 0.74), 27: (0.80, 0.74), 28: (0.80, 0.74),
}

CASES: dict[str, tuple[dict, dict]] = {
    "mountain": (MOUNTAIN_OK, MOUNTAIN_BAD),
    "tree": (TREE_OK, TREE_BAD),
    "warrior_i": (WARRIOR1_OK, WARRIOR1_BAD),
    "warrior_ii": (WARRIOR2_OK, WARRIOR2_BAD),
    "chair": (CHAIR_OK, CHAIR_BAD),
    "triangle": (TRIANGLE_OK, TRIANGLE_BAD),
    "downward_dog": (DOWNDOG_OK, DOWNDOG_BAD),
    "cobra": (COBRA_OK, COBRA_BAD),
}


@pytest.mark.parametrize("label", list(CASES))
def test_correct_pose_is_detected(label):
    ok_joints, _ = CASES[label]
    pose = YOGA_POSE_MODULES[label]()
    ev = pose.process_frame(_skeleton(ok_joints))
    assert ev.is_in_pose, f"{label} should be in-pose; violations={ev.violations}"
    assert ev.violations == []
    assert ev.confidence > 0.0


@pytest.mark.parametrize("label", list(CASES))
def test_wrong_pose_is_rejected(label):
    _, bad_joints = CASES[label]
    pose = YOGA_POSE_MODULES[label]()
    ev = pose.process_frame(_skeleton(bad_joints))
    assert not ev.is_in_pose, f"{label} wrong fixture should be rejected"
    assert ev.violations, f"{label} should report a violation"
    assert any(color in ("red", "yellow") for color in ev.joint_colors.values())


def _feed(pose, lms, frames):
    """Run the same frame through a pose N times and return the last result."""
    ev = None
    for _ in range(frames):
        ev = pose.process_frame(lms)
    return ev


def _hide(lms, *indices, visibility=0.05):
    lms = [dict(lm) for lm in lms]
    for idx in indices:
        lms[idx]["visibility"] = visibility
    return lms


# --------------------------------------------------------------------------- #
# Framing: when a joint cannot be seen
# --------------------------------------------------------------------------- #

def test_low_visibility_is_never_in_pose():
    """Safety first: an unreadable body must not start a hold, ever — even on
    the very first frame, before the framing gate has decided to say anything.
    """
    pose = YOGA_POSE_MODULES["mountain"]()
    ev = pose.process_frame(_hide(_skeleton(MOUNTAIN_OK), 25, 26, 27, 28))
    assert not ev.is_in_pose


def test_a_brief_visibility_blip_is_not_announced():
    """The fix for the nagging. A drop shorter than the gate's run says nothing
    at all — no violation, no correction, nothing for the UI to flash up.
    """
    pose = YOGA_POSE_MODULES["mountain"]()
    lms = _skeleton(MOUNTAIN_OK)
    pose.process_frame(lms)  # a clean frame first
    ev = _feed(pose, _hide(lms, 25, 26, 27, 28), FRAMING_BAD_FRAMES - 1)
    assert ev.violations == []
    assert ev.corrections == []
    assert not ev.is_in_pose


def test_sustained_occlusion_asks_the_user_to_face_the_camera():
    """A body that is inside the picture but unreadable must not be told to
    step back — stepping back is not the fix and doing as told makes it worse.
    """
    pose = YOGA_POSE_MODULES["mountain"]()
    lms = _skeleton(MOUNTAIN_OK)  # every joint well inside 0..1
    ev = _feed(pose, _hide(lms, 25, 26, 27, 28), FRAMING_BAD_FRAMES)
    assert ev.violations == [OCCLUDED_VIOLATION]
    assert ev.corrections == [OCCLUDED_CORRECTION]
    assert not ev.is_in_pose


def test_a_body_leaving_the_picture_is_told_to_step_back():
    pose = YOGA_POSE_MODULES["mountain"]()
    lms = _hide(_skeleton(MOUNTAIN_OK), 27, 28)
    for idx in (27, 28):  # ankles predicted below the bottom edge
        lms[idx]["y"] = 1.3
    ev = _feed(pose, lms, FRAMING_BAD_FRAMES)
    assert ev.violations == [OUT_OF_FRAME_VIOLATION]
    assert ev.corrections == [OUT_OF_FRAME_CORRECTION]


def test_framing_clears_once_the_body_comes_back():
    pose = YOGA_POSE_MODULES["mountain"]()
    lms = _skeleton(MOUNTAIN_OK)
    assert _feed(pose, _hide(lms, 25, 26, 27, 28), FRAMING_BAD_FRAMES).violations
    recovered = _feed(pose, lms, FRAMING_GOOD_FRAMES)
    assert recovered.violations == []
    assert recovered.is_in_pose


def test_flickering_visibility_never_reports_a_framing_problem():
    """The original bug, reproduced. An ankle scoring either side of the old
    0.30 threshold used to flip the cue on and off several times a second.
    """
    pose = YOGA_POSE_MODULES["tree"]()
    lms = _skeleton(TREE_OK)
    pose.process_frame(lms)
    for score in [0.25, 0.35, 0.22, 0.33, 0.28, 0.31] * 4:
        ev = pose.process_frame(_hide(lms, 28, visibility=score))
        assert ev.violations == [] or OCCLUDED_VIOLATION not in ev.violations


# --------------------------------------------------------------------------- #
# Required vs preferred joints
# --------------------------------------------------------------------------- #

def test_warrior_ii_still_scores_the_lunge_when_the_wrists_vanish():
    """The headline fix.

    A wrist disappearing behind the torso used to invalidate an evaluation of
    the legs that was perfectly readable. The arms check is now skipped on
    those frames and the lunge underneath it keeps being scored — so a correct
    stance keeps its hold instead of being told to step back.

    The trade-off is deliberate: with the wrists unreadable we cannot know the
    arms are wrong, and we choose to keep timing the pose rather than stop it.
    """
    pose = YOGA_POSE_MODULES["warrior_ii"]()
    arms_down = _skeleton(WARRIOR2_BAD)          # legs correct, arms lowered
    assert not pose.process_frame(arms_down).is_in_pose

    ev = _feed(pose, _hide(arms_down, 15, 16), FRAMING_BAD_FRAMES + 2)
    assert ev.violations == []
    assert ev.is_in_pose


def test_warrior_ii_still_flags_the_arms_when_it_can_see_them():
    """The control for the test above: preferred joints are skipped when
    unreadable, not ignored when present."""
    pose = YOGA_POSE_MODULES["warrior_ii"]()
    ev = pose.process_frame(_skeleton(WARRIOR2_BAD))
    assert "Arms not extended out to the sides" in ev.violations


def test_cobra_does_not_need_the_ankles():
    """Lying down, the feet are the first thing to leave a phone's frame — and
    the chest lift, which is the pose, does not need them."""
    pose = YOGA_POSE_MODULES["cobra"]()
    ev = _feed(pose, _hide(_skeleton(COBRA_OK), 27, 28), FRAMING_BAD_FRAMES + 2)
    assert ev.violations == []
    assert ev.is_in_pose


def test_an_unseen_joint_is_never_coloured_green():
    """joint_colors drives the skeleton overlay. Painting a joint green is a
    claim that it was checked and passed."""
    pose = YOGA_POSE_MODULES["warrior_ii"]()
    ev = _feed(pose, _hide(_skeleton(WARRIOR2_OK), 15, 16), FRAMING_BAD_FRAMES + 2)
    assert "left_wrist" not in ev.joint_colors
    assert "right_wrist" not in ev.joint_colors
    assert ev.joint_colors["left_knee"] == "green"


def test_registry_has_exactly_eight_poses():
    assert len(YOGA_POSE_MODULES) == 8
    assert len(SUPPORTED_YOGA_LABELS) == 8
    for label in SUPPORTED_YOGA_LABELS:
        assert YOGA_POSE_MODULES[label]().name == label

    payload = supported_yoga_payload()
    assert len(payload) == 8
    assert {p["label"] for p in payload} == set(SUPPORTED_YOGA_LABELS)
    for entry in payload:
        assert entry["camera_view"] in ("front", "side")
        assert entry["target_hold_seconds"] > 0


# --------------------------------------------------------------------------- #
# The two debounces, composed
# --------------------------------------------------------------------------- #

def test_a_blip_keeps_the_hold_and_says_nothing():
    """The property a user actually feels.

    Two debounces stack here and they are tuned to stack in this order:
    the framing gate stays quiet for BAD_FRAMES, and the hold timer tolerates
    YOGA_HOLD_DEBOUNCE_FRAMES of absence before dropping a hold. With the
    framing window the shorter of the two, a blip short enough to be silent is
    also short enough to keep the hold — so the user is never told to step back
    *and* robbed of their twenty seconds for the same flicker.
    """
    from config.settings import settings
    from state_machine.yoga_manager import YogaManager

    assert FRAMING_BAD_FRAMES < settings.YOGA_HOLD_DEBOUNCE_FRAMES

    manager = YogaManager()
    assert manager.set_pose("mountain")

    good = _skeleton(MOUNTAIN_OK)
    for _ in range(6):
        state = manager.process_frame(good)
    assert state.is_in_pose
    held = state.hold_seconds
    assert held > 0

    blip = _hide(good, 25, 26, 27, 28)
    for _ in range(FRAMING_BAD_FRAMES - 1):
        state = manager.process_frame(blip)
        assert state.violations == []

    state = manager.process_frame(good)
    assert state.is_in_pose
    assert state.hold_seconds >= held, "the blip should not have reset the hold"
