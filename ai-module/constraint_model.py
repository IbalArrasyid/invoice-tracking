"""
constraint_model.py — Customer Constraint Model (Model Kendala Pelanggan)
==========================================================================

KONTRIBUSI UTAMA TUGAS AKHIR:
    Modul ini memformalisasi pengetahuan operasional tacit (tacit knowledge)
    staf admin mengenai regulasi pengiriman invoice pelanggan menjadi model
    yang dapat diproses secara komputasional oleh mesin.

Latar Belakang:
    Dalam operasional sehari-hari, setiap pelanggan memiliki aturan unik
    mengenai kapan invoice boleh dikirim. Aturan ini sebelumnya hanya ada
    di "kepala" staf admin dan catatan manual. Modul ini mengubah 20+ jenis
    aturan cutoff, 14+ pola jadwal, dan beragam format waktu menjadi model
    formal yang dapat dievaluasi secara otomatis.

Data Pattern:
    - 3.169 invoice dari data operasional riil
    - 20+ tipe aturan cutoff (cutoff_invoice column)
    - 14+ pola jadwal penerimaan (day_schedule column)
    - 8+ format waktu penerimaan (receiving_time column)
    - 3+ tipe kurir (DRIVER, SELOG, mixed)

Arsitektur:
    CustomerConstraint (dataclass)  →  input dari database
         ↓
    CutoffParser          →  parse 20+ aturan cutoff → tanggal deadline
    ScheduleParser        →  parse 14+ pola jadwal  → set hari valid
    ReceivingTimeParser   →  parse format waktu     → (start, end)
         ↓
    CustomerConstraintModel  →  integrasi semua parser
         ↓
    DeliveryWindow (dataclass) →  output jendela pengiriman valid

Author: AI Module Team
"""

from dataclasses import dataclass, field
from typing import List, Optional, Tuple, Dict
from datetime import date, time, datetime, timedelta
import calendar
import re


# ─── Konstanta hari dalam Bahasa Indonesia ──────────────────────────
HARI_INDONESIA: Dict[int, str] = {
    0: 'Senin',
    1: 'Selasa',
    2: 'Rabu',
    3: 'Kamis',
    4: 'Jumat',
    5: 'Sabtu',
    6: 'Minggu',
}

# Reverse mapping: nama hari English → weekday int (0=Monday)
ENGLISH_DAY_MAP: Dict[str, int] = {
    'monday': 0,
    'tuesday': 1,
    'wednesday': 2,
    'thursday': 3,
    'friday': 4,
    'saturday': 5,
    'sunday': 6,
}


# ═══════════════════════════════════════════════════════════════════
#  DATACLASSES
# ═══════════════════════════════════════════════════════════════════

@dataclass
class CustomerConstraint:
    """Model formal kendala pengiriman invoice satu customer.

    Merepresentasikan satu baris konfigurasi pelanggan dari database.
    Setiap field berkorespondensi langsung dengan kolom di tabel master
    pelanggan.

    Attributes:
        customer_name: Nama pelanggan (misal 'PT. Toyota Motor Manufacturing')
        cutoff_rule:   Raw string aturan cutoff dari kolom `cutoff_invoice`
        day_schedule:  Raw string jadwal penerimaan dari kolom `day_schedule`
        receiving_time: Raw string jam penerimaan dari kolom `receiving_time`
        location:      Kode kawasan industri (KIM, KIIC, MM2100, EJIP, GIIC, dll.)
        courier_type:  Tipe kurir — 'DRIVER', 'SELOG', atau kombinasi
    """
    customer_name: str
    cutoff_rule: str
    day_schedule: str
    receiving_time: str
    location: str
    courier_type: str


@dataclass
class DeliveryWindow:
    """Representasi satu jendela waktu pengiriman yang valid.

    Hasil evaluasi constraint model — menunjukkan kapan invoice boleh
    dikirimkan ke pelanggan tertentu.

    Attributes:
        date:               Tanggal pengiriman yang valid
        day_name:           Nama hari dalam Bahasa Indonesia
        time_start:         Jam mulai penerimaan
        time_end:           Jam akhir penerimaan
        days_before_cutoff: Sisa hari sebelum batas cutoff (None jika no cutoff)
        is_today:           True jika tanggal ini adalah hari ini
        is_tomorrow:        True jika tanggal ini adalah besok
    """
    date: date
    day_name: str
    time_start: time
    time_end: time
    days_before_cutoff: Optional[int]
    is_today: bool
    is_tomorrow: bool


# ═══════════════════════════════════════════════════════════════════
#  CUTOFF PARSER
# ═══════════════════════════════════════════════════════════════════

class CutoffParser:
    """Parser untuk mengkonversi string aturan cutoff menjadi tanggal deadline.

    Mengubah 20+ jenis aturan cutoff dari data operasional riil menjadi
    tanggal batas yang dapat dihitung secara komputasional.

    Kategori aturan yang ditangani:
        1. No cutoff          — 'No cut off'
        2. End of month       — 'End of month'
        3. Fixed date         — 'Max on Nth in the month', 'Date 20'
        4. Working days       — 'N working days in next month'
        5. Before end-of-month — 'Max 3 working days before end of month'
        6. Week-based         — 'Max W1 in the next month', 'First week of next month'
        7. Multi-date         — 'Every 11th,12th,...' (Yamaha specific)
        8. Post-closing       — 'Max one day after closing periode'
        9. Composite          — aturan dengan multiple clauses separated by ';'
       10. Special codes      — 'necco'
    """

    def compute_cutoff_date(self, cutoff_rule: str, reference_date: date) -> Optional[date]:
        """Hitung tanggal cutoff berdasarkan aturan dan tanggal referensi.

        Tanggal referensi biasanya adalah tanggal invoice dibuat atau tanggal
        hari ini. Metode ini menghitung kapan batas akhir (deadline) pengiriman
        invoice ke pelanggan.

        Args:
            cutoff_rule:    Raw string aturan cutoff dari database
            reference_date: Tanggal referensi untuk perhitungan

        Returns:
            date jika ada batas cutoff, None jika tidak ada cutoff ('No cut off')

        Examples:
            >>> parser = CutoffParser()
            >>> parser.compute_cutoff_date('No cut off', date(2026, 6, 14))
            None
            >>> parser.compute_cutoff_date('End of month', date(2026, 6, 14))
            datetime.date(2026, 6, 30)
            >>> parser.compute_cutoff_date('Max on 5th in the month', date(2026, 6, 14))
            datetime.date(2026, 7, 5)  # already past, so next month
        """
        if not cutoff_rule or not isinstance(cutoff_rule, str):
            return None

        rule = cutoff_rule.strip()

        # ── 1. No cutoff ──────────────────────────────────────────
        if rule.lower() in ('no cut off', 'no cutoff', 'no cut-off', ''):
            return None

        # ── 2. End of month ───────────────────────────────────────
        if rule.lower() == 'end of month':
            return self._last_day_of_month(reference_date.year, reference_date.month)

        # ── 3. Fixed date: "Max on Nth in the month" / "every month" ─
        match_fixed = re.match(
            r'Max on (\d+)(?:st|nd|rd|th) in (?:the month|every month)',
            rule, re.IGNORECASE
        )
        if match_fixed:
            day_num = int(match_fixed.group(1))
            return self._resolve_fixed_day(reference_date, day_num)

        # ── 4. "Date 20" style ────────────────────────────────────
        match_date_n = re.match(r'Date\s+(\d+)', rule, re.IGNORECASE)
        if match_date_n:
            day_num = int(match_date_n.group(1))
            return self._resolve_fixed_day(reference_date, day_num)

        # ── 5. Working days in next month ─────────────────────────
        match_wd_next = re.match(
            r'(\d+)\s+working\s+days?\s+in\s+next\s+month',
            rule, re.IGNORECASE
        )
        if match_wd_next:
            n_days = int(match_wd_next.group(1))
            next_month_start = self._first_day_of_next_month(
                reference_date.year, reference_date.month
            )
            return self._get_nth_working_day(
                next_month_start.year, next_month_start.month, n_days
            )

        # ── 6. Working days before end of month ───────────────────
        match_wd_before = re.match(
            r'Max\s+(\d+)\s+working\s+days?\s+before\s+end\s+of\s+month',
            rule, re.IGNORECASE
        )
        if match_wd_before:
            n_days = int(match_wd_before.group(1))
            last_day = self._last_day_of_month(
                reference_date.year, reference_date.month
            )
            return self._get_nth_working_day_before(last_day, n_days)

        # ── 7. "Max W1 in the next month" ─────────────────────────
        match_w1 = re.match(
            r'Max\s+W(\d+)\s+in\s+the\s+next\s+month',
            rule, re.IGNORECASE
        )
        if match_w1:
            week_num = int(match_w1.group(1))
            next_month_start = self._first_day_of_next_month(
                reference_date.year, reference_date.month
            )
            # Last day of week N (e.g., W1 = day 7, but capped at last working day of that week)
            return self._get_last_working_day_of_week(
                next_month_start.year, next_month_start.month, week_num
            )

        # ── 8. "First week of next month" ─────────────────────────
        if rule.lower() == 'first week of next month':
            next_month_start = self._first_day_of_next_month(
                reference_date.year, reference_date.month
            )
            return self._get_last_working_day_of_week(
                next_month_start.year, next_month_start.month, 1
            )

        # ── 9. Multi-date (Yamaha specific) ───────────────────────
        #    'Every 11th,12th,21th,22th,28th,29th in every month'
        match_multi = re.match(
            r'Every\s+([\d,thstndrd\s]+)\s+in\s+every\s+month',
            rule, re.IGNORECASE
        )
        if match_multi:
            raw_dates = match_multi.group(1)
            days = [int(d) for d in re.findall(r'(\d+)', raw_dates)]
            return self._get_next_multi_date(reference_date, days)

        # ── 10. "Max one day after closing periode" ───────────────
        if re.match(
            r'Max\s+one\s+day\s+after\s+closing\s+periode?',
            rule, re.IGNORECASE
        ):
            # Closing period = end of month, so deadline = 1st of next month
            next_month = self._first_day_of_next_month(
                reference_date.year, reference_date.month
            )
            return next_month

        # ── 11. Composite rules (separated by ';') ───────────────
        #    'Max on 3rd in the month ; but scan invoice must submit by email end of month'
        if ';' in rule:
            # Ambil bagian pertama sebagai aturan cutoff utama
            primary_rule = rule.split(';')[0].strip()
            return self.compute_cutoff_date(primary_rule, reference_date)

        # ── 12. Special code: 'necco' ─────────────────────────────
        if rule.lower() == 'necco':
            # Necco = No Explicit Cutoff, Customer-defined On-demand
            # Perlakukan sama seperti end of month sebagai safe default
            return self._last_day_of_month(reference_date.year, reference_date.month)

        # ── Fallback: aturan tidak dikenali ───────────────────────
        return None

    def get_cutoff_type(self, cutoff_rule: str) -> str:
        """Klasifikasikan aturan cutoff ke dalam kategori.

        Berguna untuk analisis distribusi dan reporting.

        Args:
            cutoff_rule: Raw string aturan cutoff

        Returns:
            String kategori: 'no_cutoff', 'end_of_month', 'fixed_date',
            'working_days_next_month', 'working_days_before_eom',
            'week_based', 'multi_date', 'post_closing', 'composite',
            'special', atau 'unknown'
        """
        if not cutoff_rule or not isinstance(cutoff_rule, str):
            return 'no_cutoff'

        rule = cutoff_rule.strip().lower()

        if rule in ('no cut off', 'no cutoff', 'no cut-off', ''):
            return 'no_cutoff'
        if rule == 'end of month':
            return 'end_of_month'
        if re.match(r'max on \d+', rule):
            return 'fixed_date'
        if re.match(r'date\s+\d+', rule):
            return 'fixed_date'
        if re.match(r'\d+\s+working\s+days?\s+in\s+next\s+month', rule):
            return 'working_days_next_month'
        if 'working days before end' in rule:
            return 'working_days_before_eom'
        if re.match(r'max\s+w\d+', rule):
            return 'week_based'
        if rule == 'first week of next month':
            return 'week_based'
        if rule.startswith('every') and 'every month' in rule:
            return 'multi_date'
        if 'closing periode' in rule or 'closing period' in rule:
            return 'post_closing'
        if ';' in cutoff_rule:
            return 'composite'
        if rule == 'necco':
            return 'special'

        return 'unknown'

    # ─── Helper methods ──────────────────────────────────────────

    @staticmethod
    def _last_day_of_month(year: int, month: int) -> date:
        """Dapatkan tanggal terakhir dari bulan tertentu.

        Args:
            year:  Tahun (misal 2026)
            month: Bulan (1-12)

        Returns:
            Tanggal terakhir bulan tersebut

        Examples:
            >>> CutoffParser._last_day_of_month(2026, 2)
            datetime.date(2026, 2, 28)
            >>> CutoffParser._last_day_of_month(2024, 2)
            datetime.date(2024, 2, 29)
        """
        last_day = calendar.monthrange(year, month)[1]
        return date(year, month, last_day)

    @staticmethod
    def _first_day_of_next_month(year: int, month: int) -> date:
        """Dapatkan tanggal 1 bulan berikutnya.

        Args:
            year:  Tahun
            month: Bulan saat ini (1-12)

        Returns:
            Tanggal 1 bulan berikutnya (handle wrap-around Desember → Januari)
        """
        if month == 12:
            return date(year + 1, 1, 1)
        return date(year, month + 1, 1)

    @staticmethod
    def _is_working_day(d: date) -> bool:
        """Cek apakah suatu tanggal adalah hari kerja (Senin–Jumat).

        Args:
            d: Tanggal yang dicek

        Returns:
            True jika hari kerja (weekday 0–4), False jika weekend

        Note:
            Belum memperhitungkan hari libur nasional Indonesia.
            Untuk produksi, integrasikan dengan kalender libur nasional.
        """
        return d.weekday() < 5  # 0=Monday ... 4=Friday

    @classmethod
    def _get_nth_working_day(cls, year: int, month: int, n: int) -> date:
        """Dapatkan hari kerja ke-N dalam bulan tertentu.

        Menghitung dari tanggal 1 bulan tersebut, melewati hari weekend.
        Misal: hari kerja ke-3 dari Juni 2026 = tanggal 3 Juni (jika
        tanggal 1 adalah Senin).

        Args:
            year:  Tahun
            month: Bulan (1-12)
            n:     Hari kerja ke-N (1-based)

        Returns:
            Tanggal hari kerja ke-N

        Raises:
            ValueError: Jika n <= 0 atau melebihi jumlah hari kerja di bulan itu
        """
        if n <= 0:
            raise ValueError(f"n harus > 0, diterima: {n}")

        count = 0
        current = date(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]

        while current.day <= last_day:
            if cls._is_working_day(current):
                count += 1
                if count == n:
                    return current
            current += timedelta(days=1)

        raise ValueError(
            f"Bulan {month}/{year} tidak memiliki {n} hari kerja"
        )

    @classmethod
    def _get_nth_working_day_before(cls, end_date: date, n: int) -> date:
        """Dapatkan hari kerja ke-N sebelum tanggal tertentu.

        Menghitung mundur dari end_date. Misal: 3 hari kerja sebelum
        30 Juni 2026 → hitung mundur melewati weekend.

        Args:
            end_date: Tanggal akhir (biasanya akhir bulan)
            n:        Jumlah hari kerja mundur

        Returns:
            Tanggal hari kerja ke-N sebelum end_date
        """
        count = 0
        current = end_date

        while count < n:
            current -= timedelta(days=1)
            if cls._is_working_day(current):
                count += 1

        return current

    @classmethod
    def _get_last_working_day_of_week(
        cls, year: int, month: int, week_num: int
    ) -> date:
        """Dapatkan hari kerja terakhir di minggu ke-N dari bulan tertentu.

        Minggu ke-1 = tanggal 1–7, Minggu ke-2 = tanggal 8–14, dst.

        Args:
            year:     Tahun
            month:    Bulan (1-12)
            week_num: Minggu ke-N (1-based)

        Returns:
            Tanggal hari kerja terakhir di minggu tersebut
        """
        # Week N spans days: ((week_num-1)*7 + 1) to (week_num*7)
        start_day = (week_num - 1) * 7 + 1
        end_day = min(week_num * 7, calendar.monthrange(year, month)[1])

        # Cari hari kerja terakhir dalam rentang ini
        last_working = None
        for day_num in range(start_day, end_day + 1):
            d = date(year, month, day_num)
            if cls._is_working_day(d):
                last_working = d

        # Fallback: jika semua hari dalam minggu itu weekend, ambil hari terakhir
        if last_working is None:
            last_working = date(year, month, end_day)

        return last_working

    @staticmethod
    def _resolve_fixed_day(reference_date: date, day_num: int) -> date:
        """Resolve tanggal fixed-date ke bulan yang relevan.

        Jika tanggal cutoff sudah lewat di bulan ini, gunakan bulan depan.
        Juga handle day_num yang melebihi jumlah hari dalam bulan (misal
        tanggal 31 di bulan Februari → cap ke hari terakhir bulan).

        Args:
            reference_date: Tanggal referensi (biasanya hari ini)
            day_num:        Tanggal cutoff (1-31)

        Returns:
            Tanggal cutoff yang sudah di-resolve
        """
        year = reference_date.year
        month = reference_date.month

        # Cap day_num ke hari terakhir bulan jika perlu
        max_day = calendar.monthrange(year, month)[1]
        actual_day = min(day_num, max_day)

        cutoff = date(year, month, actual_day)

        if cutoff < reference_date:
            # Sudah lewat, pakai bulan depan
            if month == 12:
                year += 1
                month = 1
            else:
                month += 1
            max_day = calendar.monthrange(year, month)[1]
            actual_day = min(day_num, max_day)
            cutoff = date(year, month, actual_day)

        return cutoff

    @staticmethod
    def _get_next_multi_date(reference_date: date, days: List[int]) -> date:
        """Dapatkan tanggal multi-date terdekat dari reference_date.

        Untuk pola seperti Yamaha: 'Every 11th,12th,21th,22th,28th,29th'.
        Cari tanggal terdekat yang >= reference_date dari list tanggal.

        Args:
            reference_date: Tanggal referensi
            days:           List tanggal yang valid (misal [11, 12, 21, 22, 28, 29])

        Returns:
            Tanggal multi-date terdekat yang belum lewat
        """
        if not days:
            return reference_date

        year = reference_date.year
        month = reference_date.month

        # Cari di bulan ini dulu
        for day_num in sorted(days):
            max_day = calendar.monthrange(year, month)[1]
            if day_num > max_day:
                continue
            candidate = date(year, month, day_num)
            if candidate >= reference_date:
                return candidate

        # Semua tanggal di bulan ini sudah lewat, cari di bulan depan
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1

        max_day = calendar.monthrange(year, month)[1]
        for day_num in sorted(days):
            if day_num > max_day:
                continue
            return date(year, month, day_num)

        # Extreme fallback
        return date(year, month, 1)


# ═══════════════════════════════════════════════════════════════════
#  SCHEDULE PARSER
# ═══════════════════════════════════════════════════════════════════

class ScheduleParser:
    """Parser untuk mengkonversi string jadwal penerimaan menjadi set hari.

    Menangani 14+ pola jadwal dari data operasional riil, termasuk:
        - Setiap hari ('Everyday')
        - Hari tunggal ('Wednesday', 'Thursday')
        - Dua hari ('Tuesday & Thursday', 'Monday & Thursday')
        - Tiga hari ('Monday, Wednesday & Friday')
        - Rentang hari ('Monday - Wednesday')
        - Jadwal khusus ('Based on Schedule Payment')

    Mapping menggunakan Python weekday convention: 0=Monday, 6=Sunday.
    """

    # Mapping semua pola jadwal yang ditemukan di data riil
    SCHEDULE_MAP: Dict[str, List[int]] = {
        'everyday':                        [0, 1, 2, 3, 4],  # Senin-Jumat
        'wednesday':                       [2],
        'thursday':                        [3],
        'tuesday & thursday':              [1, 3],
        'monday & thursday':               [0, 3],
        'wednesday & friday':              [2, 4],
        'tuesday & wednesday':             [1, 2],
        'monday, wednesday & friday':      [0, 2, 4],
        'monday, tuesday & thursday':      [0, 1, 3],
        'monday, tuesday & friday':        [0, 1, 4],
        'tuesday,thursday & friday':       [1, 3, 4],
        'tuesday, thursday & friday':      [1, 3, 4],
        'monday - wednesday':              [0, 1, 2],
    }

    def parse_schedule(self, schedule_str: str) -> List[int]:
        """Konversi string jadwal ke list weekday numbers.

        Weekday convention mengikuti Python: 0=Senin (Monday), 6=Minggu (Sunday).
        Jadwal 'Everyday' dianggap Senin–Jumat (hari kerja).

        Args:
            schedule_str: Raw string jadwal dari database, misal 'Tuesday & Thursday'

        Returns:
            List of weekday integers, sorted ascending.
            Kosong jika jadwal tidak dikenali.

        Examples:
            >>> parser = ScheduleParser()
            >>> parser.parse_schedule('Everyday')
            [0, 1, 2, 3, 4]
            >>> parser.parse_schedule('Tuesday & Thursday')
            [1, 3]
            >>> parser.parse_schedule('Monday - Wednesday')
            [0, 1, 2]
        """
        if not schedule_str or not isinstance(schedule_str, str):
            return [0, 1, 2, 3, 4]  # Default: weekdays

        normalized = schedule_str.strip().lower()

        # ── 1. Exact match dari SCHEDULE_MAP ──────────────────────
        if normalized in self.SCHEDULE_MAP:
            return sorted(self.SCHEDULE_MAP[normalized])

        # ── 2. "Based on Schedule Payment" → semua hari kerja ────
        if 'based on schedule' in normalized or 'schedule payment' in normalized:
            return [0, 1, 2, 3, 4]

        # ── 3. Coba parse range: "DayA - DayB" ───────────────────
        range_match = re.match(
            r'(\w+)\s*[-–]\s*(\w+)', normalized
        )
        if range_match:
            start_day = ENGLISH_DAY_MAP.get(range_match.group(1).lower())
            end_day = ENGLISH_DAY_MAP.get(range_match.group(2).lower())
            if start_day is not None and end_day is not None:
                if start_day <= end_day:
                    return list(range(start_day, end_day + 1))
                else:
                    # Wrap around (e.g., Friday - Monday)
                    return sorted(
                        list(range(start_day, 7)) + list(range(0, end_day + 1))
                    )

        # ── 4. Coba parse daftar hari dari string generik ────────
        found_days = []
        for day_name, day_num in ENGLISH_DAY_MAP.items():
            if day_name in normalized:
                found_days.append(day_num)

        if found_days:
            return sorted(found_days)

        # ── 5. Fallback: semua hari kerja ─────────────────────────
        return [0, 1, 2, 3, 4]

    def is_valid_day(self, schedule_str: str, target_date: date) -> bool:
        """Cek apakah tanggal tertentu valid untuk jadwal penerimaan ini.

        Args:
            schedule_str: Raw string jadwal dari database
            target_date:  Tanggal yang akan dicek

        Returns:
            True jika hari dari target_date ada di jadwal penerimaan
        """
        valid_days = self.parse_schedule(schedule_str)
        return target_date.weekday() in valid_days

    def get_schedule_description(self, schedule_str: str) -> str:
        """Dapatkan deskripsi jadwal dalam Bahasa Indonesia.

        Args:
            schedule_str: Raw string jadwal

        Returns:
            String deskripsi jadwal dalam Bahasa Indonesia

        Examples:
            >>> parser = ScheduleParser()
            >>> parser.get_schedule_description('Tuesday & Thursday')
            'Selasa, Kamis'
        """
        valid_days = self.parse_schedule(schedule_str)
        day_names = [HARI_INDONESIA.get(d, '?') for d in valid_days]
        return ', '.join(day_names)


# ═══════════════════════════════════════════════════════════════════
#  RECEIVING TIME PARSER
# ═══════════════════════════════════════════════════════════════════

class ReceivingTimeParser:
    """Parser untuk jendela waktu penerimaan invoice.

    Data operasional menggunakan dua format waktu yang bervariasi:
        - Format titik dua : '09:00 - 15:00'
        - Format titik     : '08.30 - 17.30'

    Keduanya perlu di-parse menjadi objek `time` Python standar.
    """

    # Default window jika parsing gagal
    DEFAULT_START: time = time(9, 0)
    DEFAULT_END: time = time(15, 0)

    def parse_time_window(self, time_str: str) -> Tuple[time, time]:
        """Parse string waktu penerimaan ke tuple (start, end).

        Menangani kedua format separator (':' dan '.') yang ditemukan
        di data operasional riil.

        Args:
            time_str: Raw string waktu dari database,
                      misal '09:00 - 15:00' atau '08.30 - 17.30'

        Returns:
            Tuple (time_start, time_end)

        Examples:
            >>> parser = ReceivingTimeParser()
            >>> parser.parse_time_window('09:00 - 15:00')
            (datetime.time(9, 0), datetime.time(15, 0))
            >>> parser.parse_time_window('08.30 - 17.30')
            (datetime.time(8, 30), datetime.time(17, 30))
        """
        if not time_str or not isinstance(time_str, str):
            return (self.DEFAULT_START, self.DEFAULT_END)

        # Normalize separator: ganti titik dengan titik dua
        normalized = time_str.strip().replace('.', ':')

        # Cari pola HH:MM - HH:MM (dengan berbagai separator)
        match = re.match(
            r'(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})',
            normalized
        )

        if match:
            start_h, start_m = int(match.group(1)), int(match.group(2))
            end_h, end_m = int(match.group(3)), int(match.group(4))

            # Validasi range waktu
            start_h = min(max(start_h, 0), 23)
            start_m = min(max(start_m, 0), 59)
            end_h = min(max(end_h, 0), 23)
            end_m = min(max(end_m, 0), 59)

            return (time(start_h, start_m), time(end_h, end_m))

        return (self.DEFAULT_START, self.DEFAULT_END)

    def is_within_window(self, time_str: str, check_time: time) -> bool:
        """Cek apakah waktu tertentu berada dalam jendela penerimaan.

        Args:
            time_str:   Raw string waktu dari database
            check_time: Waktu yang dicek

        Returns:
            True jika check_time berada dalam jendela [start, end]
        """
        start, end = self.parse_time_window(time_str)
        return start <= check_time <= end

    def get_window_duration_minutes(self, time_str: str) -> int:
        """Hitung durasi jendela penerimaan dalam menit.

        Args:
            time_str: Raw string waktu dari database

        Returns:
            Durasi jendela penerimaan dalam menit
        """
        start, end = self.parse_time_window(time_str)
        start_dt = datetime.combine(date.today(), start)
        end_dt = datetime.combine(date.today(), end)
        delta = end_dt - start_dt
        return max(int(delta.total_seconds() / 60), 0)


# ═══════════════════════════════════════════════════════════════════
#  CUSTOMER CONSTRAINT MODEL (INTEGRASI)
# ═══════════════════════════════════════════════════════════════════

class CustomerConstraintModel:
    """Model utama yang mengintegrasikan semua parser kendala pelanggan.

    Ini adalah FORMALISASI PENGETAHUAN OPERASIONAL — mengubah
    pengetahuan tacit staf admin (yang biasanya hanya ada di catatan
    manual atau ingatan pribadi) menjadi model yang dapat diproses mesin.

    Model ini menjawab pertanyaan kunci:
        "Diberikan kendala pelanggan X, kapan saja invoice boleh dikirim?"

    Pipeline evaluasi:
        1. Parse aturan cutoff → tanggal deadline
        2. Parse jadwal penerimaan → set hari valid
        3. Parse waktu penerimaan → jendela jam
        4. Gabungkan semua constraint → DeliveryWindow list

    Usage:
        >>> model = CustomerConstraintModel()
        >>> constraint = CustomerConstraint(
        ...     customer_name='PT. Toyota',
        ...     cutoff_rule='Max on 5th in the month',
        ...     day_schedule='Tuesday & Thursday',
        ...     receiving_time='09:00 - 15:00',
        ...     location='KIIC',
        ...     courier_type='DRIVER'
        ... )
        >>> windows = model.get_valid_delivery_windows(constraint, date.today())
    """

    def __init__(self) -> None:
        """Inisialisasi model dengan semua parser."""
        self.cutoff_parser = CutoffParser()
        self.schedule_parser = ScheduleParser()
        self.time_parser = ReceivingTimeParser()

    def evaluate_constraints(
        self,
        constraint: CustomerConstraint,
        target_date: date,
    ) -> dict:
        """Evaluasi semua kendala untuk tanggal pengiriman tertentu.

        Mengecek tiga dimensi constraint secara bersamaan:
            1. Apakah target_date sebelum tanggal cutoff?
            2. Apakah target_date adalah hari penerimaan yang valid?
            3. Berapa jendela waktu penerimaan?

        Args:
            constraint:  Objek CustomerConstraint dari database
            target_date: Tanggal pengiriman yang ingin dievaluasi

        Returns:
            Dict berisi hasil evaluasi lengkap:
                {
                    'customer_name': str,
                    'target_date': date,
                    'target_day': str,           # Nama hari Indonesia
                    'is_valid_date': bool,        # Apakah boleh kirim di tanggal ini?
                    'cutoff_date': Optional[date],
                    'cutoff_type': str,
                    'is_before_cutoff': bool,
                    'days_before_cutoff': Optional[int],
                    'is_valid_schedule_day': bool,
                    'valid_schedule_days': List[str],  # Nama hari Indonesia
                    'time_start': time,
                    'time_end': time,
                    'window_duration_minutes': int,
                    'courier_type': str,
                    'location': str,
                    'violations': List[str],       # Daftar pelanggaran
                }
        """
        violations: List[str] = []

        # ── 1. Evaluasi cutoff ────────────────────────────────────
        cutoff_date = self.cutoff_parser.compute_cutoff_date(
            constraint.cutoff_rule, target_date
        )
        cutoff_type = self.cutoff_parser.get_cutoff_type(constraint.cutoff_rule)

        if cutoff_date is not None:
            is_before_cutoff = target_date <= cutoff_date
            days_before_cutoff = (cutoff_date - target_date).days
        else:
            is_before_cutoff = True  # Tidak ada cutoff = selalu valid
            days_before_cutoff = None

        if not is_before_cutoff:
            violations.append(
                f'Melewati batas cutoff ({cutoff_date.isoformat()})'
            )

        # ── 2. Evaluasi jadwal hari ───────────────────────────────
        is_valid_schedule = self.schedule_parser.is_valid_day(
            constraint.day_schedule, target_date
        )
        valid_days_int = self.schedule_parser.parse_schedule(constraint.day_schedule)
        valid_day_names = [HARI_INDONESIA.get(d, '?') for d in valid_days_int]

        if not is_valid_schedule:
            target_day_name = HARI_INDONESIA.get(target_date.weekday(), '?')
            violations.append(
                f'Hari {target_day_name} bukan jadwal penerimaan '
                f'(jadwal: {", ".join(valid_day_names)})'
            )

        # ── 3. Evaluasi waktu penerimaan ──────────────────────────
        time_start, time_end = self.time_parser.parse_time_window(
            constraint.receiving_time
        )
        window_minutes = self.time_parser.get_window_duration_minutes(
            constraint.receiving_time
        )

        # ── 4. Gabungkan hasil ────────────────────────────────────
        is_valid = is_before_cutoff and is_valid_schedule

        today = date.today()

        return {
            'customer_name': constraint.customer_name,
            'target_date': target_date,
            'target_day': HARI_INDONESIA.get(target_date.weekday(), '?'),
            'is_valid_date': is_valid,
            'cutoff_date': cutoff_date,
            'cutoff_type': cutoff_type,
            'is_before_cutoff': is_before_cutoff,
            'days_before_cutoff': days_before_cutoff,
            'is_valid_schedule_day': is_valid_schedule,
            'valid_schedule_days': valid_day_names,
            'time_start': time_start,
            'time_end': time_end,
            'window_duration_minutes': window_minutes,
            'courier_type': constraint.courier_type,
            'location': constraint.location,
            'violations': violations,
        }

    def get_valid_delivery_windows(
        self,
        constraint: CustomerConstraint,
        from_date: date,
        max_days: int = 14,
    ) -> List[DeliveryWindow]:
        """Cari semua jendela pengiriman valid dalam rentang hari.

        Memindai hari demi hari dari from_date sampai from_date + max_days,
        dan mengembalikan hanya hari-hari yang memenuhi SEMUA constraint:
            - Hari penerimaan sesuai jadwal
            - Belum melewati tanggal cutoff
            - Bukan hari weekend (implisit dari jadwal)

        Args:
            constraint: Objek CustomerConstraint dari database
            from_date:  Tanggal mulai pencarian
            max_days:   Jumlah hari maksimal yang diperiksa (default: 14)

        Returns:
            List of DeliveryWindow, sorted by date ascending.
            List kosong jika tidak ada jendela valid.

        Examples:
            >>> model = CustomerConstraintModel()
            >>> constraint = CustomerConstraint(
            ...     customer_name='PT. XYZ',
            ...     cutoff_rule='Max on 5th in the month',
            ...     day_schedule='Tuesday & Thursday',
            ...     receiving_time='09:00 - 15:00',
            ...     location='KIM',
            ...     courier_type='DRIVER'
            ... )
            >>> windows = model.get_valid_delivery_windows(
            ...     constraint, date(2026, 6, 1), max_days=14
            ... )
        """
        windows: List[DeliveryWindow] = []
        today = date.today()

        # Pre-compute: cutoff date dan time window (tidak berubah per hari)
        cutoff_date = self.cutoff_parser.compute_cutoff_date(
            constraint.cutoff_rule, from_date
        )
        time_start, time_end = self.time_parser.parse_time_window(
            constraint.receiving_time
        )

        for offset in range(max_days):
            candidate = from_date + timedelta(days=offset)

            # Check 1: Apakah hari valid menurut jadwal?
            if not self.schedule_parser.is_valid_day(
                constraint.day_schedule, candidate
            ):
                continue

            # Check 2: Apakah belum melewati cutoff?
            if cutoff_date is not None and candidate > cutoff_date:
                continue

            # Hitung sisa hari sebelum cutoff
            if cutoff_date is not None:
                days_before = (cutoff_date - candidate).days
            else:
                days_before = None

            window = DeliveryWindow(
                date=candidate,
                day_name=HARI_INDONESIA.get(candidate.weekday(), '?'),
                time_start=time_start,
                time_end=time_end,
                days_before_cutoff=days_before,
                is_today=(candidate == today),
                is_tomorrow=(candidate == today + timedelta(days=1)),
            )
            windows.append(window)

        return windows

    def get_urgency_level(
        self,
        constraint: CustomerConstraint,
        reference_date: date,
    ) -> Dict[str, object]:
        """Tentukan level urgensi pengiriman berdasarkan kedekatan cutoff.

        Level urgensi:
            - 'CRITICAL'  : 0-1 hari sebelum cutoff
            - 'HIGH'      : 2-3 hari sebelum cutoff
            - 'MEDIUM'    : 4-7 hari sebelum cutoff
            - 'LOW'       : > 7 hari atau tidak ada cutoff

        Args:
            constraint:     Objek CustomerConstraint
            reference_date: Tanggal referensi (biasanya hari ini)

        Returns:
            Dict {
                'level': str,            # 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'
                'days_remaining': Optional[int],
                'cutoff_date': Optional[date],
                'message': str,          # Pesan deskriptif Bahasa Indonesia
            }
        """
        cutoff_date = self.cutoff_parser.compute_cutoff_date(
            constraint.cutoff_rule, reference_date
        )

        if cutoff_date is None:
            return {
                'level': 'LOW',
                'days_remaining': None,
                'cutoff_date': None,
                'message': 'Tidak ada batas cutoff — pengiriman fleksibel.',
            }

        days_remaining = (cutoff_date - reference_date).days

        if days_remaining <= 1:
            level = 'CRITICAL'
            message = (
                f'SEGERA! Sisa {days_remaining} hari sebelum cutoff '
                f'({cutoff_date.isoformat()}). Prioritaskan pengiriman hari ini.'
            )
        elif days_remaining <= 3:
            level = 'HIGH'
            message = (
                f'Mendesak. Sisa {days_remaining} hari sebelum cutoff '
                f'({cutoff_date.isoformat()}).'
            )
        elif days_remaining <= 7:
            level = 'MEDIUM'
            message = (
                f'Masih ada waktu. Sisa {days_remaining} hari sebelum cutoff '
                f'({cutoff_date.isoformat()}).'
            )
        else:
            level = 'LOW'
            message = (
                f'Aman. Sisa {days_remaining} hari sebelum cutoff '
                f'({cutoff_date.isoformat()}).'
            )

        return {
            'level': level,
            'days_remaining': days_remaining,
            'cutoff_date': cutoff_date,
            'message': message,
        }

    def summarize_constraint(self, constraint: CustomerConstraint) -> Dict[str, str]:
        """Buat ringkasan human-readable dari constraint pelanggan.

        Berguna untuk UI dan reporting. Mengkonversi data teknis menjadi
        teks yang mudah dipahami oleh staf admin.

        Args:
            constraint: Objek CustomerConstraint

        Returns:
            Dict dengan key deskriptif dalam Bahasa Indonesia
        """
        schedule_desc = self.schedule_parser.get_schedule_description(
            constraint.day_schedule
        )
        time_start, time_end = self.time_parser.parse_time_window(
            constraint.receiving_time
        )
        cutoff_type = self.cutoff_parser.get_cutoff_type(constraint.cutoff_rule)
        window_minutes = self.time_parser.get_window_duration_minutes(
            constraint.receiving_time
        )

        # Format waktu
        time_range = f'{time_start.strftime("%H:%M")} - {time_end.strftime("%H:%M")}'

        # Cutoff description
        cutoff_desc_map = {
            'no_cutoff': 'Tidak ada batas cutoff',
            'end_of_month': 'Akhir bulan',
            'fixed_date': f'Tanggal tetap ({constraint.cutoff_rule})',
            'working_days_next_month': f'Hari kerja di bulan depan ({constraint.cutoff_rule})',
            'working_days_before_eom': f'Hari kerja sebelum akhir bulan ({constraint.cutoff_rule})',
            'week_based': f'Berbasis minggu ({constraint.cutoff_rule})',
            'multi_date': f'Tanggal ganda ({constraint.cutoff_rule})',
            'post_closing': 'Setelah closing period',
            'composite': f'Gabungan ({constraint.cutoff_rule})',
            'special': f'Khusus ({constraint.cutoff_rule})',
        }
        cutoff_desc = cutoff_desc_map.get(cutoff_type, constraint.cutoff_rule)

        # Courier description
        courier_desc_map = {
            'DRIVER': 'Driver internal perusahaan',
            'SELOG': 'Kurir eksternal (SELOG)',
        }
        courier_desc = courier_desc_map.get(
            constraint.courier_type, constraint.courier_type
        )

        return {
            'pelanggan': constraint.customer_name,
            'aturan_cutoff': cutoff_desc,
            'tipe_cutoff': cutoff_type,
            'jadwal_penerimaan': schedule_desc,
            'jam_penerimaan': time_range,
            'durasi_jendela': f'{window_minutes} menit',
            'lokasi': constraint.location,
            'tipe_kurir': courier_desc,
        }
