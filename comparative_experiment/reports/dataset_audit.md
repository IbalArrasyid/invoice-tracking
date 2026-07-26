# Dataset Audit

- Source rows: 101.
- Unique invoices after deduplication: 99.
- Class distribution: {'Not Urgent': 69, 'Urgent': 30}.
- Label normalization: HIGH = Urgent; NORMAL = Not Urgent.
- The source field is expert_label; documentary evidence of administrator provenance remains required.
- expert_reason, sent_date, identifiers, and customer ID are excluded from model features.
- Data-quality or derivation issues: 6; see data/data_quality_issues.csv.

The source workbook was not modified.
