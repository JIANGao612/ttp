const MOBILE_UA_RE = /Android|iPhone|iPad|iPod|Mobile|HarmonyOS/i;

export function isMobileDevice(): boolean {
    if (typeof navigator === 'undefined') {
        return false;
    }
    return MOBILE_UA_RE.test(navigator.userAgent);
}

export function buildImageExportName(
    label: string,
    start?: string,
    end?: string,
): string {
    const now = new Date();
    const today =
        `${now.getFullYear()}` +
        `${String(now.getMonth() + 1).padStart(2, '0')}` +
        `${String(now.getDate()).padStart(2, '0')}`;
    const compact = (d: string | undefined): string =>
        d ? d.replace(/-/g, '') : today;
    return `${label}_${compact(start)}-${compact(end)}`;
}
