// CloudFront Function (viewer request) for the default (site bucket) behaviour.
// - legacy URLs redirect permanently
// - extensionless paths map to their prerendered page: /exhibitions/foo -> /exhibitions/foo/index.html
// Keep REDIRECTS in sync with packages/shared/src/routes.ts.
var REDIRECTS = {
    '/the-veil': '/exhibitions/the-veil',
    '/exhibitions/the-vei': '/exhibitions/the-veil',
    '/admin': '/admin/login',
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

    // The admin login page is the SPA shell (not prerendered).
    if (clean === '/admin/login') {
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
