import type {
    Artwork,
    Exhibition,
    ExhibitionEvent,
    ExhibitionSummary,
    HomePage,
    NewsPost,
    PressItem,
} from '@twelveten/shared';
import { richToHtmlServer } from '@twelveten/shared/rich/server';
import type {
    ArtworkRow,
    ExhibitionEventRow,
    ExhibitionRow,
    HomePageRow,
    NewsPostRow,
    PressItemRow,
} from '../db/types.ts';

const iso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : v);

export function toSummary(r: ExhibitionRow): ExhibitionSummary {
    return {
        id: r.id,
        slug: r.slug,
        kind: r.kind,
        artists: r.artists,
        title: r.title,
        subtitle: r.subtitle,
        titleFirst: r.title_first,
        locationText: r.location_text,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        timezone: r.timezone,
        thumbnail: r.thumbnail,
        heroImage: r.hero_image,
        heroAlt: r.hero_alt,
        published: r.published,
    };
}

export function toEvent(r: ExhibitionEventRow): ExhibitionEvent {
    return { id: r.id, label: r.label, startsAt: iso(r.starts_at), endsAt: r.ends_at ? iso(r.ends_at) : null, position: r.position };
}

export function toArtwork(r: ArtworkRow): Artwork {
    return {
        id: r.id,
        exhibitionId: r.exhibition_id,
        position: r.position,
        image: r.image,
        video: r.video,
        alt: r.alt,
        author: r.author,
        title: r.title,
        dateText: r.date_text,
        dimensions: r.dimensions,
        media: r.media,
        credit: r.credit,
        hidden: r.hidden,
        available: r.available,
        updatedAt: r.updated_at,
    };
}

export function toPress(r: PressItemRow): PressItem {
    return {
        id: r.id,
        outlet: r.outlet,
        title: r.title,
        url: r.url,
        publishedOn: r.published_on,
        issueLabel: r.issue_label,
        byline: r.byline,
        exhibitionId: r.exhibition_id,
        published: r.published,
        updatedAt: r.updated_at,
    };
}

export function toExhibition(
    r: ExhibitionRow,
    children: { events: ExhibitionEventRow[]; artworks: ArtworkRow[]; press: PressItemRow[] },
): Exhibition {
    return {
        ...toSummary(r),
        hoursText: r.hours_text,
        venueText: r.venue_text,
        pressReleaseUrl: r.press_release_url,
        headerLinks: r.header_links,
        showInquire: r.show_inquire,
        slideshowVisible: r.slideshow_visible,
        worksAvailable: r.works_available,
        content: r.content,
        contentHtml: richToHtmlServer(r.content),
        seoTitle: r.seo_title,
        seoDescription: r.seo_description,
        ogImage: r.og_image,
        updatedAt: r.updated_at,
        events: children.events.map(toEvent),
        artworks: children.artworks.map(toArtwork),
        press: children.press.map(toPress),
    };
}

export function toNews(r: NewsPostRow): NewsPost {
    return {
        id: r.id,
        slug: r.slug,
        title: r.title,
        publishedAt: r.published_at,
        bodyHtml: r.body_html,
        seoTitle: r.seo_title,
        seoDescription: r.seo_description,
        ogImage: r.og_image,
        published: r.published,
        updatedAt: r.updated_at,
    };
}

export function toHome(r: HomePageRow, link: ExhibitionRow | undefined): HomePage {
    return {
        bgImage: r.bg_image,
        bgImageMobile: r.bg_image_mobile,
        bgFocalPoint: r.bg_focal_point,
        headline: r.headline,
        subline: r.subline,
        extraText: r.extra_text,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        textColor: r.text_color,
        link: link ? { id: link.id, slug: link.slug, kind: link.kind, startsOn: link.starts_on, endsOn: link.ends_on } : null,
        seoTitle: r.seo_title,
        seoDescription: r.seo_description,
        ogImage: r.og_image,
        updatedAt: r.updated_at,
    };
}
