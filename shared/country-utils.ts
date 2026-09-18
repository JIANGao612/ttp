const COUNTRY_DISPLAY_MAP: Record<string, string> = {
    GB: 'UK',
    AE: 'UAE',
};

export function getCountryDisplayCode(code: string): string {
    return COUNTRY_DISPLAY_MAP[code] ?? code;
}
