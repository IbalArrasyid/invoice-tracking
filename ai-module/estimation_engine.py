"""
estimation_engine.py — Delivery Time Estimation Engine
=======================================================

Modul ini menghitung estimasi waktu pengiriman berdasarkan tiga faktor:

Estimated_Time = Base_Area_Time + Workload_Factor + Traffic_Adjustment

Komponen:
    1. Base_Area_Time:     Waktu dasar berdasarkan area tujuan
    2. Workload_Factor:    Penambahan waktu karena beban kerja driver
    3. Traffic_Adjustment: Penambahan waktu karena jam sibuk

Author: AI Module Team
"""

from datetime import datetime


# ─── Waktu dasar per area (dalam menit) ───────────────────────────
BASE_AREA_TIMES = {
    'Jakarta Pusat':     45,
    'Jakarta Selatan':   60,
    'Jakarta Barat':     75,
    'Jakarta Timur':     60,
    'Jakarta Utara':     75,
    'Bekasi':           120,
    'Depok':             90,
    'Tangerang':         90,
    'Tangerang Selatan': 105,
    'Bogor':            180,
    'Karawang':         150,
}

# ─── Rentang jam sibuk (peak hours) ──────────────────────────────
PEAK_HOURS = [
    (7, 9),    # Pagi: 07:00 - 09:00
    (16, 19),  # Sore: 16:00 - 19:00
]


class DeliveryEstimationEngine:
    """
    Engine untuk menghitung estimasi waktu pengiriman invoice.

    Formula:
        Estimated_Time = Base_Area_Time + Workload_Factor + Traffic_Adjustment
    """

    def get_base_time(self, area: str) -> int:
        """
        Dapatkan waktu dasar pengiriman berdasarkan area tujuan.

        Args:
            area: Nama area pengantaran

        Returns:
            Waktu dasar dalam menit
        """
        return BASE_AREA_TIMES.get(area, 90)  # Default 90 menit

    def get_workload_factor(self, workload_count: int) -> int:
        """
        Hitung faktor penambahan waktu berdasarkan beban kerja driver.

        Rules:
            Low  (0-3 tugas) →  +0 menit
            Med  (4-6 tugas) → +30 menit
            High (>6  tugas) → +60 menit

        Args:
            workload_count: Jumlah invoice aktif driver

        Returns:
            Penambahan waktu dalam menit
        """
        if workload_count <= 3:
            return 0
        elif workload_count <= 6:
            return 30
        else:
            return 60

    def get_workload_level(self, workload_count: int) -> str:
        """
        Tentukan level beban kerja.

        Args:
            workload_count: Jumlah invoice aktif

        Returns:
            String level: 'Rendah', 'Sedang', 'Tinggi'
        """
        if workload_count <= 3:
            return 'Rendah'
        elif workload_count <= 6:
            return 'Sedang'
        else:
            return 'Tinggi'

    def get_traffic_adjustment(self, current_hour: int = None) -> int:
        """
        Hitung penyesuaian waktu berdasarkan kondisi lalu lintas.

        Peak hours (jam sibuk):
            07:00 - 09:00 → +30 menit
            16:00 - 19:00 → +30 menit
        Normal hours       → +0  menit

        Args:
            current_hour: Jam saat ini (0-23). Jika None, gunakan jam aktual.

        Returns:
            Penambahan waktu dalam menit
        """
        if current_hour is None:
            current_hour = datetime.now().hour

        for start, end in PEAK_HOURS:
            if start <= current_hour < end:
                return 30

        return 0

    def is_peak_hour(self, current_hour: int = None) -> bool:
        """Cek apakah jam saat ini termasuk peak hour."""
        if current_hour is None:
            current_hour = datetime.now().hour

        for start, end in PEAK_HOURS:
            if start <= current_hour < end:
                return True
        return False

    def estimate_delivery_time(
        self,
        area: str,
        workload_count: int,
        current_hour: int = None,
    ) -> dict:
        """
        Hitung estimasi waktu pengiriman lengkap.

        Formula: Estimated_Time = Base + Workload_Factor + Traffic_Adj

        Args:
            area: Area tujuan pengantaran
            workload_count: Jumlah invoice aktif driver
            current_hour: Jam saat ini (opsional)

        Returns:
            Dict berisi total, formatted, dan breakdown
        """
        base_time = self.get_base_time(area)
        workload_factor = self.get_workload_factor(workload_count)
        traffic_adj = self.get_traffic_adjustment(current_hour)

        total_minutes = base_time + workload_factor + traffic_adj

        return {
            'total_minutes': total_minutes,
            'formatted': self.format_time(total_minutes),
            'breakdown': {
                'base_area_time': base_time,
                'workload_factor': workload_factor,
                'traffic_adjustment': traffic_adj,
                'workload_level': self.get_workload_level(workload_count),
                'is_peak_hour': self.is_peak_hour(current_hour),
                'area': area,
            },
        }

    @staticmethod
    def format_time(minutes: int) -> str:
        """
        Format menit ke string yang human-readable.

        Examples:
            60  → "1 Jam"
            90  → "1 Jam 30 Menit"
            135 → "2 Jam 15 Menit"
            30  → "30 Menit"

        Args:
            minutes: Total waktu dalam menit

        Returns:
            String waktu terformat (Bahasa Indonesia)
        """
        if minutes <= 0:
            return "0 Menit"

        hours = minutes // 60
        mins = minutes % 60

        if hours > 0 and mins > 0:
            return f"{hours} Jam {mins} Menit"
        elif hours > 0:
            return f"{hours} Jam"
        else:
            return f"{mins} Menit"
