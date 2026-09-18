import {parseDateFlex} from '@server/common/utils/date-flex';

export const ADVERTISER_LIST = ['CLJ', 'HL', 'JJ', 'LSY', 'LW', 'LYX', 'LZJ', 'WR', 'ZZ'] as const;

export function calcPlacer(seriesName: string): string {
    if (!seriesName) return '其他';
    const upper = seriesName.toUpperCase();
    for (const name of ADVERTISER_LIST) {
        if (upper.includes(name)) return name;
    }
    return '其他';
}

export function calcMaterialNameClean(creativeName: string): string {
    if (!creativeName) return '';
    let result = creativeName.trim();

    const extRe = /\.(mp4|mov|avi|mkv|webm|jpg|jpeg|png|gif|bmp|webp|mp3|wav|larkcache)$/i;
    let prev = '';
    while (result !== prev) {
        prev = result;
        result = result.replace(extRe, '');
    }

    result = result.replace(/New_eM/gi, 'New#eM');
    result = result.replace(/Reactive_eM/gi, 'Reactive#eM');
    const underscorePos = result.indexOf('_');
    if (underscorePos !== -1) {
        result = result.substring(0, underscorePos);
    }

    prev = '';
    while (result !== prev) {
        prev = result;
        result = result.replace(extRe, '');
    }

    result = result.replace(/New#eM/gi, 'New_eM');
    result = result.replace(/Reactive#eM/gi, 'Reactive_eM');
    return result.trim();
}

const ISO_3166_1_ALPHA2 = new Set([
    'AD', 'AE', 'AF', 'AG', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
    'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ',
    'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ',
    'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ',
    'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET',
    'FI', 'FJ', 'FK', 'FM', 'FO', 'FR',
    'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY',
    'HK', 'HM', 'HN', 'HR', 'HT', 'HU',
    'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT',
    'JE', 'JM', 'JO', 'JP',
    'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ',
    'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY',
    'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ',
    'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ',
    'OM',
    'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY',
    'QA',
    'RE', 'RO', 'RS', 'RU', 'RW',
    'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ',
    'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW', 'TZ',
    'UA', 'UG', 'UM', 'US', 'UY', 'UZ',
    'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU',
    'WF', 'WS',
    'YE', 'YT',
    'ZA', 'ZM', 'ZW',
]);

const COUNTRY_ALIAS: Record<string, string> = {
    'GB': 'UK',
    'AE': 'UAE',
    'USA': 'US',
    'Korea': 'KR',
    'Vietnam': 'VN',
};

const STANDARD_COUNTRY_SET: Set<string> = new Set([
    ...ISO_3166_1_ALPHA2,
    'UK',
    'UAE',
]);
STANDARD_COUNTRY_SET.delete('GB');
STANDARD_COUNTRY_SET.delete('AE');

export function normalizeCountry(raw: string): string {
    if (!raw) return '未命名';
    const cleaned = raw
        .replace(/【[^】]*】/g, '')
        .replace(/\[.*?\]/g, '')
        .trim()
        .toUpperCase();
    if (STANDARD_COUNTRY_SET.has(cleaned)) return cleaned;
    const alias = COUNTRY_ALIAS[cleaned];
    if (alias) return alias;
    return '未命名';
}

export function calcCountry(seriesName: string): string {
    if (!seriesName) return '未命名';
    const dashIdx = seriesName.indexOf('-');
    const raw = dashIdx === -1 ? seriesName.trim() : seriesName.substring(0, dashIdx).trim();
    return normalizeCountry(raw).slice(0, 100);
}

export const AGENT_KEYWORDS = ['JY', 'LMC', 'MixHD', 'Netjoy', 'SMB', 'Tecdo', 'TTO', 'XB', 'YS'] as const;

export function calcAgent(seriesName: string): string {
    if (!seriesName) return '';
    for (const agent of AGENT_KEYWORDS) {
        if (seriesName.includes(agent)) {
            return agent;
        }
    }
    return '其他';
}

export function calcBidType(seriesName: string): string {
    if (!seriesName) return '';
    if (seriesName.includes('-LC-')) return 'LC';
    if (seriesName.includes('-CC-')) return 'CC';
    return '';
}

export function calcMaterialType(cleanedName: string): string {
    if (!cleanedName) return '';
    if (/studio/i.test(cleanedName)) return 'studio';
    if (/全球演员/.test(cleanedName)) return '全球演员';
    const match = cleanedName.match(/UGC|AIGC|Story|Repurposed|-AE-/);
    if (match) return match[0].replace(/-/g, '');
    return '';
}

export function calcNewOrActive(adGroupName: string): string {
    if (!adGroupName) return '其他';
    if (adGroupName.includes('拉新')) return '拉新';
    if (adGroupName.includes('拉活')) return '拉活';
    if (adGroupName.includes('历史')) return '历史';
    return '其他';
}

export function calcMaterialDirection(creativeName: string): string {
    if (!creativeName) return '';
    const parts = creativeName.split('-');
    if (parts.length < 2) return 'General';
    const raw = parts[1].trim().toUpperCase();
    if (raw.includes('TTS')) return 'TTS';
    if (raw.includes('NONSHOP')) return 'Nonshop';
    return 'General';
}

export function calcBcDirection(creativeName: string): string {
    if (!creativeName) return '';
    const parts = creativeName.split('-');
    if (parts.length < 2) return 'C';
    const raw = parts[1].trim().toUpperCase();
    if (raw.includes('TTS') || raw.includes('NONSHOP')) return 'B';
    return 'C';
}

export function calcMaterialCategory(source: string): string {
    if (!source) return '其他';
    if (/studio/i.test(source)) return 'UGC';
    if (source.includes('全球演员')) return 'UGC';
    if (/Story/i.test(source)) return 'UGC';
    const match = source.match(/UGC|AIGC|AE|Story|Repurposed/i);
    if (match) return match[0];
    return '其他';
}

export function calcPlacement(seriesName: string): string {
    if (!seriesName) return '其他';
    const codes = ['HL', 'GM', 'CLJ', 'LZJ', 'JJ', 'LSY', 'ZZ', 'LYX', 'WR'];
    const segments = seriesName.split('-').map((s) => s.trim());
    for (const code of codes) {
        if (segments.includes(code)) return code;
    }
    return '其他';
}

export function calcSecondaryCategory(creativeName: string): string {
    if (!creativeName) return '未命名';
    if (creativeName.includes('未认知用户')) return '未认知用户';
    if (creativeName.includes('认知用户')) return '认知用户';
    if (/New_eM[AM]{1,2}/i.test(creativeName)) return 'New_eMAA';
    if (creativeName.includes('Retain')) return 'Retain';
    if (creativeName.includes('Incubate eMAA')) return 'Incubate eMAA';
    if (creativeName.includes('Reactive eMAA')) return 'Reactive eMAA';
    return '未命名';
}

export function calcTertiaryCategory(creativeName: string): string {
    if (!creativeName) return '未命名';
    if (creativeName.includes('功能焦虑型')) return '功能顾虑型';
    if (creativeName.includes('建立认知')) return '建立认知';
    if (creativeName.includes('效果顾虑型')) return '效果顾虑型';
    if (creativeName.includes('营销活动')) return '营销活动';
    if (creativeName.includes('操作顾虑型')) return '操作顾虑型';
    if (creativeName.includes('功能顾虑型')) return '功能顾虑型';
    if (creativeName.includes('认知纠偏')) return '认知纠偏';
    if (creativeName.includes('新的增长机会')) return '新的增长机会';
    if (creativeName.includes('打造creator人设')) return '打造creator人设';
    return '未命名';
}

export function calcDateValue(recordDate: string | number): string {
    return parseDateFlex(recordDate);
}

export function calcMaterialDate(creativeName: string): string {
    if (!creativeName) return '';
    const cleaned = creativeName.replace(/－/g, '-').replace(/[\u3000 ]/g, '').trim();
    const qMatch = cleaned.match(/(?:^|[^\d])(\d{2})Q/);
    const mMatch = cleaned.match(/M(\d{1,2})-/);
    const dayPartMatch = cleaned.match(/M\d{1,2}-(\d{1,2})/);
    if (qMatch && mMatch && dayPartMatch) {
        const month = parseInt(mMatch[1], 10);
        const day = parseInt(dayPartMatch[1], 10);
        if (month < 1 || month > 12 || day < 1 || day > 31) return '';
        const year = '20' + qMatch[1];
        return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
    }
    return '';
}

export function calcCreativeIdentityId(cleanedMaterialName: string): string {
    if (!cleanedMaterialName) return '未命名';
    const trimmed = cleanedMaterialName.trim();
    const lastDashIdx = trimmed.lastIndexOf('-');
    const candidate = lastDashIdx === -1 ? trimmed : trimmed.slice(lastDashIdx + 1).trim();
    if (!candidate) return '未命名';
    if (/^\d{1,2}Q\d$/i.test(candidate)) return '未命名';
    if (/^M\d+$/i.test(candidate)) return '未命名';
    if (/^\d+[a-zA-Z一-鿿]+$/.test(candidate)) return candidate;
    if (/^\d+[一-鿿]+$/.test(candidate)) return candidate;
    if (/^\d+[a-zA-Z]+[一-鿿]+$/.test(candidate)) return candidate;
    if (/^\d+[一-鿿]+[a-zA-Z]+$/.test(candidate)) return candidate;
    return '未命名';
}

export function resolveCreativeIdentityId(
    cleanedMaterialName: string,
    registryMap: Map<string, string>,
): string {
    const fromName = calcCreativeIdentityId(cleanedMaterialName);
    if (fromName !== '未命名') return fromName;
    const key = cleanedMaterialName?.trim() ?? '';
    if (key) {
        const matched = registryMap.get(key);
        if (matched && isValidCreativeIdentityId(matched)) {
            return matched;
        }
    }
    return '未匹配';
}

const CREATIVE_ID_SPECIAL_VALUES = new Set(['未命名', '未匹配', 'ID错误', '']);

export function isCreativeIdentityIdSpecial(id: string | null | undefined): boolean {
    if (!id) return true;
    return CREATIVE_ID_SPECIAL_VALUES.has(id);
}

export function isValidCreativeIdentityId(id: string): boolean {
    if (!id || isCreativeIdentityIdSpecial(id)) return false;
    if (/^\d{1,2}Q\d$/i.test(id)) return false;
    if (/^M\d+$/i.test(id)) return false;
    if (/^\d+[a-zA-Z一-鿿]+$/.test(id)) return true;
    if (/^\d+[一-鿿]+$/.test(id)) return true;
    if (/^\d+[a-zA-Z]+[一-鿿]+$/.test(id)) return true;
    if (/^\d+[一-鿿]+[a-zA-Z]+$/.test(id)) return true;
    return false;
}
