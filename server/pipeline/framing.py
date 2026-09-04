"""Deciding whether the camera can see enough of the body to judge a pose.

This exists because the naive answer — "is every required joint above a
visibility threshold, right now?" — produces a cue that fires constantly and
is usually wrong.

Two separate problems, two separate gates
-----------------------------------------
**Per joint.** MediaPipe's ``visibility`` for a partly-occluded joint does not
sit still; it oscillates around whatever value it is near. A single threshold
therefore flips a joint between seen and unseen many times a second. Tree Pose
is the worst case and the clearest illustration: the whole point of the pose is
to tuck one foot behind the standing leg, so the ankle the detector needs is
the ankle the pose deliberately hides. :class:`VisibilityGate` gives each joint
a Schmitt trigger — harder to become visible than to stay visible — so a joint
hovering at the boundary settles instead of chattering.

**Per verdict.** Even with settled joints, one bad frame should not put a
message on screen. :class:`FramingGate` requires a run of bad frames before it
will report a problem, and a run of good ones before it clears. At the client's
12fps the defaults are roughly 0.4s to appear and 0.25s to go away — slow
enough that nothing flickers, fast enough that someone genuinely out of shot is
told promptly.

Both gates are stateful across frames, which is fine: a pose object lives for
as long as a client stays on that pose (see ``YogaManager.set_pose``).
"""

from dataclasses import dataclass

# A joint must clear this to be considered newly visible...
VISIBILITY_ENTER = 0.30
# ...but only has to stay above this to remain visible.
#
# The gap is the whole point, and it deliberately opens *downward* from the old
# single threshold of 0.30 rather than upward. Entering at the old value means
# nothing that used to be judged stops being judged; leaving at 0.20 means a
# joint that has been seen is given the benefit of the doubt when its score
# dips. A change in the other direction would have traded chatter for a
# stricter detector, which is not the complaint being fixed.
VISIBILITY_EXIT = 0.20

# Consecutive frames before a framing problem is reported / cleared. At the
# client's 12fps these are ~0.4s and ~0.25s.
BAD_FRAMES = 5
GOOD_FRAMES = 3

# MediaPipe extrapolates landmarks past the edge of the image rather than
# clamping them, so a coordinate outside this range means the joint is
# genuinely outside the picture — not merely hidden behind something. The small
# margin keeps a body touching the edge of frame from tripping it.
FRAME_MARGIN = 0.02


class VisibilityGate:
    """Per-joint Schmitt trigger over MediaPipe's visibility score.

    ``update`` is called once per joint per frame and returns whether that
    joint should be treated as visible *now*, taking its previous state into
    account.
    """

    def __init__(
        self,
        enter: float = VISIBILITY_ENTER,
        exit: float = VISIBILITY_EXIT,
    ):
        self._enter = float(enter)
        self._exit = float(exit)
        self._visible: dict[str, bool] = {}

    def update(self, joint: str, visibility: float) -> bool:
        was_visible = self._visible.get(joint, False)
        threshold = self._exit if was_visible else self._enter
        now_visible = visibility >= threshold
        self._visible[joint] = now_visible
        return now_visible

    def reset(self) -> None:
        self._visible.clear()


@dataclass(frozen=True)
class FramingVerdict:
    """What to tell the user about framing on this frame.

    ``report`` is the only field the caller acts on. ``out_of_frame``
    distinguishes the two causes, which need different advice: a body extending
    past the edge of the picture is fixed by stepping back, and a body that is
    inside the picture but unreadable is not — telling someone to step back
    when they are already fully in shot sends them fixing the wrong thing.
    """

    report: bool
    out_of_frame: bool


class FramingGate:
    """Frame-count hysteresis over the per-frame "can we judge this?" answer."""

    def __init__(self, bad_frames: int = BAD_FRAMES, good_frames: int = GOOD_FRAMES):
        self._bad_frames = int(bad_frames)
        self._good_frames = int(good_frames)
        self.reset()

    def reset(self) -> None:
        self._bad_streak = 0
        self._good_streak = 0
        self._reporting = False
        self._cause_out_of_frame = False

    def update(self, readable: bool, out_of_frame: bool = False) -> FramingVerdict:
        """Advance one frame.

        ``readable`` is whether every joint the pose truly needs was visible.
        ``out_of_frame`` is whether the reason was the body leaving the picture.
        """
        if readable:
            self._bad_streak = 0
            self._good_streak += 1
            if self._reporting and self._good_streak >= self._good_frames:
                self._reporting = False
        else:
            self._good_streak = 0
            self._bad_streak += 1
            if not self._reporting and self._bad_streak >= self._bad_frames:
                self._reporting = True
                # Latched for the whole episode. A joint hovering at the edge
                # of the picture answers this differently frame to frame, and
                # alternating between "step back" and "face the camera" is the
                # same chatter this class exists to remove — just one level up.
                self._cause_out_of_frame = out_of_frame

        return FramingVerdict(
            report=self._reporting,
            out_of_frame=self._reporting and self._cause_out_of_frame,
        )

    @property
    def reporting(self) -> bool:
        return self._reporting


def is_out_of_frame(x: float, y: float, margin: float = FRAME_MARGIN) -> bool:
    """Whether a normalized landmark sits outside the picture."""
    return not (-margin <= x <= 1.0 + margin and -margin <= y <= 1.0 + margin)
