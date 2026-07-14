"""
explainable_engine.py — Explainable Recommendation Engine
===========================================================

Modul ini menghasilkan penjelasan rekomendasi yang human-readable
dalam Bahasa Indonesia. Mendukung prinsip Explainable AI (XAI)
agar setiap keputusan rekomendasi dapat dipahami oleh pengguna.

Komponen penjelasan:
    1. Factor Explanations   — Penjelasan per kriteria SAW
    2. Recommendation Summary — Ringkasan narasi rekomendasi
    3. Operational Notes      — Catatan operasional dan constraint
    4. Confidence Explanation — Penjelasan tingkat kepercayaan

Author: AI Module Team
"""


# ─── Template penjelasan per kriteria ─────────────────────────────
FACTOR_TEMPLATES = {
    'priority_score': {
        1.0:  'Prioritas tinggi — invoice memerlukan penanganan segera',
        0.7:  'Prioritas sedang — invoice perlu ditangani dalam waktu dekat',
        0.4:  'Prioritas rendah — invoice dapat dijadwalkan secara fleksibel',
    },
    'cut_off_urgency': {
        1.0:  'Cut-off sangat dekat (≤10:00) — pengiriman harus segera dilakukan',
        0.8:  'Cut-off cukup dekat (≤12:00) — perlu pengiriman hari ini',
        0.6:  'Cut-off sedang (≤14:00) — masih ada waktu pengiriman hari ini',
        0.3:  'Cut-off longgar (>14:00) — waktu pengiriman fleksibel',
    },
    'area_match': {
        1.0:  'Area pengantaran sesuai dengan area kerja driver',
        0.7:  'Area pengantaran bertetangga dengan area kerja driver',
        0.4:  'Area pengantaran tidak sesuai dengan area kerja driver',
    },
    'driver_workload': {
        1.0:  'Beban kerja driver rendah (≤3 tugas) — kapasitas tersedia',
        0.7:  'Beban kerja driver sedang (4-6 tugas) — kapasitas terbatas',
        0.4:  'Beban kerja driver tinggi (>6 tugas) — kapasitas hampir penuh',
    },
    'schedule_match': {
        1.0:  'Hari ini sesuai jadwal penerimaan customer',
        0.7:  'Besok sesuai jadwal penerimaan customer',
        0.3:  'Hari ini dan besok tidak sesuai jadwal penerimaan customer',
    },
}

# ─── Label kriteria (untuk display) ──────────────────────────────
FACTOR_LABELS = {
    'priority_score':    'Skor Prioritas',
    'cut_off_urgency':   'Urgensi Cut-Off',
    'area_match':        'Kecocokan Area',
    'driver_workload':   'Beban Kerja Driver',
    'schedule_match':    'Kesesuaian Jadwal',
}


class ExplainableEngine:
    """
    Engine untuk menghasilkan penjelasan rekomendasi yang
    transparan dan mudah dipahami.
    """

    def generate_factor_explanations(self, score_details: dict) -> list:
        """
        Generate penjelasan untuk setiap faktor/kriteria SAW.

        Args:
            score_details: Dict dari SAW engine berisi skor per kriteria
                          {criterion: {raw, normalized, weighted, weight}}

        Returns:
            List of dicts [{factor, label, raw_score, weighted_score, explanation}]
        """
        explanations = []

        for factor, details in score_details.items():
            raw = details.get('raw', 0)
            weighted = details.get('weighted', 0)
            weight = details.get('weight', 0)

            # Cari template penjelasan yang paling cocok
            templates = FACTOR_TEMPLATES.get(factor, {})
            explanation = self._find_closest_explanation(raw, templates)

            explanations.append({
                'factor': factor,
                'label': FACTOR_LABELS.get(factor, factor),
                'raw_score': round(raw, 4),
                'weighted_score': round(weighted, 4),
                'weight': weight,
                'explanation': explanation,
            })

        return explanations

    def _find_closest_explanation(self, score: float, templates: dict) -> str:
        """
        Cari penjelasan template yang paling dekat dengan skor.

        Args:
            score: Skor raw (0.0 - 1.0)
            templates: Dict {threshold: explanation_text}

        Returns:
            Penjelasan yang paling sesuai
        """
        if not templates:
            return 'Tidak ada penjelasan tersedia'

        # Cari exact match dulu
        if score in templates:
            return templates[score]

        # Cari threshold terdekat
        sorted_thresholds = sorted(templates.keys(), reverse=True)
        for threshold in sorted_thresholds:
            if score >= threshold:
                return templates[threshold]

        # Fallback: gunakan threshold terendah
        return templates[sorted_thresholds[-1]]

    def generate_recommendation_summary(self, recommendation_data: dict) -> str:
        """
        Generate ringkasan narasi rekomendasi lengkap.

        Args:
            recommendation_data: Dict berisi:
                - recommendation_score
                - recommended_delivery_day
                - recommended_driver
                - priority_label
                - area_pengantaran
                - cut_off_jam
                - recommendation_confidence

        Returns:
            String narasi rekomendasi dalam Bahasa Indonesia
        """
        score = recommendation_data.get('recommendation_score', 0)
        delivery_day = recommendation_data.get('recommended_delivery_day', '')
        driver = recommendation_data.get('recommended_driver', '')
        priority = recommendation_data.get('priority_label', '')
        area = recommendation_data.get('area_pengantaran', '')
        cutoff = recommendation_data.get('cut_off_jam', '')
        confidence = recommendation_data.get('recommendation_confidence', '')

        # Build narasi
        parts = []

        parts.append(
            f'Invoice dengan prioritas {priority} untuk area {area} '
            f'mendapatkan skor rekomendasi {score:.2f} ({confidence}).'
        )

        if delivery_day == 'Kirim Hari Ini':
            parts.append(
                f'Rekomendasi: kirim hari ini oleh {driver} '
                f'karena skor tinggi dan urgensi cut-off ({cutoff}).'
            )
        elif delivery_day == 'Kirim Besok':
            parts.append(
                f'Rekomendasi: kirim besok oleh {driver}. '
                f'Skor cukup tinggi namun masih ada toleransi waktu.'
            )
        else:
            parts.append(
                f'Rekomendasi: jadwalkan ulang pengiriman. '
                f'Skor rendah menunjukkan perlu evaluasi ulang jadwal atau driver.'
            )

        return ' '.join(parts)

    def generate_recommendation_reason(self, recommendation_data: dict) -> str:
        """
        Generate alasan rekomendasi singkat.

        Args:
            recommendation_data: Dict berisi skor dan detail

        Returns:
            String alasan rekomendasi
        """
        score = recommendation_data.get('recommendation_score', 0)
        priority = recommendation_data.get('priority_label', '')
        delivery_day = recommendation_data.get('recommended_delivery_day', '')
        cutoff = recommendation_data.get('cut_off_jam', '')
        driver = recommendation_data.get('recommended_driver', '')

        reasons = []

        # Reason berdasarkan priority
        if priority == 'Tinggi':
            reasons.append('memiliki prioritas tinggi')
        elif priority == 'Sedang':
            reasons.append('memiliki prioritas sedang')

        # Reason berdasarkan cutoff
        try:
            hour = int(cutoff.split(':')[0])
        except (ValueError, AttributeError, IndexError):
            hour = 12

        if hour <= 10:
            reasons.append(f'cut-off sangat ketat ({cutoff})')
        elif hour <= 12:
            reasons.append(f'cut-off cukup dekat ({cutoff})')

        # Reason berdasarkan delivery day
        if delivery_day == 'Kirim Hari Ini':
            action = 'direkomendasikan dikirim hari ini'
        elif delivery_day == 'Kirim Besok':
            action = 'direkomendasikan dikirim besok'
        else:
            action = 'perlu dijadwalkan ulang'

        if reasons:
            reason_text = ', '.join(reasons)
            return f'Invoice {action} karena {reason_text}, dan driver {driver} tersedia pada area yang sesuai.'
        else:
            return f'Invoice {action}. Driver {driver} dipilih berdasarkan skor SAW tertinggi.'

    def generate_operational_notes(
        self,
        constraints_result: dict = None,
        driver_data: dict = None,
    ) -> list:
        """
        Generate catatan operasional berdasarkan constraint dan driver.

        Args:
            constraints_result: Hasil check_constraints dari ranking engine
            driver_data: Data driver yang dipilih

        Returns:
            List of string operational notes
        """
        notes = []

        if constraints_result:
            violations = constraints_result.get('violations', [])
            for v in violations:
                notes.append(f'⚠️ {v}')

        if driver_data:
            workload = driver_data.get('workload', 0)
            if workload >= 6:
                notes.append(
                    f'⚠️ Driver memiliki beban kerja tinggi ({workload} tugas aktif). '
                    f'Pertimbangkan driver alternatif.'
                )

        if not notes:
            notes.append('✅ Semua constraint operasional terpenuhi.')

        return notes

    def generate_confidence_explanation(
        self,
        confidence_level: str,
        score: float,
    ) -> str:
        """
        Generate penjelasan tingkat kepercayaan rekomendasi.

        Args:
            confidence_level: 'High', 'Medium', atau 'Low'
            score: Skor rekomendasi (0.0 - 1.0)

        Returns:
            String penjelasan confidence
        """
        explanations = {
            'High': (
                f'Tingkat kepercayaan tinggi (skor: {score:.2f}). '
                f'Sistem sangat yakin dengan rekomendasi ini karena '
                f'semua kriteria menunjukkan nilai yang baik.'
            ),
            'Medium': (
                f'Tingkat kepercayaan sedang (skor: {score:.2f}). '
                f'Beberapa kriteria menunjukkan nilai yang kurang optimal. '
                f'Pertimbangkan review manual sebelum eksekusi.'
            ),
            'Low': (
                f'Tingkat kepercayaan rendah (skor: {score:.2f}). '
                f'Banyak kriteria menunjukkan nilai rendah. '
                f'Disarankan untuk melakukan evaluasi manual.'
            ),
        }
        return explanations.get(confidence_level, explanations['Medium'])

    def get_recommendation_confidence(self, score: float) -> dict:
        """
        Tentukan level confidence berdasarkan skor.

        Rules:
            score ≥ 0.80 → High
            score ≥ 0.60 → Medium
            score < 0.60 → Low

        Args:
            score: Skor rekomendasi (0.0 - 1.0)

        Returns:
            Dict {level, score, explanation}
        """
        if score >= 0.80:
            level = 'High'
        elif score >= 0.60:
            level = 'Medium'
        else:
            level = 'Low'

        return {
            'level': level,
            'score': round(score, 4),
            'explanation': self.generate_confidence_explanation(level, score),
        }
