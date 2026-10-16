export const MAX_UPLOAD_FILE_SIZE = 50 * 1024 * 1024;

export const validateUploadFile = (file: File): string | null => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
        return `不支持的文件格式：${file.name}（仅支持 xlsx / xls / csv）`;
    }
    if (file.size === 0) {
        return `文件为空：${file.name}`;
    }
    if (file.size > MAX_UPLOAD_FILE_SIZE) {
        return `文件过大：${file.name}（${(file.size / 1024 / 1024).toFixed(1)}MB），超过 50MB 限制，请拆分后上传`;
    }
    return null;
};
