"""Landmark geometry shared by the yoga pose detectors.

Trimmed from the original ``exercises/base.py`` in
``shahmir2004/exercise-form-correction``. Only the pieces the yoga pipeline
actually reads survive: the joint vocabulary, the MediaPipe index map, the
landmark container, and the two helpers.

What was removed and why
------------------------
``BaseExercise`` lived here and imported ``pipeline.rep_counter`` at module
level. Yoga poses are *held*, not repeated, so nothing here counts reps — but
that one import was enough to drag the rep counter, and through it the rest of
the exercise pipeline, into every process that touched a yoga pose. Dropping
the class drops the import, and ``pipeline/rep_counter.py`` does not ship at
all. ``ExerciseType``, ``JointAngles`` and ``ExerciseResult`` went with it for
the same reason: nothing in the yoga chain names them.

``tests/test_slim_server.py`` fails if any of that finds its way back.
"""

from dataclasses import dataclass
from enum import Enum

import numpy as np


class JointName(str, Enum):
    """MediaPipe pose landmark names."""
    NOSE = "nose"
    LEFT_EYE_INNER = "left_eye_inner"
    LEFT_EYE = "left_eye"
    LEFT_EYE_OUTER = "left_eye_outer"
    RIGHT_EYE_INNER = "right_eye_inner"
    RIGHT_EYE = "right_eye"
    RIGHT_EYE_OUTER = "right_eye_outer"
    LEFT_EAR = "left_ear"
    RIGHT_EAR = "right_ear"
    MOUTH_LEFT = "mouth_left"
    MOUTH_RIGHT = "mouth_right"
    LEFT_SHOULDER = "left_shoulder"
    RIGHT_SHOULDER = "right_shoulder"
    LEFT_ELBOW = "left_elbow"
    RIGHT_ELBOW = "right_elbow"
    LEFT_WRIST = "left_wrist"
    RIGHT_WRIST = "right_wrist"
    LEFT_PINKY = "left_pinky"
    RIGHT_PINKY = "right_pinky"
    LEFT_INDEX = "left_index"
    RIGHT_INDEX = "right_index"
    LEFT_THUMB = "left_thumb"
    RIGHT_THUMB = "right_thumb"
    LEFT_HIP = "left_hip"
    RIGHT_HIP = "right_hip"
    LEFT_KNEE = "left_knee"
    RIGHT_KNEE = "right_knee"
    LEFT_ANKLE = "left_ankle"
    RIGHT_ANKLE = "right_ankle"
    LEFT_HEEL = "left_heel"
    RIGHT_HEEL = "right_heel"
    LEFT_FOOT_INDEX = "left_foot_index"
    RIGHT_FOOT_INDEX = "right_foot_index"


LANDMARK_INDICES = {
    JointName.NOSE: 0,
    JointName.LEFT_EYE_INNER: 1,
    JointName.LEFT_EYE: 2,
    JointName.LEFT_EYE_OUTER: 3,
    JointName.RIGHT_EYE_INNER: 4,
    JointName.RIGHT_EYE: 5,
    JointName.RIGHT_EYE_OUTER: 6,
    JointName.LEFT_EAR: 7,
    JointName.RIGHT_EAR: 8,
    JointName.MOUTH_LEFT: 9,
    JointName.MOUTH_RIGHT: 10,
    JointName.LEFT_SHOULDER: 11,
    JointName.RIGHT_SHOULDER: 12,
    JointName.LEFT_ELBOW: 13,
    JointName.RIGHT_ELBOW: 14,
    JointName.LEFT_WRIST: 15,
    JointName.RIGHT_WRIST: 16,
    JointName.LEFT_PINKY: 17,
    JointName.RIGHT_PINKY: 18,
    JointName.LEFT_INDEX: 19,
    JointName.RIGHT_INDEX: 20,
    JointName.LEFT_THUMB: 21,
    JointName.RIGHT_THUMB: 22,
    JointName.LEFT_HIP: 23,
    JointName.RIGHT_HIP: 24,
    JointName.LEFT_KNEE: 25,
    JointName.RIGHT_KNEE: 26,
    JointName.LEFT_ANKLE: 27,
    JointName.RIGHT_ANKLE: 28,
    JointName.LEFT_HEEL: 29,
    JointName.RIGHT_HEEL: 30,
    JointName.LEFT_FOOT_INDEX: 31,
    JointName.RIGHT_FOOT_INDEX: 32,
}


@dataclass
class Landmark:
    """Single pose landmark with normalized coordinates."""
    x: float  # 0-1 normalized
    y: float  # 0-1 normalized
    z: float  # Depth relative to hips
    visibility: float  # 0-1 confidence


def calculate_angle(p1: Landmark, p2: Landmark, p3: Landmark) -> float:
    """
    Calculate angle at p2 formed by p1-p2-p3.
    Returns angle in degrees (0-180).
    """
    v1 = np.array([p1.x - p2.x, p1.y - p2.y, p1.z - p2.z])
    v2 = np.array([p3.x - p2.x, p3.y - p2.y, p3.z - p2.z])

    # Normalize vectors
    v1_norm = np.linalg.norm(v1)
    v2_norm = np.linalg.norm(v2)

    if v1_norm == 0 or v2_norm == 0:
        return 0.0

    v1 = v1 / v1_norm
    v2 = v2 / v2_norm

    # Calculate angle
    cos_angle = np.clip(np.dot(v1, v2), -1.0, 1.0)
    angle = np.arccos(cos_angle)

    return np.degrees(angle)


def landmarks_to_dict(landmarks: list[dict]) -> dict[JointName, Landmark]:
    """Convert landmark list to dictionary by joint name."""
    result = {}
    for joint_name, idx in LANDMARK_INDICES.items():
        if idx < len(landmarks):
            lm = landmarks[idx]
            result[joint_name] = Landmark(
                x=lm.get("x", 0),
                y=lm.get("y", 0),
                z=lm.get("z", 0),
                visibility=lm.get("visibility", 0)
            )
    return result
