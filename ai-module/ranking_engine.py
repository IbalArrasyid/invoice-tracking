"""
ranking_engine.py — Driver Ranking Engine dengan Operational Constraints
=========================================================================

Modul ini mengimplementasikan ranking driver menggunakan SAW score
dengan tambahan constraint filtering untuk memastikan hanya driver
yang memenuhi syarat operasional yang direkomendasikan.

Operational Constraints:
    - max_invoice_per_driver: Maksimal invoice aktif per driver (default: 8)
    - working_hours: Jam kerja operasional (08:00 - 17:00)
    - driver_availability: Driver harus dalam status aktif
    - area_coverage: Driver harus meng-cover area pengantaran

Proses:
    1. Evaluasi setiap driver dengan SAW score
    2. Cek constraint operasional
    3. Apply penalty jika constraint tidak terpenuhi
    4. Ranking berdasarkan adjusted score
    5. Return Top-N rekomendasi

Author: AI Module Team
"""

from datetime import datetime
from recommendation_engine import SAWRecommendationEngine


class DriverRankingEngine:
    """
    Engine untuk ranking driver berdasarkan SAW score
    dan operational constraints.
    """

    def __init__(self):
        """Inisialisasi dengan default constraint configuration."""
        self.saw_engine = SAWRecommendationEngine()
        self.constraints = {
            'max_invoice_per_driver': 8,
            'working_hours_start': '08:00',
            'working_hours_end': '17:00',
            'require_active_status': True,
            'area_mismatch_penalty': 0.15,
            'overload_penalty': 0.20,
        }

    def check_constraints(self, driver: dict, workload: int) -> dict:
        """
        Cek apakah driver memenuhi constraint operasional.

        Args:
            driver: Dict dengan keys {name, area, workload, is_active}
            workload: Jumlah invoice aktif saat ini

        Returns:
            Dict {eligible: bool, violations: list, penalties: float}
        """
        violations = []
        total_penalty = 0.0
        is_active = driver.get('is_active', True)

        # Constraint 1: Status aktif
        if self.constraints['require_active_status'] and not is_active:
            violations.append('Driver tidak aktif')
            total_penalty += 1.0  # Disqualified

        # Constraint 2: Maksimal invoice
        max_inv = self.constraints['max_invoice_per_driver']
        if workload >= max_inv:
            violations.append(f'Beban kerja melebihi batas ({workload}/{max_inv})')
            total_penalty += self.constraints['overload_penalty']

        # Constraint 3: Jam kerja
        now = datetime.now()
        current_hour = now.hour
        try:
            start_h = int(self.constraints['working_hours_start'].split(':')[0])
            end_h = int(self.constraints['working_hours_end'].split(':')[0])
        except (ValueError, AttributeError):
            start_h, end_h = 8, 17

        if current_hour < start_h or current_hour >= end_h:
            violations.append(f'Di luar jam kerja ({self.constraints["working_hours_start"]}-{self.constraints["working_hours_end"]})')
            total_penalty += 0.10

        eligible = total_penalty < 1.0  # Eligible jika penalty < 100%

        return {
            'eligible': eligible,
            'violations': violations,
            'total_penalty': round(min(total_penalty, 1.0), 4),
        }

    def evaluate_driver(
        self,
        driver: dict,
        invoice_data: dict,
        priority_label: str,
    ) -> dict:
        """
        Evaluasi satu driver untuk invoice tertentu.

        Args:
            driver: Dict {name, area, workload, is_active}
            invoice_data: Dict {area_pengantaran, jadwal_terima, cut_off_jam}
            priority_label: Label prioritas dari C4.5

        Returns:
            Dict dengan SAW score, constraint check, dan adjusted score
        """
        workload = driver.get('workload', 0)

        # Step 1: Hitung SAW score
        saw_result = self.saw_engine.get_recommendation(
            priority_label=priority_label,
            area_pengantaran=invoice_data.get('area_pengantaran', ''),
            jadwal_terima=invoice_data.get('jadwal_terima', ''),
            cut_off_jam=invoice_data.get('cut_off_jam', '12:00'),
            driver_area=driver.get('area', ''),
            driver_workload=workload,
        )

        # Step 2: Cek constraints
        constraint_result = self.check_constraints(driver, workload)

        # Step 3: Apply penalty ke score
        raw_score = saw_result['recommendation_score']
        penalty = constraint_result['total_penalty']
        adjusted_score = round(max(0, raw_score - penalty), 4)

        return {
            'driver': driver.get('name', 'Unknown'),
            'area': driver.get('area', ''),
            'workload': workload,
            'is_active': driver.get('is_active', True),
            'raw_score': raw_score,
            'penalty': penalty,
            'adjusted_score': adjusted_score,
            'eligible': constraint_result['eligible'],
            'violations': constraint_result['violations'],
            'score_details': saw_result['score_details'],
            'recommended_delivery_day': saw_result['recommended_delivery_day'],
        }

    def rank_drivers(
        self,
        drivers: list,
        invoice_data: dict,
        priority_label: str,
    ) -> list:
        """
        Ranking semua driver berdasarkan adjusted SAW score.

        Args:
            drivers: List of driver dicts
            invoice_data: Invoice details
            priority_label: Priority dari C4.5

        Returns:
            List of driver evaluations, sorted by adjusted_score DESC
        """
        evaluations = []

        for driver in drivers:
            evaluation = self.evaluate_driver(driver, invoice_data, priority_label)
            evaluations.append(evaluation)

        # Sort: eligible first, then by adjusted_score descending
        evaluations.sort(
            key=lambda x: (x['eligible'], x['adjusted_score']),
            reverse=True,
        )

        # Assign rank
        for i, ev in enumerate(evaluations):
            ev['rank'] = i + 1

        return evaluations

    def get_top_recommendations(
        self,
        drivers: list,
        invoice_data: dict,
        priority_label: str,
        top_n: int = 3,
    ) -> list:
        """
        Get top-N driver recommendations.

        Args:
            drivers: List of all available drivers
            invoice_data: Invoice details
            priority_label: Priority label
            top_n: Number of top recommendations (default: 3)

        Returns:
            List of top N driver recommendations with rank
        """
        ranked = self.rank_drivers(drivers, invoice_data, priority_label)
        return ranked[:top_n]

    def get_constraint_config(self) -> dict:
        """Return current constraint configuration."""
        return dict(self.constraints)
