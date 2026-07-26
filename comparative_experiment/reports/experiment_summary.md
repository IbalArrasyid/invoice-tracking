# Comparative Experiment Summary

Both methods were evaluated on identical validation invoices in each scenario.
Decision Tree parameters were selected using training data only.
LOOCV metrics were calculated from aggregated out-of-fold predictions.

| experiment | method | n | accuracy | precision_urgent | recall_urgent | f1_urgent | f1_macro | true_negative | false_positive | false_negative | true_positive |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1_80_20 | Rule-Based | 20 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 14 | 0 | 0 | 6 |
| E1_80_20 | Decision Tree | 20 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 14 | 0 | 0 | 6 |
| E2_70_30 | Rule-Based | 30 | 0.9333 | 1.0 | 0.7778 | 0.875 | 0.9148 | 21 | 0 | 2 | 7 |
| E2_70_30 | Decision Tree | 30 | 0.9667 | 1.0 | 0.8889 | 0.9412 | 0.959 | 21 | 0 | 1 | 8 |
| E3_5_Fold_CV | Rule-Based | 99 | 0.9394 | 1.0 | 0.8 | 0.8889 | 0.9236 | 69 | 0 | 6 | 24 |
| E3_5_Fold_CV | Decision Tree | 99 | 0.9596 | 0.9643 | 0.9 | 0.931 | 0.9512 | 68 | 1 | 3 | 27 |
| E4_LOOCV | Rule-Based | 99 | 0.9394 | 1.0 | 0.8 | 0.8889 | 0.9236 | 69 | 0 | 6 | 24 |
| E4_LOOCV | Decision Tree | 99 | 0.9798 | 0.9667 | 0.9667 | 0.9667 | 0.9761 | 68 | 1 | 1 | 29 |

The final full-data Decision Tree is interpretive only and is not used for test metrics.
Final tree depth: 2; leaves: 4.