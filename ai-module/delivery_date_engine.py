"""
delivery_date_engine.py — Delivery Date Recommendation Engine
==============================================================

Engine rekomendasi tanggal pengiriman berbasis kalender yang menghasilkan
tanggal SPESIFIK (bukan label samar seperti 'Kirim Besok').

Arsitektur:
    ┌──────────────────────────────────────────────┐
    │  DeliveryDateRecommendationEngine            │
    │  ├─ recommend()          → single invoice    │
    │  ├─ batch_recommend()    → multiple invoices │
    │  └─ generate_explanation()→ human-readable   │
    ├──────────────────────────────────────────────┤
    │  PriorityScoringEngine                       │
    │  └─ compute_score()      → 3-criteria SAW    │
    └──────────────────────────────────────────────┘

Dependencies:
    - constraint_model.py (CustomerConstraint, CustomerConstraintModel,
      DeliveryWindow, CutoffParser, ScheduleParser, ReceivingTimeParser)

Perbedaan dengan recommendation_engine.py (SAW lama):
    - Output: tanggal kalender spesifik vs label 'Kirim Hari Ini'
    - Validasi: 14-hari scan dengan filter jadwal + cutoff
    - Urgency: deteksi CRITICAL jika cutoff < 3 hari tanpa slot valid
    - Scoring: 3 kriteria (vs 5 kriteria lama, area & workload dihapus)

Author: AI Module Team
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from constraint_model import (
    CustomerConstraint,
    CustomerConstraintModel,
    DeliveryWindow,
)

logger = logging.getLogger(__name__)

# ─── Konstanta nama hari & bulan (Bahasa Indonesia) ──────────────
HARI_INDONESIA: Dict[str, str] = {
    'Monday':    'Senin',
    'Tuesday':   'Selasa',
    'Wednesday': 'Rabu',
    'Thursday':  'Kamis',
    'Friday':    'Jumat',
    'Saturday':  'Sabtu',
    'Sunday':    'Minggu',
}

BULAN_INDONESIA: Dict[int, str] = {
    1:  'Januari',
    2:  'Februari',
    3:  'Maret',
    4:  'April',
    5:  'Mei',
    6:  'Juni',
    7:  'Juli',
    8:  'Agustus',
    9:  'September',
    10: 'Oktober',
    11: 'November',
    12: 'Desember',
}

# ─── Urgency level thresholds ───────────────────────────────────
URGENCY_CRITICAL_DAYS: int = 3   # Cutoff ≤ 3 hari → CRITICAL
URGENCY_WARNING_DAYS: int = 7    # Cutoff ≤ 7 hari → WARNING

# ─── Default jumlah alternatif yang ditampilkan ─────────────────
DEFAULT_ALTERNATIVES_COUNT: int = 2


# ═══════════════════════════════════════════════════════════════════
#  Helper Functions
# ═══════════════════════════════════════════════════════════════════

def format_date_indonesian(d: date) -> str:
    """Format tanggal ke format Indonesia: 'Selasa, 17 Juni 2026'.

    Args:
        d: Objek ``date`` yang akan diformat.

    Returns:
        String tanggal dalam Bahasa Indonesia lengkap dengan nama hari.

    Examples:
        >>> from datetime import date
        >>> format_date_indonesian(date(2026, 6, 17))
        'Selasa, 17 Juni 2026'
        >>> format_date_indonesian(date(2026, 1, 5))
        'Senin, 5 Januari 2026'
    """
    day_name_en: str = d.strftime('%A')
    day_name_id: str = HARI_INDONESIA.get(day_name_en, day_name_en)
    month_name_id: str = BULAN_INDONESIA.get(d.month, str(d.month))
    return f"{day_name_id}, {d.day} {month_name_id} {d.year}"


def format_date_with_time(d: date, time_start: str, time_end: str) -> str:
    """Format tanggal + rentang waktu: 'Selasa, 17 Juni 2026 (09:00-15:00)'.

    Args:
        d: Objek ``date``.
        time_start: Jam mulai penerimaan (format ``HH:MM``).
        time_end: Jam akhir penerimaan (format ``HH:MM``).

    Returns:
        String tanggal lengkap dengan waktu penerimaan.
    """
    date_str: str = format_date_indonesian(d)
    return f"{date_str} ({time_start}-{time_end})"


def get_hari_indonesia(d: date) -> str:
    """Dapatkan nama hari Indonesia dari objek ``date``.

    Args:
        d: Objek ``date``.

    Returns:
        Nama hari dalam Bahasa Indonesia (e.g. 'Senin', 'Selasa').
    """
    return HARI_INDONESIA.get(d.strftime('%A'), d.strftime('%A'))


def _determine_urgency_level(
    days_until_cutoff: Optional[int],
    has_valid_window_before_cutoff: bool,
) -> str:
    """Tentukan level urgensi berdasarkan sisa hari ke cutoff.

    Logic:
        - ``None`` (no cutoff)                         → ``'NO_CUTOFF'``
        - Cutoff sudah lewat (< 0)                     → ``'EXPIRED'``
        - ≤ 3 hari DAN tidak ada slot sebelum cutoff   → ``'CRITICAL'``
        - ≤ 3 hari TAPI masih ada slot                 → ``'WARNING'``
        - ≤ 7 hari                                     → ``'WARNING'``
        - > 7 hari                                     → ``'NORMAL'``

    Args:
        days_until_cutoff: Jumlah hari tersisa sampai cutoff, ``None``
            jika customer tidak punya cutoff.
        has_valid_window_before_cutoff: Apakah ada delivery window valid
            sebelum tanggal cutoff.

    Returns:
        String urgency level.
    """
    if days_until_cutoff is None:
        return 'NO_CUTOFF'

    if days_until_cutoff < 0:
        return 'EXPIRED'

    if days_until_cutoff <= URGENCY_CRITICAL_DAYS:
        if not has_valid_window_before_cutoff:
            return 'CRITICAL'
        return 'WARNING'

    if days_until_cutoff <= URGENCY_WARNING_DAYS:
        return 'WARNING'

    return 'NORMAL'


def _generate_alerts(
    urgency_level: str,
    days_until_cutoff: Optional[int],
    recommended_window: Optional[DeliveryWindow],
    cutoff_deadline: Optional[date],
    constraint: CustomerConstraint,
) -> List[str]:
    """Generate daftar alert/peringatan berdasarkan situasi pengiriman.

    Alerts dihasilkan untuk kondisi-kondisi berikut:
        - Cutoff EXPIRED → peringatan bahwa cutoff sudah lewat
        - Cutoff CRITICAL → peringatan urgent
        - Cutoff WARNING → peringatan hari tersisa
        - Rekomendasi melewati cutoff → note bahwa pengiriman di bulan berikutnya
        - No valid window ditemukan → tidak ada slot tersedia

    Args:
        urgency_level: Level urgensi dari ``_determine_urgency_level()``.
        days_until_cutoff: Sisa hari ke cutoff.
        recommended_window: Window pengiriman yang direkomendasikan.
        cutoff_deadline: Tanggal deadline cutoff.
        constraint: Data constraint customer.

    Returns:
        List string pesan peringatan dalam Bahasa Indonesia.
    """
    alerts: List[str] = []

    if urgency_level == 'EXPIRED':
        alerts.append(
            f"⚠️ CUTOFF LEWAT: Batas cutoff ({constraint.cutoff_rule}) sudah "
            f"terlewat. Rekomendasi menggunakan periode cutoff berikutnya."
        )

    elif urgency_level == 'CRITICAL':
        alerts.append(
            f"🔴 KRITIS: Hanya tersisa {days_until_cutoff} hari sebelum cutoff "
            f"({constraint.cutoff_rule}) dan tidak ada tanggal pengiriman valid "
            f"sebelum deadline. Segera koordinasi dengan customer."
        )

    elif urgency_level == 'WARNING':
        alerts.append(
            f"🟡 PERHATIAN: Cutoff dalam {days_until_cutoff} hari "
            f"({constraint.cutoff_rule}). Pastikan pengiriman dilakukan tepat waktu."
        )

    # Alert jika rekomendasi melewati cutoff deadline
    if (recommended_window is not None
            and cutoff_deadline is not None
            and recommended_window.date > cutoff_deadline):
        alerts.append(
            f"📅 Tanggal pengiriman yang direkomendasikan "
            f"({format_date_indonesian(recommended_window.date)}) melewati "
            f"batas cutoff ({format_date_indonesian(cutoff_deadline)}). "
            f"Invoice akan masuk periode cutoff berikutnya."
        )

    # Alert jika tidak ada window sama sekali
    if recommended_window is None:
        alerts.append(
            "❌ Tidak ditemukan tanggal pengiriman valid dalam 14 hari ke depan. "
            "Periksa kembali jadwal penerimaan dan constraint customer."
        )

    return alerts


def _build_constraint_summary(constraint: CustomerConstraint) -> Dict[str, str]:
    """Buat ringkasan constraint yang human-readable.

    Args:
        constraint: Data constraint customer.

    Returns:
        Dict dengan key deskriptif dan value berupa string penjelasan.
    """
    return {
        'customer': constraint.customer_name,
        'cutoff': constraint.cutoff_rule,
        'jadwal_penerimaan': constraint.day_schedule,
        'waktu_terima': constraint.receiving_time,
        'lokasi': constraint.location,
        'jenis_kurir': constraint.courier_type,
    }


def _determine_courier_channel(constraint: CustomerConstraint) -> str:
    """Tentukan channel kurir berdasarkan constraint.

    Logic sederhana:
        - Jika ``courier_type`` mengandung 'selog' (case-insensitive) → ``'SELOG'``
        - Selainnya → ``'DRIVER'``

    Args:
        constraint: Data constraint customer.

    Returns:
        ``'DRIVER'`` atau ``'SELOG'``.
    """
    courier_raw: str = (constraint.courier_type or '').strip().lower()
    if 'selog' in courier_raw:
        return 'SELOG'
    return 'DRIVER'


# ═══════════════════════════════════════════════════════════════════
#  DeliveryDateRecommendationEngine
# ═══════════════════════════════════════════════════════════════════

class DeliveryDateRecommendationEngine:
    """Engine rekomendasi tanggal pengiriman berbasis kalender.

    Berbeda dengan pendekatan sebelumnya yang hanya memetakan skor ke label
    ('Kirim Hari Ini' / 'Kirim Besok' / 'Jadwalkan Ulang'), engine ini
    menghasilkan tanggal pengiriman SPESIFIK yang telah divalidasi terhadap
    seluruh kendala pelanggan.

    Proses:
        1. Muat kendala pelanggan (cutoff, jadwal, waktu terima)
        2. Scan 14 hari ke depan dari hari ini
        3. Filter berdasarkan jadwal penerimaan (``day_schedule``)
        4. Filter berdasarkan batas cutoff
        5. Return tanggal valid terdekat + alternatif

    Attributes:
        constraint_model: Instance ``CustomerConstraintModel`` untuk
            mendapatkan delivery windows yang valid.
        max_scan_days: Jumlah hari ke depan yang di-scan (default 14).

    Examples:
        >>> engine = DeliveryDateRecommendationEngine()
        >>> constraint = CustomerConstraint(
        ...     customer_name='PT Astra',
        ...     cutoff_rule='Tanggal 25',
        ...     day_schedule='Selasa & Kamis',
        ...     receiving_time='09:00-15:00',
        ...     location='KIM',
        ...     courier_type='Driver',
        ... )
        >>> result = engine.recommend(constraint)
        >>> print(result['recommended'].date)
        # Output: tanggal Selasa/Kamis terdekat
    """

    def __init__(self) -> None:
        """Inisialisasi engine dengan ``CustomerConstraintModel``."""
        self.constraint_model: CustomerConstraintModel = CustomerConstraintModel()
        self.max_scan_days: int = 14

    # ─── Core Recommendation ─────────────────────────────────────

    def recommend(
        self,
        constraint: CustomerConstraint,
        from_date: Optional[date] = None,
    ) -> Dict:
        """Generate rekomendasi tanggal pengiriman.

        Proses:
            1. Dapatkan semua delivery windows valid dari ``constraint_model``
            2. Hitung ``cutoff_deadline`` dan ``days_until_cutoff``
            3. Cek apakah ada window sebelum cutoff
            4. Tentukan urgency level
            5. Pilih window terbaik (terdekat) sebagai rekomendasi
            6. Siapkan alternatif (2 opsi berikutnya)
            7. Generate alerts

        Args:
            constraint: Data kendala pelanggan (cutoff, jadwal, waktu
                terima, lokasi, tipe kurir).
            from_date: Tanggal awal scan. Jika ``None``, gunakan hari ini.

        Returns:
            Dict berisi:
                - ``recommended``: ``DeliveryWindow`` — tanggal terbaik
                - ``alternatives``: ``List[DeliveryWindow]`` — 2 opsi lain
                - ``cutoff_deadline``: ``Optional[date]`` — tanggal batas cutoff
                - ``days_until_cutoff``: ``Optional[int]`` — sisa hari ke cutoff
                - ``urgency_level``: ``str`` — 'CRITICAL'/'WARNING'/'NORMAL'/'NO_CUTOFF'/'EXPIRED'
                - ``alerts``: ``List[str]`` — pesan peringatan
                - ``constraint_summary``: ``dict`` — ringkasan constraint
                - ``courier_channel``: ``str`` — 'DRIVER' atau 'SELOG'
                - ``formatted_recommendation``: ``str`` — tanggal terformat
                - ``total_valid_windows``: ``int`` — jumlah total window valid
        """
        if from_date is None:
            from_date = date.today()

        # --- Step 1: Dapatkan semua delivery windows valid ---
        valid_windows: List[DeliveryWindow] = (
            self.constraint_model.get_valid_delivery_windows(
                constraint=constraint,
                from_date=from_date,
                max_days=self.max_scan_days,
            )
        )

        # --- Step 2: Hitung cutoff deadline & days remaining ---
        cutoff_deadline: Optional[date] = self._resolve_cutoff_deadline(
            constraint.cutoff_rule, from_date
        )
        days_until_cutoff: Optional[int] = None
        if cutoff_deadline is not None:
            days_until_cutoff = (cutoff_deadline - from_date).days

        # --- Step 3: Cek apakah ada window sebelum cutoff ---
        has_valid_before_cutoff: bool = self._has_window_before_cutoff(
            valid_windows, cutoff_deadline
        )

        # --- Step 4: Tentukan urgency level ---
        urgency_level: str = _determine_urgency_level(
            days_until_cutoff, has_valid_before_cutoff
        )

        # --- Step 5: Pilih rekomendasi terbaik (window terdekat) ---
        recommended: Optional[DeliveryWindow] = None
        alternatives: List[DeliveryWindow] = []

        if valid_windows:
            recommended = valid_windows[0]
            alternatives = valid_windows[1:1 + DEFAULT_ALTERNATIVES_COUNT]

        # --- Step 6: Generate alerts ---
        alerts: List[str] = _generate_alerts(
            urgency_level=urgency_level,
            days_until_cutoff=days_until_cutoff,
            recommended_window=recommended,
            cutoff_deadline=cutoff_deadline,
            constraint=constraint,
        )

        # --- Step 7: Format output ---
        formatted_recommendation: str = ''
        if recommended is not None:
            formatted_recommendation = format_date_with_time(
                recommended.date,
                recommended.time_start,
                recommended.time_end,
            )

        courier_channel: str = _determine_courier_channel(constraint)

        return {
            'recommended': recommended,
            'alternatives': alternatives,
            'cutoff_deadline': cutoff_deadline,
            'days_until_cutoff': days_until_cutoff,
            'urgency_level': urgency_level,
            'alerts': alerts,
            'constraint_summary': _build_constraint_summary(constraint),
            'courier_channel': courier_channel,
            'formatted_recommendation': formatted_recommendation,
            'total_valid_windows': len(valid_windows),
        }

    # ─── Explanation Generator ───────────────────────────────────

    def generate_explanation(self, result: Dict) -> str:
        """Generate penjelasan rekomendasi dalam Bahasa Indonesia.

        Menghasilkan paragraf naratif yang menjelaskan:
            - Tanggal yang direkomendasikan
            - Jadwal penerimaan customer
            - Status cutoff dan sisa hari
            - Channel pengiriman (DRIVER/SELOG)
            - Alert jika ada

        Args:
            result: Dict output dari method ``recommend()``.

        Returns:
            String penjelasan multi-kalimat dalam Bahasa Indonesia.

        Examples:
            >>> explanation = engine.generate_explanation(result)
            >>> print(explanation)
            'Tanggal pengiriman yang direkomendasikan adalah Selasa, 17 Juni 2026
             pukul 09:00-15:00. Customer menerima invoice pada hari Selasa & Kamis.
             Batas cutoff: tanggal 25 (11 hari lagi). Pengiriman via DRIVER.'
        """
        parts: List[str] = []
        recommended: Optional[DeliveryWindow] = result.get('recommended')
        constraint_summary: Dict = result.get('constraint_summary', {})
        days_until_cutoff: Optional[int] = result.get('days_until_cutoff')
        urgency_level: str = result.get('urgency_level', 'NORMAL')
        courier_channel: str = result.get('courier_channel', 'DRIVER')

        # --- Kalimat 1: Tanggal rekomendasi ---
        if recommended is not None:
            date_str: str = format_date_indonesian(recommended.date)
            parts.append(
                f"Tanggal pengiriman yang direkomendasikan adalah {date_str} "
                f"pukul {recommended.time_start}-{recommended.time_end}."
            )

            # Indikator hari ini / besok
            if recommended.is_today:
                parts.append("Pengiriman bisa dilakukan HARI INI.")
            elif recommended.is_tomorrow:
                parts.append("Pengiriman bisa dilakukan BESOK.")
        else:
            parts.append(
                "Tidak ditemukan tanggal pengiriman valid dalam 14 hari ke depan."
            )

        # --- Kalimat 2: Jadwal penerimaan ---
        jadwal: str = constraint_summary.get('jadwal_penerimaan', '')
        if jadwal:
            parts.append(
                f"Customer menerima invoice pada hari {jadwal}."
            )

        # --- Kalimat 3: Status cutoff ---
        cutoff_rule: str = constraint_summary.get('cutoff', '')
        if cutoff_rule and days_until_cutoff is not None:
            if urgency_level == 'EXPIRED':
                parts.append(
                    f"Batas cutoff ({cutoff_rule}) sudah terlewat."
                )
            else:
                parts.append(
                    f"Batas cutoff: {cutoff_rule} ({days_until_cutoff} hari lagi)."
                )
        elif cutoff_rule:
            parts.append(f"Cutoff: {cutoff_rule} (tidak ada batas tanggal).")

        # --- Kalimat 4: Channel pengiriman ---
        parts.append(f"Pengiriman via {courier_channel}.")

        # --- Kalimat 5: Alternatif (jika ada) ---
        alternatives: List[DeliveryWindow] = result.get('alternatives', [])
        if alternatives:
            alt_strings: List[str] = [
                format_date_indonesian(w.date) for w in alternatives
            ]
            parts.append(
                f"Alternatif: {', '.join(alt_strings)}."
            )

        # --- Kalimat 6: Alerts ---
        alerts: List[str] = result.get('alerts', [])
        for alert in alerts:
            parts.append(alert)

        return ' '.join(parts)

    # ─── Batch Recommendation ────────────────────────────────────

    def batch_recommend(
        self,
        constraints: List[CustomerConstraint],
        from_date: Optional[date] = None,
    ) -> List[Dict]:
        """Generate rekomendasi untuk multiple invoices sekaligus.

        Memproses setiap constraint secara sekuensial dan mengumpulkan
        hasilnya. Setiap item di output list memiliki format yang sama
        dengan output ``recommend()``, ditambah field ``customer_name``.

        Args:
            constraints: List of ``CustomerConstraint`` untuk diproses.
            from_date: Tanggal awal scan (shared untuk semua invoice).
                Jika ``None``, gunakan hari ini.

        Returns:
            List of dict, masing-masing berisi rekomendasi lengkap
            dengan tambahan key ``customer_name`` untuk identifikasi.
        """
        if from_date is None:
            from_date = date.today()

        results: List[Dict] = []

        for constraint in constraints:
            try:
                result: Dict = self.recommend(constraint, from_date)
                result['customer_name'] = constraint.customer_name
                results.append(result)
            except Exception as exc:
                logger.error(
                    "Gagal generate rekomendasi untuk %s: %s",
                    constraint.customer_name,
                    exc,
                )
                results.append({
                    'customer_name': constraint.customer_name,
                    'recommended': None,
                    'alternatives': [],
                    'cutoff_deadline': None,
                    'days_until_cutoff': None,
                    'urgency_level': 'ERROR',
                    'alerts': [
                        f"❌ Error saat memproses: {exc}"
                    ],
                    'constraint_summary': _build_constraint_summary(constraint),
                    'courier_channel': _determine_courier_channel(constraint),
                    'formatted_recommendation': '',
                    'total_valid_windows': 0,
                })

        return results

    # ─── Internal Helpers ────────────────────────────────────────

    def _resolve_cutoff_deadline(
        self,
        cutoff_rule: str,
        from_date: date,
    ) -> Optional[date]:
        """Resolve cutoff rule ke tanggal deadline konkret.

        Parsing aturan cutoff yang umum ditemui di data operasional:
            - ``'Tanggal 25'`` / ``'Tgl 25'`` / ``'25'``
                → tanggal 25 bulan ini (atau bulan depan jika sudah lewat)
            - ``'No cut off'`` / ``'Tidak ada'`` / ``''``
                → ``None`` (tidak ada batas)
            - ``'H+3'`` / ``'H+5'``
                → hari ini + N hari
            - ``'Akhir bulan'`` / ``'End of month'``
                → hari terakhir bulan ini
            - Angka langsung: ``'25'``
                → tanggal 25

        Args:
            cutoff_rule: String aturan cutoff dari data customer.
            from_date: Tanggal referensi (biasanya hari ini).

        Returns:
            ``date`` deadline cutoff, atau ``None`` jika tidak ada cutoff.
        """
        if not cutoff_rule:
            return None

        rule_lower: str = cutoff_rule.strip().lower()

        # --- Tidak ada cutoff ---
        no_cutoff_keywords = [
            'no cut off', 'no cutoff', 'tidak ada', 'none', 'n/a', '-',
            'no cut-off', 'bebas', 'fleksibel',
        ]
        if rule_lower in no_cutoff_keywords:
            return None

        # --- Akhir bulan ---
        if rule_lower in ('akhir bulan', 'end of month', 'eom'):
            return self._end_of_month(from_date)

        # --- H+N format (e.g. 'H+3', 'h+5') ---
        if rule_lower.startswith('h+'):
            try:
                n_days: int = int(rule_lower[2:])
                return from_date + timedelta(days=n_days)
            except ValueError:
                pass

        # --- Tanggal N (e.g. 'Tanggal 25', 'Tgl 25', 'tgl. 20', '25') ---
        day_number: Optional[int] = self._extract_day_number(cutoff_rule)
        if day_number is not None:
            return self._resolve_day_in_month(day_number, from_date)

        # Fallback: tidak bisa parse → anggap tidak ada cutoff
        logger.warning(
            "Tidak dapat parse cutoff rule: '%s', anggap tidak ada cutoff",
            cutoff_rule,
        )
        return None

    @staticmethod
    def _extract_day_number(cutoff_rule: str) -> Optional[int]:
        """Extract angka tanggal dari string cutoff rule.

        Mendukung format:
            - ``'Tanggal 25'``
            - ``'Tgl 25'``
            - ``'Tgl. 20'``
            - ``'25'``
            - ``'tanggal 5'``

        Args:
            cutoff_rule: String aturan cutoff.

        Returns:
            Integer tanggal (1-31), atau ``None`` jika tidak ditemukan.
        """
        import re
        # Coba match pattern 'Tanggal N', 'Tgl N', 'Tgl. N'
        match = re.search(r'(?:tanggal|tgl\.?)\s*(\d{1,2})', cutoff_rule, re.IGNORECASE)
        if match:
            day = int(match.group(1))
            if 1 <= day <= 31:
                return day

        # Coba match angka berdiri sendiri
        match = re.search(r'^(\d{1,2})$', cutoff_rule.strip())
        if match:
            day = int(match.group(1))
            if 1 <= day <= 31:
                return day

        return None

    @staticmethod
    def _resolve_day_in_month(day: int, from_date: date) -> date:
        """Resolve tanggal di bulan ini, atau bulan depan jika sudah lewat.

        Jika tanggal sudah terlewat di bulan ini, gunakan tanggal yang
        sama di bulan berikutnya. Menangani edge case bulan dengan
        jumlah hari berbeda (e.g. Feb 28/29).

        Args:
            day: Nomor tanggal (1-31).
            from_date: Tanggal referensi.

        Returns:
            ``date`` yang di-resolve.
        """
        import calendar

        year: int = from_date.year
        month: int = from_date.month

        # Clamp ke max hari di bulan ini
        max_day: int = calendar.monthrange(year, month)[1]
        actual_day: int = min(day, max_day)

        target = date(year, month, actual_day)

        if target >= from_date:
            return target

        # Sudah lewat → bulan depan
        if month == 12:
            next_year, next_month = year + 1, 1
        else:
            next_year, next_month = year, month + 1

        max_day_next: int = calendar.monthrange(next_year, next_month)[1]
        actual_day_next: int = min(day, max_day_next)
        return date(next_year, next_month, actual_day_next)

    @staticmethod
    def _end_of_month(d: date) -> date:
        """Dapatkan tanggal terakhir di bulan ``d``.

        Args:
            d: Tanggal referensi.

        Returns:
            ``date`` hari terakhir bulan tersebut.
        """
        import calendar
        last_day: int = calendar.monthrange(d.year, d.month)[1]
        return date(d.year, d.month, last_day)

    @staticmethod
    def _has_window_before_cutoff(
        windows: List[DeliveryWindow],
        cutoff_deadline: Optional[date],
    ) -> bool:
        """Cek apakah ada delivery window sebelum atau pada tanggal cutoff.

        Args:
            windows: List delivery windows yang valid.
            cutoff_deadline: Tanggal deadline cutoff (bisa ``None``).

        Returns:
            ``True`` jika ada window valid sebelum/pada cutoff, atau
            jika tidak ada cutoff (selalu ``True``).
        """
        if cutoff_deadline is None:
            return True  # Tidak ada cutoff = selalu OK

        return any(w.date <= cutoff_deadline for w in windows)


# ═══════════════════════════════════════════════════════════════════
#  PriorityScoringEngine — Simplified 3-Criteria SAW
# ═══════════════════════════════════════════════════════════════════

class PriorityScoringEngine:
    """Penilaian prioritas 3 kriteria (disederhanakan dari 5 kriteria).

    Evolusi dari ``SAWRecommendationEngine`` (5 kriteria) ke model yang
    lebih fokus. Dua kriteria dihapus karena tidak relevan lagi:

    Kriteria AKTIF:
        - **C1: Priority label** dari C4.5 (``w=0.50``)
            Mapping: Tinggi → 1.0, Sedang → 0.7, Rendah → 0.4
        - **C2: Cutoff urgency** — hari tersisa sampai cutoff (``w=0.30``)
            Semakin sedikit hari tersisa, semakin urgent
        - **C3: Schedule match** — apakah hari ini/besok valid (``w=0.20``)
            Hari ini match → 1.0, besok match → 0.7, tidak match → 0.3

    Kriteria yang DIHAPUS:
        - **C3 lama (Area Match)**: driver pre-assigned per customer via
          Master Data, sehingga area selalu match → tidak diskriminatif
        - **C4 lama (Driver Workload)**: menjadi informasional saja,
          bukan faktor penentu prioritas pengiriman

    Attributes:
        weights: Dict bobot per kriteria, total harus = 1.0.

    Examples:
        >>> scorer = PriorityScoringEngine()
        >>> result = scorer.compute_score(
        ...     priority_label='Tinggi',
        ...     days_until_cutoff=2,
        ...     schedule_match_today=True,
        ...     schedule_match_tomorrow=False,
        ... )
        >>> print(result['final_score'])  # High score
        >>> print(result['urgency_label'])  # 'URGENT'
    """

    # Bobot kriteria — sum = 1.0
    DEFAULT_WEIGHTS: Dict[str, float] = {
        'priority_label': 0.50,
        'cutoff_urgency': 0.30,
        'schedule_match': 0.20,
    }

    # Mapping priority label ke skor (C1)
    PRIORITY_SCORE_MAP: Dict[str, float] = {
        'Tinggi': 1.0,
        'Sedang': 0.7,
        'Rendah': 0.4,
    }

    # Thresholds untuk cutoff urgency scoring (C2)
    # Format: (max_days, score) — evaluated top-down
    CUTOFF_URGENCY_TIERS: List[Tuple[int, float]] = [
        (0, 1.0),    # Cutoff hari ini
        (1, 0.95),   # Cutoff besok
        (3, 0.85),   # Cutoff dalam 3 hari
        (5, 0.70),   # Cutoff dalam 5 hari
        (7, 0.50),   # Cutoff dalam 7 hari
        (14, 0.30),  # Cutoff dalam 14 hari
    ]

    def __init__(self) -> None:
        """Inisialisasi dengan bobot default."""
        self.weights: Dict[str, float] = dict(self.DEFAULT_WEIGHTS)

    def compute_score(
        self,
        priority_label: str,
        days_until_cutoff: Optional[int],
        schedule_match_today: bool,
        schedule_match_tomorrow: bool,
    ) -> Dict:
        """Hitung skor prioritas komposit menggunakan 3 kriteria SAW.

        Formula:
            ``final_score = (w1 × C1) + (w2 × C2) + (w3 × C3)``

        Dimana:
            - C1 = skor priority label (0.4 / 0.7 / 1.0)
            - C2 = skor cutoff urgency (0.0 - 1.0 berdasarkan hari tersisa)
            - C3 = skor schedule match (0.3 / 0.7 / 1.0)

        Args:
            priority_label: Label prioritas dari C4.5
                (``'Tinggi'`` / ``'Sedang'`` / ``'Rendah'``).
            days_until_cutoff: Jumlah hari tersisa sampai cutoff.
                ``None`` jika customer tidak punya cutoff.
            schedule_match_today: ``True`` jika hari ini termasuk dalam
                jadwal penerimaan customer.
            schedule_match_tomorrow: ``True`` jika besok termasuk dalam
                jadwal penerimaan customer.

        Returns:
            Dict berisi:
                - ``final_score``: ``float`` — skor komposit (0.0-1.0)
                - ``criteria_scores``: ``dict`` — skor per kriteria
                - ``weighted_scores``: ``dict`` — skor terbobot per kriteria
                - ``urgency_label``: ``str`` — 'URGENT'/'MODERATE'/'RELAXED'
                - ``delivery_feasibility``: ``str`` — 'TODAY'/'TOMORROW'/'SCHEDULED'
                - ``recommendation_label``: ``str`` — label rekomendasi
        """
        # --- C1: Priority Score ---
        c1_score: float = self.PRIORITY_SCORE_MAP.get(priority_label, 0.5)

        # --- C2: Cutoff Urgency ---
        c2_score: float = self._compute_cutoff_urgency(days_until_cutoff)

        # --- C3: Schedule Match ---
        c3_score: float = self._compute_schedule_match(
            schedule_match_today, schedule_match_tomorrow
        )

        # --- Weighted Sum ---
        w1: float = self.weights['priority_label']
        w2: float = self.weights['cutoff_urgency']
        w3: float = self.weights['schedule_match']

        weighted_c1: float = w1 * c1_score
        weighted_c2: float = w2 * c2_score
        weighted_c3: float = w3 * c3_score

        final_score: float = weighted_c1 + weighted_c2 + weighted_c3

        # --- Derived labels ---
        urgency_label: str = self._get_urgency_label(days_until_cutoff)
        delivery_feasibility: str = self._get_delivery_feasibility(
            schedule_match_today, schedule_match_tomorrow
        )
        recommendation_label: str = self._get_recommendation_label(final_score)

        return {
            'final_score': round(final_score, 4),
            'criteria_scores': {
                'priority_label': round(c1_score, 4),
                'cutoff_urgency': round(c2_score, 4),
                'schedule_match': round(c3_score, 4),
            },
            'weighted_scores': {
                'priority_label': round(weighted_c1, 4),
                'cutoff_urgency': round(weighted_c2, 4),
                'schedule_match': round(weighted_c3, 4),
            },
            'weights': dict(self.weights),
            'urgency_label': urgency_label,
            'delivery_feasibility': delivery_feasibility,
            'recommendation_label': recommendation_label,
        }

    # ─── Internal Scoring Methods ────────────────────────────────

    def _compute_cutoff_urgency(self, days_until_cutoff: Optional[int]) -> float:
        """Hitung skor urgensi cutoff berdasarkan sisa hari.

        Semakin sedikit hari tersisa, semakin tinggi skor urgensi
        (benefit-type: urgent = prioritas lebih tinggi).

        Jika tidak ada cutoff (``None``), return skor netral 0.5
        agar tidak terlalu mendominasi maupun terlalu rendah.

        Args:
            days_until_cutoff: Sisa hari ke cutoff, atau ``None``.

        Returns:
            Skor urgensi (0.0-1.0).
        """
        if days_until_cutoff is None:
            # No cutoff → netral, tidak urgent tapi juga bukan rendah
            return 0.5

        if days_until_cutoff < 0:
            # Cutoff sudah lewat → sangat urgent (harus segera ditindaklanjuti)
            return 1.0

        # Cari tier yang sesuai (top-down, first match)
        for max_days, score in self.CUTOFF_URGENCY_TIERS:
            if days_until_cutoff <= max_days:
                return score

        # > 14 hari → sangat longgar
        return 0.15

    @staticmethod
    def _compute_schedule_match(
        match_today: bool,
        match_tomorrow: bool,
    ) -> float:
        """Hitung skor kesesuaian jadwal penerimaan.

        Mapping:
            - Hari ini sesuai jadwal        → 1.0
            - Besok sesuai jadwal           → 0.7
            - Tidak ada match hari ini/besok → 0.3

        Args:
            match_today: Apakah hari ini valid untuk penerimaan.
            match_tomorrow: Apakah besok valid untuk penerimaan.

        Returns:
            Skor schedule match (0.3 / 0.7 / 1.0).
        """
        if match_today:
            return 1.0
        if match_tomorrow:
            return 0.7
        return 0.3

    @staticmethod
    def _get_urgency_label(days_until_cutoff: Optional[int]) -> str:
        """Dapatkan label urgensi human-readable.

        Args:
            days_until_cutoff: Sisa hari, atau ``None``.

        Returns:
            ``'URGENT'``, ``'MODERATE'``, atau ``'RELAXED'``.
        """
        if days_until_cutoff is None:
            return 'RELAXED'
        if days_until_cutoff <= URGENCY_CRITICAL_DAYS:
            return 'URGENT'
        if days_until_cutoff <= URGENCY_WARNING_DAYS:
            return 'MODERATE'
        return 'RELAXED'

    @staticmethod
    def _get_delivery_feasibility(
        match_today: bool,
        match_tomorrow: bool,
    ) -> str:
        """Tentukan feasibility pengiriman terdekat.

        Args:
            match_today: Jadwal hari ini valid.
            match_tomorrow: Jadwal besok valid.

        Returns:
            ``'TODAY'``, ``'TOMORROW'``, atau ``'SCHEDULED'``.
        """
        if match_today:
            return 'TODAY'
        if match_tomorrow:
            return 'TOMORROW'
        return 'SCHEDULED'

    @staticmethod
    def _get_recommendation_label(final_score: float) -> str:
        """Dapatkan label rekomendasi berdasarkan skor akhir.

        Konsisten dengan threshold di ``SAWRecommendationEngine``:
            - ``≥ 0.80`` → ``'Prioritas Tinggi'``
            - ``≥ 0.60`` → ``'Prioritas Sedang'``
            - ``< 0.60`` → ``'Prioritas Rendah'``

        Args:
            final_score: Skor komposit SAW (0.0-1.0).

        Returns:
            Label rekomendasi string.
        """
        if final_score >= 0.80:
            return 'Prioritas Tinggi'
        if final_score >= 0.60:
            return 'Prioritas Sedang'
        return 'Prioritas Rendah'
