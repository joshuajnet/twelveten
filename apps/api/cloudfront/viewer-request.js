// CloudFront Function (viewer request) for the default (site bucket) behaviour.
// - legacy URLs redirect permanently
// - extensionless paths map to their prerendered page: /exhibitions/foo -> /exhibitions/foo/index.html
// - /admin and /admin/* (sign-in and back office) serve the SPA shell
// Keep REDIRECTS in sync with packages/shared/src/routes.ts.
var REDIRECTS = {
    '/the-veil': '/exhibitions/the-veil',
    '/exhibitions/the-vei': '/exhibitions/the-veil',
};

function handler(event) {
    var request = event.request;
    var uri = request.uri;
    var clean = uri.length > 1 ? uri.replace(/\/+$/, '') : uri;

    if (REDIRECTS[clean]) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: REDIRECTS[clean] }, 'cache-control': { value: 'public, max-age=86400' } },
        };
    }

    // The admin pages (login and back office) are the SPA shell, never prerendered.
    if (clean === '/admin' || clean.indexOf('/admin/') === 0) {
        request.uri = '/index.html';
        return request;
    }

    var last = clean.split('/').pop();
    if (clean === '/' || clean === '') {
        request.uri = '/index.html';
    } else if (last.indexOf('.') === -1) {
        request.uri = clean + '/index.html';
    }
    return request;
}
