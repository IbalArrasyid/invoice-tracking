"""Entrypoint for the finalized thesis reproducibility package."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from comparative_experiment.config import OUTPUT_DIR, RANDOM_STATE, SOURCE_WORKBOOK
from comparative_experiment.data.dataset import prepare_dataset
from comparative_experiment.experiments.runner import run_experiments
from comparative_experiment.models.decision_tree import save_final_full_data_tree
from comparative_experiment.evaluation.reporting import write_outputs


LOGGER = logging.getLogger(__name__)


def configure_logging() -> None:
    """Configure concise console logging for the experiment run."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S",
    )


def main() -> None:
    """Run the complete finalized comparative experiment."""

    configure_logging()
    LOGGER.info("Loading and preparing dataset: %s", SOURCE_WORKBOOK)
    bundle = prepare_dataset(SOURCE_WORKBOOK)

    LOGGER.info("Running E1-E4 comparative experiments with random_state=%s", RANDOM_STATE)
    predictions = run_experiments(bundle.prepared, random_state=RANDOM_STATE)

    LOGGER.info("Saving final full-data Decision Tree artifact for inspection")
    final_metadata = save_final_full_data_tree(bundle.prepared, random_state=RANDOM_STATE)

    LOGGER.info("Writing reproducibility outputs: %s", OUTPUT_DIR)
    paths = write_outputs(bundle, predictions, final_metadata, output_dir=OUTPUT_DIR)

    LOGGER.info("Experiment complete")
    print(f"Generated {len(paths)} output artifacts in: {OUTPUT_DIR}")
    print(f"Primary summary: {paths['experiment_summary']}")


if __name__ == "__main__":
    main()

