# Comparative Experiment Summary

## Dataset

| item | value |
| --- | --- |
| Source workbook | D:\Semester 8\Tugas Akhir\farah\paper-2\paper-invoice-tracking\dataset_invoice.xlsx |
| Source sheet | Data Labeling |
| Raw invoice rows | 101 |
| Unique invoices used | 99 |
| Removed duplicate rows | 2 |
| Urgent invoices | 30 |
| Not Urgent invoices | 69 |
| Ground-truth source column | expert_label |
| Target column | admin_ground_truth |

## Final Methodology

- Research type: comparative analysis.
- Methods: Rule-Based Classification using only R1-R8 and Decision Tree Classification.
- Ground truth: historical admin labels from expert_label.
- Decision Tree implementation: sklearn.tree.DecisionTreeClassifier with criterion="entropy".
- Hyperparameter tuning: not performed.
- Experiments: E1 80:20 hold-out, E2 70:30 hold-out, E3 5-fold stratified CV, E4 LOOCV.
- Primary final evaluation: E4 LOOCV.

## Metrics

| experiment_id | method | n | accuracy | precision | recall | f1_score | macro_f1 | false_positive | false_negative |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1_80_20 | Rule-Based | 20 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0 | 0 |
| E1_80_20 | Decision Tree | 20 | 0.9500 | 1.0000 | 0.8333 | 0.9091 | 0.9373 | 0 | 1 |
| E2_70_30 | Rule-Based | 30 | 0.9333 | 1.0000 | 0.7778 | 0.8750 | 0.9148 | 0 | 2 |
| E2_70_30 | Decision Tree | 30 | 0.9333 | 1.0000 | 0.7778 | 0.8750 | 0.9148 | 0 | 2 |
| E3_5_Fold_CV | Rule-Based | 99 | 0.9394 | 1.0000 | 0.8000 | 0.8889 | 0.9236 | 0 | 6 |
| E3_5_Fold_CV | Decision Tree | 99 | 0.9596 | 0.9643 | 0.9000 | 0.9310 | 0.9512 | 1 | 3 |
| E4_LOOCV | Rule-Based | 99 | 0.9394 | 1.0000 | 0.8000 | 0.8889 | 0.9236 | 0 | 6 |
| E4_LOOCV | Decision Tree | 99 | 0.9697 | 0.9655 | 0.9333 | 0.9492 | 0.9638 | 1 | 2 |

## Comparison Table

| experiment_id | experiment | method | n | accuracy | precision | recall | f1_score | macro_f1 | false_positive | false_negative |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E1_80_20 | Stratified Hold-out 80:20 | Rule-Based | 20 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0 | 0 |
| E1_80_20 | Stratified Hold-out 80:20 | Decision Tree | 20 | 0.95 | 1.0 | 0.8333333333333334 | 0.9090909090909091 | 0.9373040752351097 | 0 | 1 |
| E2_70_30 | Stratified Hold-out 70:30 | Rule-Based | 30 | 0.9333333333333333 | 1.0 | 0.7777777777777778 | 0.875 | 0.9147727272727273 | 0 | 2 |
| E2_70_30 | Stratified Hold-out 70:30 | Decision Tree | 30 | 0.9333333333333333 | 1.0 | 0.7777777777777778 | 0.875 | 0.9147727272727273 | 0 | 2 |
| E3_5_Fold_CV | 5-Fold Stratified Cross Validation | Rule-Based | 99 | 0.9393939393939394 | 1.0 | 0.8 | 0.8888888888888888 | 0.9236111111111112 | 0 | 6 |
| E3_5_Fold_CV | 5-Fold Stratified Cross Validation | Decision Tree | 99 | 0.9595959595959596 | 0.9642857142857143 | 0.9 | 0.9310344827586207 | 0.951231527093596 | 1 | 3 |
| E4_LOOCV | Leave-One-Out Cross Validation (LOOCV) | Rule-Based | 99 | 0.9393939393939394 | 1.0 | 0.8 | 0.8888888888888888 | 0.9236111111111112 | 0 | 6 |
| E4_LOOCV | Leave-One-Out Cross Validation (LOOCV) | Decision Tree | 99 | 0.9696969696969697 | 0.9655172413793104 | 0.9333333333333333 | 0.9491525423728814 | 0.9637849042799659 | 1 | 2 |

## Exact McNemar Test

| experiment_id | experiment | both_correct | rule_based_only_correct_b | decision_tree_only_correct_c | both_wrong | discordant_pairs | p_value |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E1_80_20 | Stratified Hold-out 80:20 | 19 | 1 | 0 | 0 | 1 | 1.0000 |
| E2_70_30 | Stratified Hold-out 70:30 | 27 | 1 | 1 | 1 | 2 | 1.0000 |
| E3_5_Fold_CV | 5-Fold Stratified Cross Validation | 90 | 3 | 5 | 1 | 8 | 0.7266 |
| E4_LOOCV | Leave-One-Out Cross Validation (LOOCV) | 91 | 2 | 5 | 1 | 7 | 0.4531 |

The CSV and text files in this output directory are the reproducibility sources for the thesis tables.