"""
recommendation_engine.py — SAW (Simple Additive Weighting) Recommendation Engine
=================================================================================

Modul ini mengimplementasikan metode Simple Additive Weighting (SAW) untuk
menghasilkan skor rekomendasi pengiriman invoice. SAW merupakan metode MCDM
(Multi Criteria Decision Making) yang menghitung preferensi berdasarkan
penjumlahan terbobot dari nilai kriteria yang telah dinormalisasi.

Formula Utama:
    Score = Σ(w_i × r_i)

Dimana:
    w_i = bobot kriteria ke-i
    r_i = nilai ternormalisasi kriteria ke-i (benefit: x_ij / max(x_j))

Kriteria dan Bobot:
    C1: priority_score     (w=0.40) — Tingkat prioritas dari C4.5
    C2: cut_off_urgency    (w=0.25) — Urgensi berdasarkan jam cut-off
    C3: area_match         (w=0.15) — Kecocokan area driver-invoice
    C4: driver_workload    (w=0.10) — Beban kerja driver saat ini
    C5: schedule_match     (w=0.10) — Kesesuaian jadwal penerimaan

Author: AI Module Team
"""

from datetime import datetime


# ─── Peta kedekatan area ─────────────────────────────────────────────
# Digunakan untuk menentukan apakah area driver "dekat" dengan area invoice
AREA_ADJACENCY = {
    'Jakarta Pusat':    ['Jakarta Selatan', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara'],
    'Jakarta Selatan':  ['Jakarta Pusat', 'Depok', 'Jakarta Timur'],
    'Jakarta Barat':    ['Jakarta Pusat', 'Tangerang', 'Jakarta Utara'],
    'Jakarta Timur':    ['Jakarta Pusat', 'Jakarta Selatan', 'Bekasi'],
    'Jakarta Utara':    ['Jakarta Pusat', 'Jakarta Barat'],
    'Bekasi':           ['Jakarta Timur', 'Karawang'],
    'Depok':            ['Jakarta Selatan', 'Bogor'],
    'Tangerang':        ['Jakarta Barat', 'Tangerang Selatan'],
    'Tangerang Selatan':['Tangerang', 'Jakarta Selatan', 'Depok'],
    'Bogor':            ['Depok'],
    'Karawang':         ['Bekasi'],
}

# ─── Peta hari pada jadwal ───────────────────────────────────────────
# Mapping jadwal ke hari-hari yang relevan (0=Senin, 6=Minggu)
SCHEDULE_DAY_MAP = {
    'Setiap Hari':      [0, 1, 2, 3, 4, 5, 6],
    'Senin-Jumat':      [0, 1, 2, 3, 4],
    'Senin-Kamis':      [0, 1, 2, 3],
    'Selasa-Kamis':     [1, 2, 3],
    'Rabu-Jumat':       [2, 3, 4],
    'Senin-Rabu':       [0, 1, 2],
    'Selasa-Jumat':     [1, 2, 3, 4],
    'Senin & Kamis':    [0, 3],
    'Selasa & Jumat':   [1, 4],
    'Senin saja':       [0],
}


class SAWRecommendationEngine:
    """
    Engine rekomendasi pengiriman menggunakan metode SAW
    (Simple Additive Weighting).

    Attributes:
        weights (dict): Bobot untuk setiap kriteria, total = 1.0
    """

    def __init__(self):
        """Inisialisasi bobot kriteria SAW."""
        self.weights = {
            'priority_score':    0.40,
            'cut_off_urgency':   0.25,
            'area_match':        0.15,
            'driver_workload':   0.10,
            'schedule_match':    0.10,
        }

    # ─── Perhitungan Skor Kriteria ─────────────────────────────────

    def calculate_priority_score(self, priority_label: str) -> float:
        """
        Hitung skor kriteria prioritas (C1).

        Mapping:
            Tinggi → 1.0  (prioritas tertinggi)
            Sedang → 0.7  (prioritas menengah)
            Rendah → 0.4  (prioritas rendah)

        Args:
            priority_label: Label prioritas dari C4.5 ('Tinggi'/'Sedang'/'Rendah')

        Returns:
            Skor prioritas (0.0 - 1.0)
        """
        mapping = {
            'Tinggi': 1.0,
            'Sedang': 0.7,
            'Rendah': 0.4,
        }
        return mapping.get(priority_label, 0.5)

    def calculate_cutoff_urgency(self, cut_off_jam: str) -> float:
        """
        Hitung skor urgensi cut-off (C2).

        Semakin dekat jam cut-off, semakin tinggi urgensinya.

        Mapping (jam sekarang vs cut-off):
            ≤ 2 jam  → 1.0  (sangat mendesak)
            ≤ 4 jam  → 0.8  (mendesak)
            ≤ 8 jam  → 0.6  (sedang)
            > 8 jam  → 0.3  (longgar)

        Pendekatan sederhana: gunakan jam cut-off langsung
            jam ≤ 10:00 → 1.0
            jam ≤ 12:00 → 0.8
            jam ≤ 14:00 → 0.6
            jam > 14:00 → 0.3

        Args:
            cut_off_jam: Jam cut-off dalam format "HH:MM"

        Returns:
            Skor urgensi (0.0 - 1.0)
        """
        try:
            hour = int(cut_off_jam.split(':')[0])
        except (ValueError, AttributeError, IndexError):
            hour = 12  # default tengah hari

        if hour <= 10:
            return 1.0
        elif hour <= 12:
            return 0.8
        elif hour <= 14:
            return 0.6
        else:
            return 0.3

    def calculate_area_match(self, driver_area: str, invoice_area: str) -> float:
        """
        Hitung skor kecocokan area (C3).

        Mapping:
            Area sama persis         → 1.0
            Area terdekat/adjacent   → 0.7
            Area tidak cocok         → 0.4

        Args:
            driver_area:  Area kerja driver (bisa multi, dipisah koma)
            invoice_area: Area pengantaran invoice

        Returns:
            Skor kecocokan area (0.0 - 1.0)
        """
        if not driver_area or not invoice_area:
            return 0.4

        # Parse area driver (bisa berisi multiple area: "Bogor, Jakarta Selatan")
        driver_areas = [a.strip() for a in driver_area.split(',')]

        # Exact match — area invoice ada di list area driver
        if invoice_area in driver_areas:
            return 1.0

        # Adjacent match — area invoice bertetangga dengan salah satu area driver
        adjacent = AREA_ADJACENCY.get(invoice_area, [])
        for d_area in driver_areas:
            if d_area in adjacent:
                return 0.7

        # No match
        return 0.4

    def calculate_driver_workload(self, workload_count: int) -> float:
        """
        Hitung skor beban kerja driver (C4).

        Semakin rendah beban, semakin baik (driver lebih available).
        Ini adalah benefit criteria: workload rendah = skor tinggi.

        Mapping:
            0–3 invoice aktif → 1.0  (beban rendah)
            4–6 invoice aktif → 0.7  (beban sedang)
            > 6 invoice aktif → 0.4  (beban tinggi)

        Args:
            workload_count: Jumlah invoice aktif yang ditangani driver

        Returns:
            Skor workload (0.0 - 1.0)
        """
        if workload_count <= 3:
            return 1.0
        elif workload_count <= 6:
            return 0.7
        else:
            return 0.4

    def calculate_schedule_match(self, jadwal_terima: str) -> float:
        """
        Hitung skor kesesuaian jadwal penerimaan (C5).

        Mengecek apakah hari ini termasuk dalam jadwal penerimaan customer.

        Mapping:
            Hari ini sesuai jadwal → 1.0
            Besok sesuai jadwal    → 0.7
            Tidak sesuai           → 0.3

        Args:
            jadwal_terima: Jadwal penerimaan customer (e.g. "Senin & Kamis")

        Returns:
            Skor kesesuaian jadwal (0.0 - 1.0)
        """
        today = datetime.now().weekday()  # 0=Senin, 6=Minggu
        tomorrow = (today + 1) % 7

        schedule_days = SCHEDULE_DAY_MAP.get(jadwal_terima, [0, 1, 2, 3, 4])

        if today in schedule_days:
            return 1.0
        elif tomorrow in schedule_days:
            return 0.7
        else:
            return 0.3

    # ─── Kalkulasi SAW ─────────────────────────────────────────────

    def calculate_saw_score(self, criteria_scores: dict) -> dict:
        """
        Hitung skor akhir SAW dengan normalisasi benefit-type.

        Langkah-langkah SAW:
        1. Hitung raw scores per kriteria
        2. Normalisasi: r_ij = x_ij / max(x_j)
           (Untuk kasus single alternative, max = 1.0 karena
            skor sudah dalam skala 0-1)
        3. Hitung weighted score: V_i = Σ(w_j × r_ij)

        Args:
            criteria_scores: Dict {criteria_name: raw_score}

        Returns:
            Dict berisi score_details per kriteria dan final_score
        """
        max_score = 1.0  # Skor maksimum untuk semua kriteria (benefit-type)
        score_details = {}
        final_score = 0.0

        for criterion, raw in criteria_scores.items():
            weight = self.weights.get(criterion, 0)
            # Normalisasi benefit: r = x / max(x)
            normalized = raw / max_score if max_score > 0 else 0
            weighted = weight * normalized
            final_score += weighted

            score_details[criterion] = {
                'raw': round(raw, 4),
                'normalized': round(normalized, 4),
                'weighted': round(weighted, 4),
                'weight': weight,
            }

        return {
            'score_details': score_details,
            'final_score': round(final_score, 4),
        }

    def get_delivery_day(self, score: float) -> str:
        """
        Tentukan rekomendasi hari pengiriman berdasarkan skor SAW.

        Rules:
            score ≥ 0.80 → "Kirim Hari Ini"  (prioritas tinggi, urgent)
            score ≥ 0.60 → "Kirim Besok"      (bisa ditunda 1 hari)
            score < 0.60 → "Jadwalkan Ulang"   (perlu dijadwalkan ulang)

        Args:
            score: Skor SAW akhir (0.0 - 1.0)

        Returns:
            String rekomendasi hari pengiriman
        """
        if score >= 0.80:
            return 'Kirim Hari Ini'
        elif score >= 0.60:
            return 'Kirim Besok'
        else:
            return 'Jadwalkan Ulang'

    def get_recommendation(
        self,
        priority_label: str,
        area_pengantaran: str,
        jadwal_terima: str,
        cut_off_jam: str,
        driver_area: str,
        driver_workload: int,
    ) -> dict:
        """
        Generate rekomendasi lengkap untuk satu pasangan invoice-driver.

        Args:
            priority_label:   Label prioritas dari C4.5
            area_pengantaran: Area tujuan pengiriman invoice
            jadwal_terima:    Jadwal penerimaan customer
            cut_off_jam:      Batas waktu penerimaan
            driver_area:      Area kerja driver
            driver_workload:  Jumlah invoice aktif driver

        Returns:
            Dict dengan recommendation_score, score_details, dan delivery_day
        """
        # Step 1: Hitung raw score tiap kriteria
        criteria_scores = {
            'priority_score':    self.calculate_priority_score(priority_label),
            'cut_off_urgency':   self.calculate_cutoff_urgency(cut_off_jam),
            'area_match':        self.calculate_area_match(driver_area, area_pengantaran),
            'driver_workload':   self.calculate_driver_workload(driver_workload),
            'schedule_match':    self.calculate_schedule_match(jadwal_terima),
        }

        # Step 2 & 3: Normalisasi dan hitung SAW score
        saw_result = self.calculate_saw_score(criteria_scores)

        # Step 4: Tentukan hari pengiriman
        final_score = saw_result['final_score']
        delivery_day = self.get_delivery_day(final_score)

        return {
            'recommendation_score': final_score,
            'recommended_delivery_day': delivery_day,
            'score_details': saw_result['score_details'],
        }
