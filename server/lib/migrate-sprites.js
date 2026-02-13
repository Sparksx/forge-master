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
        // Find items that have old-style inline coordinates but no sprite reference
        const itemsToMigrate = await prisma.itemTemplate.findMany({
            where: {
                spriteId: null,
                spriteX: { not: null },
                spriteY: { not: null },
                spriteW: { not: null },
                spriteH: { not: null },
            },
        });

        if (itemsToMigrate.length === 0) {
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

            // Link the item to the new sprite and clear inline coordinates
            await prisma.itemTemplate.update({
                where: { id: item.id },
                data: {
                    spriteId: sprite.id,
                    spriteX: null,
                    spriteY: null,
                    spriteW: null,
                    spriteH: null,
                },
            });
        }

        console.log(`[Migration] Successfully migrated ${itemsToMigrate.length} items to Sprite table.`);
    } catch (err) {
        console.error('[Migration] Sprite migration error (non-fatal):', err.message);
    }
}
