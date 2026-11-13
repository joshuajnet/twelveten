import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, type UploadRequest } from '@twelveten/shared';
import { adminApi } from './api';

export type UploadKind = 'image' | 'video' | 'pdf' | 'media';

const ACCEPT: Record<UploadKind, string> = {
    image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
    video: 'video/mp4',
    pdf: 'application/pdf',
    media: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4',
};

/** Ask the browser for files. */
export function pickFiles(kind: UploadKind, multiple = false): Promise<File[]> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = ACCEPT[kind];
        input.multiple = multiple;
        input.onchange = () => resolve(Array.from(input.files ?? []));
        input.click();
    });
}

/** Upload a file straight to S3 via a presigned URL; resolves with its public URL. */
export async function uploadFile(file: File, onProgress?: (fraction: number) => void): Promise<string> {
    if (!(file.type in UPLOAD_TYPES)) throw new Error(`${file.name}: this file type can't be uploaded`);
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`${file.name}: files must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`);
    const ticket = await adminApi.upload({ filename: file.name, contentType: file.type as UploadRequest['contentType'], size: file.size });
    await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', ticket.uploadUrl);
        for (const [k, v] of Object.entries(ticket.headers)) xhr.setRequestHeader(k, v);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error('Upload failed (network error)'));
        xhr.send(file);
    });
    return ticket.url;
}
