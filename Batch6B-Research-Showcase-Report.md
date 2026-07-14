# Batch 6B - Research Showcase Report

## Scope

Batch 6B adds a frontend-only Research Showcase module for supervisor review and thesis defense.

This batch did not modify:

- Backend
- API endpoints
- Rule Engine
- Decision Tree runtime
- AI module
- Database
- Workflow logic
- Authentication

## Components Added

| Component | File | Purpose |
| --- | --- | --- |
| `ResearchShowcasePage` | `frontend/src/pages/ResearchShowcasePage.jsx` | Main thesis defense page showing the Operational Knowledge Formalization Framework. |
| `FrameworkOverview` | `frontend/src/pages/ResearchShowcasePage.jsx` | Displays the framework explanation and figure. |
| `FrameworkFigure` | `frontend/src/pages/ResearchShowcasePage.jsx` | Responsive in-page figure for the framework flow. |
| `KnowledgeAcquisition` | `frontend/src/pages/ResearchShowcasePage.jsx` | Explains Customer Regulation, Historical Invoice, and Expert Knowledge. |
| `KnowledgeFormalization` | `frontend/src/pages/ResearchShowcasePage.jsx` | Presents operational attributes, labeling guideline, and Rule Base R1-R12. |
| `KnowledgeRepresentation` | `frontend/src/pages/ResearchShowcasePage.jsx` | Shows the relationship between Rule-Based Representation and Decision Tree Reconstruction. |
| `PriorityRecommendationExample` | `frontend/src/pages/ResearchShowcasePage.jsx` | Displays one current backend recommendation response when available. |
| `OperationalWorkflow` | `frontend/src/pages/ResearchShowcasePage.jsx` | Illustrates Invoice -> Priority Recommendation -> Invoice Tracking -> POD -> Completed. |

## Existing Components Reused

| Component / Utility | Usage |
| --- | --- |
| `Topbar` | Keeps the page consistent with the existing dashboard layout. |
| `PrioritySummaryCards` | Displays the example priority, action, confidence, and status. |
| `KnowledgeTraceTimeline` | Displays the knowledge trace from the current backend response. |
| `DecisionTreeReconstruction` | Displays reconstructed decision tree path and confidence. |
| `RuleEvidenceTable` | Displays rule ID, rule evidence, activated conditions, and explanation. |
| `normalizePriorityResponse` | Normalizes the existing backend response into frontend research sections. |
| `recommendationService.getHistory()` | Reads current recommendation history without adding backend logic. |
| `invoiceService.getAll()` | Resolves invoice context for the example recommendation. |

## Figures Integrated

| Figure | Implementation |
| --- | --- |
| Operational Knowledge Formalization Framework | Integrated as a responsive in-page figure using existing dashboard card styling. It follows the existing research methodology flow artifact in the project and avoids adding a fake image asset. |
| Knowledge Representation relationship | Integrated as paired panels showing Rule-Based Representation and Decision Tree Reconstruction as connected representations of formalized operational knowledge. |
| Operational Workflow | Integrated as a step figure: Invoice -> Priority Recommendation -> Invoice Tracking -> Proof of Delivery -> Completed. |

## Data Sources

| Section | Source |
| --- | --- |
| Framework explanation | Static frontend thesis explanation based on the finalized contribution. |
| Knowledge Acquisition | Static thesis explanation for Customer Regulation, Historical Invoice, and Expert Knowledge. |
| Knowledge Formalization | Static frontend display of operational attributes and finalized R1-R12 rule names read from the research artifact. |
| Priority Recommendation Example | Existing `/api/recommendation/history` response through `recommendationService.getHistory()`. |
| Invoice Context | Existing `/api/invoices` response through `invoiceService.getAll()`. |
| Knowledge Trace / Rule Evidence / Decision Path | Existing backend compatibility and research response fields normalized by `normalizePriorityResponse`. |

## Routing and Navigation

| File | Change |
| --- | --- |
| `frontend/src/App.jsx` | Added route `/research-showcase`. |
| `frontend/src/components/Sidebar.jsx` | Added `Research Showcase` navigation item under the analytics section. |

## Verification

Frontend production build completed successfully:

```bash
npm run build -- --outDir ..\batch6b-build-output --emptyOutDir false
```

Build warnings observed:

- Existing CSS warning: `*, *::before, *after` contains `*after`.
- Existing Vite chunk-size warning.

No Batch 6B build errors were introduced.

Temporary build output was removed after verification.

## Remaining Work Before Final Deployment

- Replace the in-page framework figure with the final exported thesis figure if a polished PDF/SVG/PNG asset becomes available.
- Add presenter notes or a defense mode only if requested by the supervisor.
- Ensure at least one recommendation has been generated before defense so the example section can display a current backend response.
- Consider code-splitting the frontend bundle to address the existing Vite chunk-size warning.
- Fix the existing global CSS selector typo `*after` to `*::after` in a separate UI maintenance batch.
