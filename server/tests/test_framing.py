"""Tests for the visibility and framing gates.

These pin the behaviour that makes the "step back" cue tolerable: it must not
appear on a blip, it must not chatter, and when it does appear it must name the
right problem. Each test below corresponds to a way the old single-threshold
check got that wrong.
"""

from pipeline.framing import (
    BAD_FRAMES,
    GOOD_FRAMES,
    VISIBILITY_ENTER,
    VISIBILITY_EXIT,
    FramingGate,
    VisibilityGate,
    is_out_of_frame,
)


class TestVisibilityGate:
    def test_a_clearly_seen_joint_is_visible(self):
        gate = VisibilityGate()
        assert gate.update("left_knee", 0.9) is True

    def test_a_clearly_unseen_joint_is_not(self):
        gate = VisibilityGate()
        assert gate.update("left_knee", 0.05) is False

    def test_entering_is_harder_than_staying(self):
        """The defining property. Between the two thresholds, history decides."""
        between = (VISIBILITY_ENTER + VISIBILITY_EXIT) / 2
        assert VISIBILITY_EXIT < between < VISIBILITY_ENTER

        cold = VisibilityGate()
        assert cold.update("left_ankle", between) is False

        warm = VisibilityGate()
        warm.update("left_ankle", 0.9)
        assert warm.update("left_ankle", between) is True

    def test_a_joint_oscillating_across_the_old_threshold_stays_settled(self):
        """The Tree Pose case: an ankle tucked behind the standing leg.

        Scores either side of 0.30 used to flip the joint in and out on every
        frame. Once seen, it now stays seen.
        """
        gate = VisibilityGate()
        gate.update("right_ankle", 0.9)  # seen clearly once
        for score in (0.25, 0.35, 0.22, 0.33, 0.28, 0.31):
            assert gate.update("right_ankle", score) is True

    def test_a_sustained_drop_still_loses_the_joint(self):
        gate = VisibilityGate()
        gate.update("right_ankle", 0.9)
        assert gate.update("right_ankle", VISIBILITY_EXIT - 0.05) is False

    def test_joints_are_tracked_independently(self):
        gate = VisibilityGate()
        gate.update("left_wrist", 0.9)
        gate.update("right_wrist", 0.05)
        between = (VISIBILITY_ENTER + VISIBILITY_EXIT) / 2
        assert gate.update("left_wrist", between) is True
        assert gate.update("right_wrist", between) is False


class TestFramingGate:
    def test_silent_while_everything_is_readable(self):
        gate = FramingGate()
        for _ in range(20):
            assert gate.update(readable=True).report is False

    def test_a_brief_loss_is_never_mentioned(self):
        """Nothing should appear for a drop shorter than the bad-frame run."""
        gate = FramingGate()
        for _ in range(BAD_FRAMES - 1):
            assert gate.update(readable=False).report is False

    def test_a_sustained_loss_is_reported(self):
        gate = FramingGate()
        verdicts = [gate.update(readable=False) for _ in range(BAD_FRAMES)]
        assert verdicts[-1].report is True

    def test_the_streak_must_be_consecutive(self):
        """One good frame resets the count, so alternating never reports."""
        gate = FramingGate()
        for _ in range(40):
            assert gate.update(readable=False).report is False
            assert gate.update(readable=True).report is False

    def test_it_clears_after_a_run_of_good_frames(self):
        gate = FramingGate()
        for _ in range(BAD_FRAMES):
            gate.update(readable=False)
        assert gate.reporting is True

        for _ in range(GOOD_FRAMES - 1):
            assert gate.update(readable=True).report is True
        assert gate.update(readable=True).report is False

    def test_it_keeps_reporting_until_it_clears(self):
        gate = FramingGate()
        for _ in range(BAD_FRAMES + 10):
            gate.update(readable=False)
        assert gate.reporting is True

    def test_the_cause_is_carried_through(self):
        gate = FramingGate()
        for _ in range(BAD_FRAMES):
            verdict = gate.update(readable=False, out_of_frame=True)
        assert verdict.report is True
        assert verdict.out_of_frame is True

    def test_reset_forgets_everything(self):
        gate = FramingGate()
        for _ in range(BAD_FRAMES):
            gate.update(readable=False)
        gate.reset()
        assert gate.reporting is False
        assert gate.update(readable=False).report is False


class TestIsOutOfFrame:
    def test_the_middle_of_the_picture_is_in_frame(self):
        assert is_out_of_frame(0.5, 0.5) is False

    def test_the_edges_are_in_frame(self):
        assert is_out_of_frame(0.0, 0.0) is False
        assert is_out_of_frame(1.0, 1.0) is False

    def test_extrapolated_coordinates_are_out_of_frame(self):
        """MediaPipe predicts past the edge rather than clamping, which is
        what makes this a usable signal at all."""
        assert is_out_of_frame(0.5, 1.4) is True
        assert is_out_of_frame(-0.3, 0.5) is True

    def test_a_body_touching_the_edge_is_not_out_of_frame(self):
        assert is_out_of_frame(0.5, 1.01) is False


class TestFramingCauseIsLatched:
    def test_the_cause_is_fixed_when_reporting_starts(self):
        """A joint hovering at the edge of the picture answers "out of frame?"
        differently frame to frame. Without latching, the user hears "step
        back" and "face the camera" alternating.
        """
        gate = FramingGate()
        for _ in range(BAD_FRAMES):
            gate.update(readable=False, out_of_frame=True)

        # The situation now reads as merely occluded, but the episode is the
        # same episode and keeps the advice it started with.
        for _ in range(10):
            verdict = gate.update(readable=False, out_of_frame=False)
            assert verdict.report is True
            assert verdict.out_of_frame is True

    def test_a_new_episode_reads_the_cause_again(self):
        gate = FramingGate()
        for _ in range(BAD_FRAMES):
            gate.update(readable=False, out_of_frame=True)
        for _ in range(GOOD_FRAMES):
            gate.update(readable=True)
        assert gate.reporting is False

        for _ in range(BAD_FRAMES):
            verdict = gate.update(readable=False, out_of_frame=False)
        assert verdict.report is True
        assert verdict.out_of_frame is False

    def test_nothing_is_claimed_while_not_reporting(self):
        gate = FramingGate()
        verdict = gate.update(readable=False, out_of_frame=True)
        assert verdict.report is False
        assert verdict.out_of_frame is False
