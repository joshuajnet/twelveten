// CloudFront Function (viewer request) for the default (site bucket) behaviour.
// - requests for a host in REDIRECT_HOSTS (the bare domain) redirect to the same URL on CANONICAL_HOST
// - legacy URLs redirect permanently
// - extensionless paths map to their prerendered page: /exhibitions/foo -> /exhibitions/foo/index.html
// - /admin and /admin/* (sign-in and back office) and /rooms/* (private viewing rooms) serve the SPA shell
// Keep REDIRECTS in sync with packages/shared/src/routes.ts.
// Filled in at deploy time by function-code.cjs from the stage's domain and redirectDomains.
var CANONICAL_HOST = '';
var REDIRECT_HOSTS = [];

var REDIRECTS = {
    '/the-veil': '/exhibitions/the-veil',
    '/exhibitions/the-vei': '/exhibitions/the-veil',
};

function queryString(qs) {
    var parts = [];
    for (var key in qs) {
        var values = qs[key].multiValue ? qs[key].multiValue : [qs[key]];
        for (var i = 0; i < values.length; i++) parts.push(values[i].value === '' ? key : key + '=' + values[i].value);
    }
    return parts.length ? '?' + parts.join('&') : '';
}

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    var host = request.headers && request.headers.host ? request.headers.host.value.toLowerCase() : '';
    if (CANONICAL_HOST && REDIRECT_HOSTS.indexOf(host) !== -1) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: {
                location: { value: 'https://' + CANONICAL_HOST + uri + queryString(request.querystring || {}) },
                'cache-control': { value: 'public, max-age=86400' },
            },
        };
    }
    var clean = uri.length > 1 ? uri.replace(/\/+$/, '') : uri;

    if (REDIRECTS[clean]) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { location: { value: REDIRECTS[clean] }, 'cache-control': { value: 'public, max-age=86400' } },
        };
    }

    // The admin pages (login and back office) and viewing rooms are the SPA shell, never prerendered.
    if (clean === '/admin' || clean.indexOf('/admin/') === 0 || clean.indexOf('/rooms/') === 0) {
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
