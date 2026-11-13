import sanitizeHtml from 'sanitize-html';

/** Allowed markup for news post bodies (rendered with v-html on the site). */
const NEWS_OPTIONS: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'br', 'a', 'em', 'i', 'strong', 'b', 'ul', 'ol', 'li', 'img', 'div', 'span'],
    allowedAttributes: {
        a: ['href', 'target', 'rel', 'class'],
        img: ['src', 'alt', 'width', 'height', 'loading'],
        div: ['class'],
        span: ['class'],
    },
    allowedClasses: {
        a: ['font-bold'],
        div: ['align-left', 'align-right', 'align-center'],
        span: ['font-bold', 'italic'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    allowProtocolRelative: false,
    // Drop empty anchors left behind by malformed markup like `<a/>`.
    exclusiveFilter: (frame) => frame.tag === 'a' && !frame.attribs.href && !frame.text.trim(),
    transformTags: {
        // Links that open a new tab must not give the new page access to window.opener.
        a: (tagName, attribs) => {
            const attrs = { ...attribs };
            if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
            return { tagName, attribs: attrs };
        },
    },
};

export function sanitizeNewsHtml(html: string): string {
    return sanitizeHtml(html, NEWS_OPTIONS).trim();
}
