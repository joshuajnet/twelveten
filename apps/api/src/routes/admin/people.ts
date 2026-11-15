import { Hono } from 'hono';
import type { Transaction } from 'kysely';
import {
    addressAttachSchema,
    addressLinkPatchSchema,
    addressPatchSchema,
    addressEntity,
    artistExhibitionsPutSchema,
    artistPressAddSchema,
    artistProfilePutSchema,
    collectorProfilePutSchema,
    personCreateSchema,
    personPatchSchema,
    profileFilter,
    PEOPLE_PAGE_SIZE,
    type AddressEntity,
} from '@twelveten/shared';
import { sanitizeRichDoc } from '@twelveten/shared/rich/server';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import type { Database } from '../../db/types.ts';
import { addressesFor, getPerson, listPersons, toAddress, type PersonSort } from '../../people/queries.ts';
import { renderCvPdf } from '../../people/cvPdf.ts';
import { body, HttpError } from './errors.ts';
import { ensureBaseline, recordRevision } from './revisions.ts';
import { columns, conflictOr404, ensureCollectorProfile, isUuid, sameVersion, uniqueSlug } from './util.ts';

const PERSON_COLUMNS = {
    name: 'name',
    sortName: 'sort_name',
    birthDate: 'birth_date',
    birthPlace: 'birth_place',
    email: 'email',
    phone: 'phone',
    website: 'website',
    portrait: 'portrait',
    notes: 'notes',
} as const;

const ADDRESS_COLUMNS = {
    line1: 'line1',
    line2: 'line2',
    city: 'city',
    region: 'region',
    postalCode: 'postal_code',
    country: 'country',
    notes: 'notes',
} as const;

const EMPTY_DOC = JSON.stringify({ type: 'doc', content: [] });

/** Snapshot of an artist profile for revisions: the row plus its linked exhibitions and press. */
async function profileSnapshot(trx: Transaction<Database> | DB, personId: string) {
    const row = await trx.selectFrom('artist_profiles').selectAll().where('person_id', '=', personId).executeTakeFirst();
    if (!row) return null;
    const links = await trx.selectFrom('exhibition_artists').select('exhibition_id').where('artist_id', '=', personId).orderBy('position').execute();
    const press = await trx.selectFrom('press_artists').select('press_item_id').where('artist_id', '=', personId).orderBy('created_at').execute();
    return { ...row, exhibition_ids: links.map((l) => l.exhibition_id), press_ids: press.map((p) => p.press_item_id) };
}

/** Owners an address can be attached to must exist. */
async function ownerExists(db: Pick<DB, 'selectFrom'>, entity: AddressEntity, id: string): Promise<boolean> {
    switch (entity) {
        case 'person':
            return Boolean(await db.selectFrom('persons').select('id').where('id', '=', id).executeTakeFirst());
    }
}

/** Keep one primary per owner: clearing the others before setting a new one. */
async function clearPrimary(trx: Transaction<Database>, entity: AddressEntity, entityId: string, exceptLinkId?: string) {
    let q = trx.updateTable('address_links').set({ is_primary: false }).where('entity', '=', entity).where('entity_id', '=', entityId).where('is_primary', '=', true);
    if (exceptLinkId) q = q.where('id', '!=', exceptLinkId);
    await q.execute();
}

export function peopleRoutes() {
    const app = new Hono<AppEnv>();

    const personOr404 = async (db: DB, id: string) => {
        const person = isUuid(id) ? await getPerson(db, id) : null;
        if (!person) throw new HttpError(404, 'Not found');
        return person;
    };

    // ---------- People ----------

    app.get('/persons', async (c) => {
        const profile = c.req.query('profile');
        const parsedProfile = profile ? profileFilter.safeParse(profile) : null;
        if (parsedProfile && !parsedProfile.success) throw new HttpError(400, 'Unknown profile type');
        const sort = c.req.query('sort') ?? 'name';
        if (!['name', 'updated'].includes(sort)) throw new HttpError(400, 'Unknown sort');
        const page = Number(c.req.query('page') ?? 1);
        const pageSize = Number(c.req.query('limit') ?? PEOPLE_PAGE_SIZE);
        if (!Number.isInteger(page) || page < 1) throw new HttpError(400, 'Invalid page');
        if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new HttpError(400, 'limit must be 1–100');
        const q = c.req.query('q')?.trim() || undefined;
        return c.json(await listPersons(c.var.db, { profile: parsedProfile?.data, q, sort: sort as PersonSort }, page, pageSize));
    });

    app.post('/persons', async (c) => {
        const input = await body(c, personCreateSchema);
        const db = c.var.db;
        const wantsArtist = input.profiles?.includes('artist');
        const slug = wantsArtist ? await uniqueSlug(db, 'artist_profiles', input.name) : null;
        const id = await db.transaction().execute(async (trx) => {
            const created = await trx
                .insertInto('persons')
                .values(columns(input, PERSON_COLUMNS) as never)
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'person', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
            if (slug) {
                const profile = await trx.insertInto('artist_profiles').values({ person_id: created.id, slug }).returningAll().executeTakeFirstOrThrow();
                await recordRevision(trx, { entity: 'artist_profile', entityId: created.id, action: 'create', snapshot: { ...profile, exhibition_ids: [] }, userId: c.var.userId });
            }
            if (input.profiles?.includes('collector')) await ensureCollectorProfile(trx, created.id);
            return created.id;
        });
        return c.json(await getPerson(db, id), 201);
    });

    app.get('/persons/:id', async (c) => c.json(await personOr404(c.var.db, c.req.param('id'))));

    app.patch('/persons/:id', async (c) => {
        const id = c.req.param('id');
        const patch = await body(c, personPatchSchema);
        const db = c.var.db;
        await personOr404(db, id);
        const values = columns(patch, PERSON_COLUMNS);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const row = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'person', id, () => trx.selectFrom('persons').selectAll().where('id', '=', id).executeTakeFirst());
            const updated = await trx.updateTable('persons').set(values).where('id', '=', id).where(sameVersion(patch.updatedAt)).returningAll().executeTakeFirst();
            if (updated) await recordRevision(trx, { entity: 'person', entityId: id, action: 'update', snapshot: updated, userId: c.var.userId });
            return updated;
        });
        if (!row) return conflictOr404(true, () => getPerson(db, id));
        return c.json(await getPerson(db, id));
    });

    app.delete('/persons/:id', async (c) => {
        const id = c.req.param('id');
        const db = c.var.db;
        await personOr404(db, id);
        if (await db.selectFrom('artist_profiles').select('person_id').where('person_id', '=', id).executeTakeFirst()) {
            throw new HttpError(409, 'Remove the artist profile before deleting this person');
        }
        if (await db.selectFrom('invoices').select('id').where('person_id', '=', id).executeTakeFirst()) {
            throw new HttpError(409, 'This person has invoices and can’t be deleted');
        }
        await db.transaction().execute(async (trx) => {
            const existing = await trx.selectFrom('persons').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'person', entityId: id, action: 'delete', snapshot: existing, userId: c.var.userId });
            await trx.deleteFrom('collector_profiles').where('person_id', '=', id).execute();
            await trx.deleteFrom('persons').where('id', '=', id).execute();
        });
        return c.body(null, 204);
    });

    // ---------- Collector profile ----------

    app.put('/persons/:id/collector-profile', async (c) => {
        const id = c.req.param('id');
        const input = await body(c, collectorProfilePutSchema);
        const db = c.var.db;
        const person = await personOr404(db, id);
        if (!person.collectorProfile) {
            await db.insertInto('collector_profiles').values({ person_id: id, notes: input.notes ?? null }).execute();
            return c.json(await getPerson(db, id), 201);
        }
        if (!input.updatedAt) throw new HttpError(400, 'updatedAt is required to change an existing profile');
        if (input.notes === undefined) throw new HttpError(400, 'Nothing to update');
        const updated = await db
            .updateTable('collector_profiles')
            .set({ notes: input.notes })
            .where('person_id', '=', id)
            .where(sameVersion(input.updatedAt))
            .returning('person_id')
            .executeTakeFirst();
        if (!updated) return conflictOr404(true, () => getPerson(db, id));
        return c.json(await getPerson(db, id));
    });

    app.delete('/persons/:id/collector-profile', async (c) => {
        const id = c.req.param('id');
        const db = c.var.db;
        const person = await personOr404(db, id);
        if (!person.collectorProfile) throw new HttpError(404, 'This person has no collector profile');
        if (person.collectorProfile.invoices.length) throw new HttpError(409, 'This collector has invoices; the profile can’t be removed');
        await db.deleteFrom('collector_profiles').where('person_id', '=', id).execute();
        return c.json(await getPerson(db, id));
    });

    // ---------- Artist profile ----------

    app.put('/persons/:id/artist-profile', async (c) => {
        const id = c.req.param('id');
        const input = await body(c, artistProfilePutSchema);
        const db = c.var.db;
        const person = await personOr404(db, id);
        const existing = person.artistProfile;
        const values: Record<string, unknown> = {};
        if (input.slug) values.slug = input.slug;
        if (input.inventoryPrefix) values.inventory_prefix = input.inventoryPrefix;
        if (input.bio) values.bio = JSON.stringify(sanitizeRichDoc(input.bio));
        if (input.cv) values.cv = JSON.stringify(sanitizeRichDoc(input.cv));

        if (!existing) {
            const slug = input.slug ?? (await uniqueSlug(db, 'artist_profiles', person.name));
            await db.transaction().execute(async (trx) => {
                const created = await trx
                    .insertInto('artist_profiles')
                    .values({ person_id: id, bio: EMPTY_DOC, cv: EMPTY_DOC, ...values, slug } as never)
                    .returningAll()
                    .executeTakeFirstOrThrow();
                await recordRevision(trx, { entity: 'artist_profile', entityId: id, action: 'create', snapshot: { ...created, exhibition_ids: [] }, userId: c.var.userId });
            });
            return c.json(await getPerson(db, id), 201);
        }

        if (!input.updatedAt) throw new HttpError(400, 'updatedAt is required to change an existing profile');
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const ok = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'artist_profile', id, () => profileSnapshot(trx, id));
            const updated = await trx
                .updateTable('artist_profiles')
                .set(values)
                .where('person_id', '=', id)
                .where(sameVersion(input.updatedAt!))
                .returning('person_id')
                .executeTakeFirst();
            if (updated) await recordRevision(trx, { entity: 'artist_profile', entityId: id, action: 'update', snapshot: await profileSnapshot(trx, id), userId: c.var.userId });
            return Boolean(updated);
        });
        if (!ok) return conflictOr404(true, () => getPerson(db, id));
        return c.json(await getPerson(db, id));
    });

    app.post('/persons/:id/artist-profile/press', async (c) => {
        const id = c.req.param('id');
        const input = await body(c, artistPressAddSchema);
        const db = c.var.db;
        const person = await personOr404(db, id);
        if (!person.artistProfile) throw new HttpError(404, 'This person has no artist profile');
        if (input.pressId && !(await db.selectFrom('press_items').select('id').where('id', '=', input.pressId).executeTakeFirst())) {
            throw new HttpError(400, 'Press item not found');
        }
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'artist_profile', id, () => profileSnapshot(trx, id));
            let pressId = input.pressId;
            if (input.press) {
                // Same article already in press: link that item rather than duplicating it.
                const existing = await trx.selectFrom('press_items').select('id').where('url', '=', input.press.url).executeTakeFirst();
                if (existing) pressId = existing.id;
                else {
                    const p = input.press;
                    const created = await trx
                        .insertInto('press_items')
                        .values({ outlet: p.outlet, title: p.title, url: p.url, published_on: p.publishedOn, issue_label: p.issueLabel ?? null, byline: p.byline ?? null, published: false })
                        .returningAll()
                        .executeTakeFirstOrThrow();
                    await recordRevision(trx, { entity: 'press_item', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
                    pressId = created.id;
                }
            }
            await trx.insertInto('press_artists').values({ press_item_id: pressId!, artist_id: id }).onConflict((oc) => oc.columns(['press_item_id', 'artist_id']).doNothing()).execute();
            await trx.updateTable('artist_profiles').set({ updated_at: new Date() }).where('person_id', '=', id).execute();
            await recordRevision(trx, { entity: 'artist_profile', entityId: id, action: 'update', snapshot: await profileSnapshot(trx, id), userId: c.var.userId });
        });
        return c.json(await getPerson(db, id), 201);
    });

    /** Unlink press from the artist. Press that then belongs nowhere (no artist, no exhibition, not on the site) is deleted. */
    app.delete('/persons/:id/artist-profile/press/:pressId', async (c) => {
        const id = c.req.param('id');
        const pressId = c.req.param('pressId');
        const db = c.var.db;
        const person = await personOr404(db, id);
        if (!person.artistProfile || !isUuid(pressId)) throw new HttpError(404, 'Not found');
        const link = await db.selectFrom('press_artists').select('press_item_id').where('artist_id', '=', id).where('press_item_id', '=', pressId).executeTakeFirst();
        if (!link) throw new HttpError(404, 'That press is not linked to this artist directly');
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'artist_profile', id, () => profileSnapshot(trx, id));
            await trx.deleteFrom('press_artists').where('artist_id', '=', id).where('press_item_id', '=', pressId).execute();
            const item = await trx.selectFrom('press_items').selectAll().where('id', '=', pressId).executeTakeFirstOrThrow();
            const stillLinked = await trx.selectFrom('press_artists').select('artist_id').where('press_item_id', '=', pressId).executeTakeFirst();
            if (!stillLinked && !item.exhibition_id && !item.published) {
                await recordRevision(trx, { entity: 'press_item', entityId: pressId, action: 'delete', snapshot: item, userId: c.var.userId });
                await trx.deleteFrom('press_items').where('id', '=', pressId).execute();
            }
            await trx.updateTable('artist_profiles').set({ updated_at: new Date() }).where('person_id', '=', id).execute();
            await recordRevision(trx, { entity: 'artist_profile', entityId: id, action: 'update', snapshot: await profileSnapshot(trx, id), userId: c.var.userId });
        });
        return c.json(await getPerson(db, id));
    });

    app.delete('/persons/:id/artist-profile', async (c) => {
        const id = c.req.param('id');
        const db = c.var.db;
        const person = await personOr404(db, id);
        if (!person.artistProfile) throw new HttpError(404, 'This person has no artist profile');
        if (person.artistProfile.works.length) throw new HttpError(409, 'Move or delete this artist’s works before removing the profile');
        await db.transaction().execute(async (trx) => {
            await recordRevision(trx, { entity: 'artist_profile', entityId: id, action: 'delete', snapshot: await profileSnapshot(trx, id), userId: c.var.userId });
            await trx.deleteFrom('artist_profiles').where('person_id', '=', id).execute();
        });
        return c.json(await getPerson(db, id));
    });

    app.put('/persons/:id/artist-profile/exhibitions', async (c) => {
        const id = c.req.param('id');
        const { exhibitionIds } = await body(c, artistExhibitionsPutSchema);
        const db = c.var.db;
        const person = await personOr404(db, id);
        if (!person.artistProfile) throw new HttpError(404, 'This person has no artist profile');
        const ids = [...new Set(exhibitionIds)];
        if (ids.length) {
            const found = await db.selectFrom('exhibitions').select('id').where('id', 'in', ids).execute();
            if (found.length !== ids.length) throw new HttpError(400, 'Unknown exhibition');
        }
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'artist_profile', id, () => profileSnapshot(trx, id));
            const before = new Set((await trx.selectFrom('exhibition_artists').select('exhibition_id').where('artist_id', '=', id).execute()).map((r) => r.exhibition_id));
            await trx.deleteFrom('exhibition_artists').where('artist_id', '=', id).where('exhibition_id', 'not in', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']).execute();
            for (const exhibitionId of ids) {
                if (before.has(exhibitionId)) continue;
                // New links go after the exhibition's existing artists.
                const max = await trx
                    .selectFrom('exhibition_artists')
                    .select((eb) => eb.fn.max('position').as('max'))
                    .where('exhibition_id', '=', exhibitionId)
                    .executeTakeFirst();
                await trx.insertInto('exhibition_artists').values({ exhibition_id: exhibitionId, artist_id: id, position: Number(max?.max ?? -1) + 1 }).execute();
            }
            await trx.updateTable('artist_profiles').set({ updated_at: new Date() }).where('person_id', '=', id).execute();
            await recordRevision(trx, { entity: 'artist_profile', entityId: id, action: 'update', snapshot: await profileSnapshot(trx, id), userId: c.var.userId });
        });
        return c.json(await getPerson(db, id));
    });

    app.get('/persons/:id/artist-profile/cv.pdf', async (c) => {
        const person = await personOr404(c.var.db, c.req.param('id'));
        if (!person.artistProfile) throw new HttpError(404, 'This person has no artist profile');
        const pdf = await renderCvPdf(person, person.artistProfile.cv);
        return c.body(new Uint8Array(pdf), 200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${person.artistProfile.slug}-cv.pdf"`,
            'Cache-Control': 'private, no-store',
        });
    });

    // ---------- Addresses ----------

    app.get('/addresses', async (c) => {
        const entity = addressEntity.safeParse(c.req.query('entity'));
        const entityId = c.req.query('id');
        if (!entity.success) throw new HttpError(400, 'Unknown entity');
        if (!isUuid(entityId)) throw new HttpError(400, 'id is required');
        return c.json({ items: await addressesFor(c.var.db, entity.data, entityId) });
    });

    app.post('/addresses', async (c) => {
        const input = await body(c, addressAttachSchema);
        const db = c.var.db;
        if (!(await ownerExists(db, input.entity, input.entityId))) throw new HttpError(404, 'Owner not found');
        await db.transaction().execute(async (trx) => {
            let addressId = input.addressId;
            if (addressId) {
                if (!(await trx.selectFrom('addresses').select('id').where('id', '=', addressId).executeTakeFirst())) throw new HttpError(404, 'Address not found');
            } else {
                const created = await trx.insertInto('addresses').values(columns(input.address!, ADDRESS_COLUMNS) as never).returning('id').executeTakeFirstOrThrow();
                addressId = created.id;
            }
            const existing = await trx
                .selectFrom('address_links')
                .select((eb) => [eb.fn.countAll<number>().as('n'), eb.fn.max('position').as('max')])
                .where('entity', '=', input.entity)
                .where('entity_id', '=', input.entityId)
                .executeTakeFirstOrThrow();
            // The first address becomes the primary one.
            const isPrimary = input.isPrimary ?? Number(existing.n) === 0;
            if (isPrimary) await clearPrimary(trx, input.entity, input.entityId);
            await trx
                .insertInto('address_links')
                .values({
                    address_id: addressId,
                    entity: input.entity,
                    entity_id: input.entityId,
                    label: input.label ?? null,
                    is_primary: isPrimary,
                    position: Number(existing.max ?? -1) + 1,
                })
                .execute();
        });
        return c.json({ items: await addressesFor(db, input.entity, input.entityId) }, 201);
    });

    app.patch('/addresses/:id', async (c) => {
        const id = c.req.param('id');
        const patch = await body(c, addressPatchSchema);
        const db = c.var.db;
        if (!isUuid(id)) throw new HttpError(404, 'Not found');
        const values = columns(patch, ADDRESS_COLUMNS);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const row = await db.updateTable('addresses').set(values).where('id', '=', id).where(sameVersion(patch.updatedAt)).returningAll().executeTakeFirst();
        if (!row) {
            const current = await db.selectFrom('addresses').selectAll().where('id', '=', id).executeTakeFirst();
            return conflictOr404(Boolean(current), async () => current && toAddress(current));
        }
        return c.json(toAddress(row));
    });

    app.delete('/addresses/:id', async (c) => {
        const id = c.req.param('id');
        if (!isUuid(id)) throw new HttpError(404, 'Not found');
        const deleted = await c.var.db.deleteFrom('addresses').where('id', '=', id).executeTakeFirst();
        if (!deleted.numDeletedRows) throw new HttpError(404, 'Not found');
        return c.body(null, 204);
    });

    app.patch('/address-links/:id', async (c) => {
        const id = c.req.param('id');
        const patch = await body(c, addressLinkPatchSchema);
        const db = c.var.db;
        if (!isUuid(id)) throw new HttpError(404, 'Not found');
        const link = await db.selectFrom('address_links').selectAll().where('id', '=', id).executeTakeFirst();
        if (!link) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            if (patch.isPrimary) await clearPrimary(trx, link.entity, link.entity_id, id);
            if (patch.position !== undefined && patch.position !== link.position) {
                // Move within the owner's list, keeping positions 0..n-1.
                const ids = (
                    await trx.selectFrom('address_links').select('id').where('entity', '=', link.entity).where('entity_id', '=', link.entity_id).orderBy('position').orderBy('created_at').execute()
                )
                    .map((r) => r.id)
                    .filter((x) => x !== id);
                ids.splice(Math.min(patch.position, ids.length), 0, id);
                for (const [position, linkId] of ids.entries()) await trx.updateTable('address_links').set({ position }).where('id', '=', linkId).execute();
            }
            const values = columns(patch, { label: 'label', isPrimary: 'is_primary' });
            if (Object.keys(values).length) await trx.updateTable('address_links').set(values).where('id', '=', id).execute();
        });
        return c.json({ items: await addressesFor(db, link.entity, link.entity_id) });
    });

    app.delete('/address-links/:id', async (c) => {
        const id = c.req.param('id');
        const db = c.var.db;
        if (!isUuid(id)) throw new HttpError(404, 'Not found');
        const link = await db.selectFrom('address_links').selectAll().where('id', '=', id).executeTakeFirst();
        if (!link) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            await trx.deleteFrom('address_links').where('id', '=', id).execute();
            // Keep a primary address when one is left.
            if (link.is_primary) {
                const next = await trx
                    .selectFrom('address_links')
                    .select('id')
                    .where('entity', '=', link.entity)
                    .where('entity_id', '=', link.entity_id)
                    .orderBy('position')
                    .limit(1)
                    .executeTakeFirst();
                if (next) await trx.updateTable('address_links').set({ is_primary: true }).where('id', '=', next.id).execute();
            }
        });
        return c.json({ items: await addressesFor(db, link.entity, link.entity_id) });
    });

    return app;
}
