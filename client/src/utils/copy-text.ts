export function copyToClipboard(text: string): Promise<boolean> {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard
            .writeText(text)
            .then(() => true)
            .catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
}

function legacyCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
        ok = document.execCommand('copy');
    } catch {
        ok = false;
    }
    document.body.removeChild(textarea);
    return ok;
}
