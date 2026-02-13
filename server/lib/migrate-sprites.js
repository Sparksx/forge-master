/**
 * Migration script: Extract sprites from ItemTemplate into a dedicated Sprite table.
 *
 * For each ItemTemplate that has sprite coordinates (spriteX/Y/W/H) but no spriteId,
 * creates a Sprite record and links it.
 *
 * This migration is idempotent: items that already have a spriteId are skipped.
 * Run once after the schema change has been pushed via `prisma db push`.
 */

import prisma from './prisma.js';

export async function migrateSpritesIfNeeded() {
    try {
        // Check if ItemTemplate still has the old spriteX column
        // If it doesn't, migration is either done or not needed
        const items = await prisma.$queryRaw`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'ItemTemplate' AND column_name = 'spriteX'
        `;

        if (items.length === 0) {
            // Old columns already removed, nothing to migrate
            return;
        }

        // Check if any items need migration (have spriteX but spriteId is null or default)
        const itemsToMigrate = await prisma.$queryRaw`
            SELECT id, type, skin, name, "spriteX", "spriteY", "spriteW", "spriteH", "spriteSheetId"
            FROM "ItemTemplate"
            WHERE "spriteId" IS NULL OR "spriteId" = 0
        `;

        if (itemsToMigrate.length === 0) {
            console.log('[Migration] No items need sprite migration. Skipping.');
            return;
        }

        console.log(`[Migration] Migrating ${itemsToMigrate.length} items to Sprite table...`);

        for (const item of itemsToMigrate) {
            // Create a Sprite record from the item's existing coordinates
            const sprite = await prisma.sprite.create({
                data: {
                    name: item.name,
                    spriteX: item.spriteX,
                    spriteY: item.spriteY,
                    spriteW: item.spriteW,
                    spriteH: item.spriteH,
                    spriteSheetId: item.spriteSheetId,
                },
            });

            // Update the ItemTemplate to reference the new sprite
            await prisma.$executeRaw`
                UPDATE "ItemTemplate" SET "spriteId" = ${sprite.id} WHERE id = ${item.id}
            `;
        }

        console.log(`[Migration] Successfully migrated ${itemsToMigrate.length} items to Sprite table.`);
    } catch (err) {
        // Non-fatal: if the columns don't exist yet, migration isn't needed
        if (err.code === '42703' || err.message?.includes('column') || err.message?.includes('does not exist')) {
            console.log('[Migration] Sprite migration not applicable to current schema. Skipping.');
            return;
        }
        console.error('[Migration] Sprite migration error (non-fatal):', err.message);
    }
}
