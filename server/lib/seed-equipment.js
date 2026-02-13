/**
 * Auto-seed equipment data into the database on server startup.
 * Only inserts data if the SpriteSheet table is empty (first run).
 * Creates Sprite records and links them to ItemTemplates.
 */

import prisma from './prisma.js';
import { SPRITE_SHEETS, EQUIPMENT_TEMPLATES } from './equipment-seed-data.js';

export async function seedEquipmentIfEmpty() {
    try {
        const sheetCount = await prisma.spriteSheet.count();
        if (sheetCount > 0) {
            console.log(`[Seed] Equipment data already present (${sheetCount} sprite sheets). Skipping seed.`);
            return;
        }

        console.log('[Seed] No equipment data found. Seeding from defaults...');

        // 1. Create sprite sheets
        const sheetMap = {};
        for (const [type, sheet] of Object.entries(SPRITE_SHEETS)) {
            const result = await prisma.spriteSheet.create({
                data: { type, file: sheet.file, width: sheet.width, height: sheet.height },
            });
            sheetMap[type] = result.id;
        }

        // 2. Create sprites and item templates
        let count = 0;
        for (const [type, tiers] of Object.entries(EQUIPMENT_TEMPLATES)) {
            for (const [tier, templates] of Object.entries(tiers)) {
                for (const tpl of templates) {
                    // Create a Sprite record
                    const sprite = await prisma.sprite.create({
                        data: {
                            name: tpl.name,
                            spriteX: tpl.sprite.x,
                            spriteY: tpl.sprite.y,
                            spriteW: tpl.sprite.w,
                            spriteH: tpl.sprite.h,
                            spriteSheetId: sheetMap[type],
                        },
                    });

                    // Create the ItemTemplate linked to the Sprite
                    await prisma.itemTemplate.create({
                        data: {
                            type,
                            tier: parseInt(tier),
                            skin: tpl.skin,
                            name: tpl.name,
                            spriteId: sprite.id,
                            spriteSheetId: sheetMap[type],
                        },
                    });
                    count++;
                }
            }
        }

        console.log(`[Seed] Inserted ${count} item templates with sprites across ${Object.keys(sheetMap).length} sprite sheets.`);
    } catch (err) {
        console.error('[Seed] Equipment seed failed (non-fatal):', err.message);
    }
}
