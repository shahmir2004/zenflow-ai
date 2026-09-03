"""Yoga pose detection.

Deliberately empty of re-exports. The original package imported the squat,
push-up and bicep-curl modules here, which pulled the HMM/k-NN classifier — and
through it scipy — into any process that touched a pose. Import the modules you
need directly (``from exercises.yoga_poses import ...``).

``tests/test_slim_server.py`` fails if that changes.
"""
