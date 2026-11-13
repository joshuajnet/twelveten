import { computed, type MaybeRefOrGetter, toValue } from 'vue';
import { useHead } from '@unhead/vue';
import { buildMeta, type MetaInput } from '@twelveten/shared';

/** Keeps document.title and social meta tags in sync with the page being viewed. */
export function useMeta(input: MaybeRefOrGetter<MetaInput | null>) {
    const tags = computed(() => {
        const value = toValue(input);
        return value ? buildMeta(value, { siteUrl: window.location.origin }) : null;
    });
    useHead(() => {
        const t = tags.value;
        if (!t) return {};
        return {
            title: t.title,
            link: [{ rel: 'canonical', href: t.canonical }],
            meta: [
                { name: 'description', content: t.description },
                { property: 'og:title', content: t.title },
                { property: 'og:type', content: t.ogType },
                { property: 'og:url', content: t.canonical },
                { property: 'og:description', content: t.description },
                { property: 'og:image', content: t.image },
                { property: 'og:image:alt', content: t.imageAlt },
                { name: 'twitter:card', content: 'summary_large_image' },
                { name: 'twitter:title', content: t.title },
                { name: 'twitter:description', content: t.description },
                { name: 'twitter:image', content: t.image },
                ...(t.robots ? [{ name: 'robots', content: t.robots }] : []),
            ],
            script: t.jsonLd ? [{ type: 'application/ld+json', innerHTML: JSON.stringify(t.jsonLd) }] : [],
        };
    });
    return tags;
}
