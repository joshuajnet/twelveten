import { adminSend } from '@/api/client';
import { reactive, ref } from 'vue';
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, type UploadRequest } from '@twelveten/shared';
import { adminApi, errorMessage } from './api';
import { toast } from './state';

export type UploadKind = 'image' | 'video' | 'pdf' | 'media' | 'document';

const ACCEPT: Record<UploadKind, string> = {
    image: 'image/jpeg,image/png,image/webp,image/gif,image/svg+xml',
    video: 'video/mp4',
    pdf: 'application/pdf',
    /** A PDF or an image (e.g. a scanned article). */
    document: 'application/pdf,image/jpeg,image/png,image/webp',
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
    // Image derivatives (sizes and the zoom copy): made here in development, by an S3-triggered
    // function in production. Not waited for; pages fall back to the original until they exist.
    if (file.type.startsWith('image/')) void adminSend('POST', '/uploads/complete', { url: ticket.url }).catch(() => {});
    return ticket.url;
}

/** A readable default alt text from a file name: 'studio_view-2.jpg' → 'studio view 2'. */
export const altFromFilename = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');

/**
 * Pick several files and upload them one by one, showing each in `uploads` (name and progress, for
 * `UploadProgress`) until it is done. `onUploaded` saves each one; failures are toasted per file.
 */
export function useUploadQueue() {
    const uploads = ref<{ name: string; progress: number }[]>([]);

    async function pickAndUpload(kind: UploadKind, onUploaded: (url: string, file: File) => Promise<void> | void) {
        for (const file of await pickFiles(kind, true)) {
            const entry = reactive({ name: file.name, progress: 0 });
            uploads.value.push(entry);
            try {
                await onUploaded(await uploadFile(file, (f) => (entry.progress = f)), file);
            } catch (e) {
                toast(`${file.name}: ${errorMessage(e)}`, 'error');
            } finally {
                uploads.value = uploads.value.filter((u) => u !== entry);
            }
        }
    }

    return { uploads, pickAndUpload };
}
