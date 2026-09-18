/** Flexible date parser — 兼容多种常见日期格式，统一输出 YYYY-MM-DD。
 *  解析失败返回空字符串。
 *
 *  支持格式（按匹配优先级）：
 *  1. Excel 序列号（5 位数字，如 46250 → 2026-08-25）
 *  2. YYYYMMDD（8 位纯数字，如 20260825）
 *  3. YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD
 *  4. DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY（欧洲日期，仅当首组 >12 且次组 ≤12 时）
 *  5. MM-DD-YYYY / MM/DD/YYYY / MM.DD.YYYY（美国日期，2 位或 4 位年份）
 *  6. YYYY年MM月DD日（中文日期）
 *  7. ISO 时间戳字符串（含 T/Z）
 *  8. Unix 时间戳（10/13 位数字，秒或毫秒）
 */
export function parseDateFlex(input: string | number | null | undefined): string {
    if (input == null) return '';
    if (input === '') return '';

    if (typeof input === 'number') {
        if (input > 25000 && input < 80000) {
            return excelSerialToDate(input);
        }
        if (input > 1000000000000) {
            const d = new Date(input);
            return formatUTC(d);
        }
        if (input > 1000000000) {
            const d = new Date(input * 1000);
            return formatUTC(d);
        }
        return '';
    }

    const str = String(input).trim();
    if (!str) return '';

    if (/^\d{5}$/.test(str)) {
        return excelSerialToDate(Number(str));
    }

    if (/^\d{8}$/.test(str)) {
        const y = str.slice(0, 4);
        const m = str.slice(4, 6);
        const d = str.slice(6, 8);
        return normalizeAndValidate(y, m, d);
    }

    const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (ymd) {
        return normalizeAndValidate(ymd[1], ymd[2], ymd[3]);
    }

    const g1g2g3 = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (g1g2g3) {
        const n1 = Number(g1g2g3[1]);
        const n2 = Number(g1g2g3[2]);
        let year = g1g2g3[3];
        if (year.length === 2) {
            const yNum = Number(year);
            year = String(yNum >= 50 ? 1900 + yNum : 2000 + yNum);
        }
        if (n1 > 12 && n2 <= 12) {
            return normalizeAndValidate(year, g1g2g3[2], g1g2g3[1]);
        }
        return normalizeAndValidate(year, g1g2g3[1], g1g2g3[2]);
    }

    const cn = str.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (cn) {
        return normalizeAndValidate(cn[1], cn[2], cn[3]);
    }

    if (str.includes('T') || str.endsWith('Z')) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return formatUTC(d);
        }
    }

    if (/^\d{10}$/.test(str)) {
        const d = new Date(Number(str) * 1000);
        if (!isNaN(d.getTime())) return formatUTC(d);
    }
    if (/^\d{13}$/.test(str)) {
        const d = new Date(Number(str));
        if (!isNaN(d.getTime())) return formatUTC(d);
    }

    return '';
}

function excelSerialToDate(serial: number): string {
    const date = new Date((serial - 25569) * 86400 * 1000);
    return formatUTC(date);
}

function formatUTC(d: Date): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function normalizeAndValidate(y: string, m: string, d: string): string {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    if (year < 1900 || year > 2100) return '';
    if (month < 1 || month > 12) return '';
    if (day < 1 || day > 31) return '';
    return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 日期比较：a > b → 1, a < b → -1, 相等 → 0。
 *  任意一方解析失败返回 null（调用方需决定如何处理）。 */
export function compareDateFlex(
    a: string | number | null | undefined,
    b: string | number | null | undefined,
): number | null {
    const da = parseDateFlex(a);
    const db = parseDateFlex(b);
    if (!da || !db) return null;
    if (da > db) return 1;
    if (da < db) return -1;
    return 0;
}

/** 判断值是否看起来是日期格式（用于自动选择比较方式）。
 *  比严格的 parseDateFlex 宽松，只要看起来像日期就返回 true。 */
export function isDateLike(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'number') {
        return (value > 25000 && value < 80000) || (value > 1000000000 && value < 5000000000000);
    }
    if (typeof value !== 'string') return false;
    const s = value.trim();
    if (!s) return false;
    if (/^\d{5,8}$/.test(s)) return true;
    if (/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) return true;
    if (/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(s)) return true;
    if (/年\d{1,2}月\d{1,2}日/.test(s)) return true;
    if (s.includes('T') || s.endsWith('Z')) return true;
    return false;
}
