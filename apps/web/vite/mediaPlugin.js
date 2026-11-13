/**
 * Serves /media/images/* and /media/docs/* from the local `.media/` folder in development
 * (in production they come from the media bucket via CloudFront). Uploads (/media/uploads/*)
 * are proxied to the LocalStack bucket instead. Supports Range requests for video.
 */
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const TYPES = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
};

export default function mediaPlugin({ dir }) {
    const root = resolve(dir);
    const middleware = (req, res, next) => {
        const url = decodeURIComponent((req.url ?? '').split('?')[0]);
        const m = /^\/media\/((?:images|docs)\/.+)$/.exec(url);
        if (!m) return next();
        const file = normalize(join(root, m[1]));
        if (!file.startsWith(root)) return next();
        let stat;
        try {
            stat = statSync(file);
        } catch {
            res.statusCode = 404;
            return res.end('Not found');
        }
        if (!stat.isFile()) return next();
        res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
        if (range) {
            const start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
            const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
            if (start > end || start >= stat.size) {
                res.statusCode = 416;
                res.setHeader('Content-Range', `bytes */${stat.size}`);
                return res.end();
            }
            res.statusCode = 206;
            res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
            res.setHeader('Content-Length', end - start + 1);
            return createReadStream(file, { start, end }).pipe(res);
        }
        res.setHeader('Content-Length', stat.size);
        createReadStream(file).pipe(res);
    };
    return {
        name: 'twelveten-media',
        configureServer(server) {
            server.middlewares.use(middleware);
        },
        configurePreviewServer(server) {
            server.middlewares.use(middleware);
        },
    };
}
