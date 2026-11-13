/**
 * The rich-text schema for exhibition/fair content. Used by the editor (browser),
 * the public renderer, and the seed/sanitizer (Node) so all three agree exactly.
 */
import { Node, mergeAttributes, type Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Paragraph from '@tiptap/extension-paragraph';
import Bold from '@tiptap/extension-bold';
import { BulletList, OrderedList } from '@tiptap/extension-list';

export type ParagraphVariant = 'default' | 'italic' | 'lead';

const VARIANT_CLASS: Record<ParagraphVariant, string | null> = {
    default: null,
    italic: 'italic',
    lead: 'italic text-lg',
};

/** Paragraph with a presentation variant: plain, italic, or large italic ("lead"). */
export const StyledParagraph = Paragraph.extend({
    addAttributes() {
        return {
            variant: {
                default: 'default' satisfies ParagraphVariant,
                parseHTML: (el: HTMLElement): ParagraphVariant => {
                    const cls = el.getAttribute('class') ?? '';
                    if (/\bitalic\b/.test(cls) && /\btext-lg\b/.test(cls)) return 'lead';
                    if (/\bitalic\b/.test(cls)) return 'italic';
                    return 'default';
                },
                renderHTML: (attrs: { variant?: ParagraphVariant }) => {
                    const cls = VARIANT_CLASS[attrs.variant ?? 'default'];
                    return cls ? { class: cls } : {};
                },
            },
        };
    },
});

/** Bold that also understands the legacy `<span class="font-bold">`. */
export const LegacyBold = Bold.extend({
    parseHTML() {
        return [...(this.parent?.() ?? []), { tag: 'span.font-bold' }];
    },
});

export type ListSize = 'default' | 'sm' | 'xs';
const LIST_SIZE_CLASS: Record<ListSize, string | null> = { default: null, sm: 'text-sm', xs: 'text-xs' };

/** Lists can be set in smaller type (footnotes, reading lists). */
const sizeAttribute = {
    size: {
        default: 'default' satisfies ListSize,
        parseHTML: (el: HTMLElement): ListSize => {
            const cls = el.getAttribute('class') ?? '';
            if (/\btext-xs\b/.test(cls)) return 'xs';
            if (/\btext-sm\b/.test(cls)) return 'sm';
            return 'default';
        },
        renderHTML: (attrs: { size?: ListSize }) => {
            const cls = LIST_SIZE_CLASS[attrs.size ?? 'default'];
            return cls ? { class: cls } : {};
        },
    },
};

export const SizedBulletList = BulletList.extend({
    addAttributes() {
        return { ...this.parent?.(), ...sizeAttribute };
    },
}).configure({ HTMLAttributes: { class: 'list-disc ml-5 mb-3' } });

export const SizedOrderedList = OrderedList.extend({
    addAttributes() {
        return { ...this.parent?.(), ...sizeAttribute };
    },
    parseHTML() {
        // Legacy markup sometimes numbered a <ul> with Tailwind's list-decimal.
        return [...(this.parent?.() ?? []), { tag: 'ul.list-decimal', priority: 60 }];
    },
}).configure({ HTMLAttributes: { class: 'list-decimal ml-6 mb-3' } });

/** Image with caption. */
export const Figure = Node.create({
    name: 'figure',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return {
            src: { default: null },
            alt: { default: '' },
            caption: { default: '' },
        };
    },
    parseHTML() {
        return [
            {
                tag: 'figure',
                getAttrs: (el: HTMLElement) => {
                    const img = el.querySelector('img');
                    if (!img?.getAttribute('src')) return false;
                    return {
                        src: img.getAttribute('src'),
                        alt: (img.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim(),
                        caption: (el.querySelector('figcaption')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
                    };
                },
            },
        ];
    },
    renderHTML({ node }) {
        const { src, alt, caption } = node.attrs as { src: string; alt: string; caption: string };
        const img = ['img', { src, alt, class: 'max-w-full h-auto mx-auto mb-3', loading: 'lazy' }];
        return caption
            ? ['figure', { 'data-figure': '' }, img, ['figcaption', { class: 'mb-6 text-center font-roboto font-light text-xs' }, caption]]
            : ['figure', { 'data-figure': '' }, img];
    },
});

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

/** Embedded YouTube video (16:9). */
export const Video = Node.create({
    name: 'video',
    group: 'block',
    atom: true,
    draggable: true,
    addAttributes() {
        return { youtubeId: { default: null } };
    },
    parseHTML() {
        return [
            {
                tag: 'div[data-video]',
                getAttrs: (el: HTMLElement) => {
                    const id = el.getAttribute('data-video') ?? '';
                    return YOUTUBE_ID.test(id) ? { youtubeId: id } : false;
                },
            },
        ];
    },
    renderHTML({ node }) {
        const id = String(node.attrs.youtubeId ?? '');
        if (!YOUTUBE_ID.test(id)) return ['div', { 'data-video': '' }];
        return [
            'div',
            { 'data-video': id, class: 'relative w-full h-0 mb-6', style: 'padding-top: 56.5%' },
            [
                'iframe',
                {
                    class: 'absolute top-0 left-0 w-full h-full',
                    src: `https://www.youtube.com/embed/${id}?rel=0&autoplay=0`,
                    title: 'YouTube video player',
                    frameborder: '0',
                    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
                    allowfullscreen: 'true',
                },
            ],
        ];
    },
});

/** Artist bio section: italic paragraphs set apart at the end of the text. */
export const Bio = Node.create({
    name: 'bio',
    group: 'block',
    content: 'paragraph+',
    defining: true,
    parseHTML() {
        return [{ tag: 'div[data-bio]' }];
    },
    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-bio': '', class: 'mt-10' }), 0];
    },
});

/** Placeholder for the list of press items linked to this exhibition (rendered by the app). */
export const PressList = Node.create({
    name: 'pressList',
    group: 'block',
    atom: true,
    parseHTML() {
        return [{ tag: 'div[data-press-list]' }];
    },
    renderHTML() {
        return ['div', { 'data-press-list': '' }];
    },
});

export interface RichOptions {
    /** News posts: no bio, press list or video blocks. */
    news?: boolean;
}

export function richExtensions(opts: RichOptions = {}): Extensions {
    const blocks = opts.news ? [Figure] : [Figure, Video, Bio, PressList];
    return [
        StarterKit.configure({
            paragraph: false,
            bold: false,
            heading: false,
            code: false,
            codeBlock: false,
            blockquote: false,
            horizontalRule: false,
            strike: false,
            underline: false,
            bulletList: false,
            orderedList: false,
            listItem: { HTMLAttributes: { class: 'mb-2' } },
            link: {
                openOnClick: false,
                autolink: true,
                protocols: ['http', 'https', 'mailto'],
                HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
            },
        }),
        StyledParagraph,
        LegacyBold,
        SizedBulletList,
        SizedOrderedList,
        ...blocks,
    ];
}
