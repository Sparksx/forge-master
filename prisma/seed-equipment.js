/**
 * Seed script: migrates equipment data from the shared seed-data module into the database.
 * Run with: node prisma/seed-equipment.js
 *
 * This is idempotent — it will upsert sprite sheets and item templates,
 * so it can be run multiple times safely.
 */

import { PrismaClient } from '@prisma/client';
import { SPRITE_SHEETS, EQUIPMENT_TEMPLATES } from '../server/lib/equipment-seed-data.js';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding equipment data...');

    // 1. Upsert sprite sheets
    const sheetMap = {};
    for (const [type, sheet] of Object.entries(SPRITE_SHEETS)) {
        const result = await prisma.spriteSheet.upsert({
            where: { type },
            update: { file: sheet.file, width: sheet.width, height: sheet.height },
            create: { type, file: sheet.file, width: sheet.width, height: sheet.height },
        });
        sheetMap[type] = result.id;
        console.log(`  SpriteSheet "${type}" -> id ${result.id}`);
    }

    // 2. Upsert item templates
    let count = 0;
    for (const [type, tiers] of Object.entries(EQUIPMENT_TEMPLATES)) {
        for (const [tier, templates] of Object.entries(tiers)) {
            for (const tpl of templates) {
                await prisma.itemTemplate.upsert({
                    where: { skin: tpl.skin },
                    update: {
                        type,
                        tier: parseInt(tier),
                        name: tpl.name,
                        spriteX: tpl.sprite.x,
                        spriteY: tpl.sprite.y,
                        spriteW: tpl.sprite.w,
                        spriteH: tpl.sprite.h,
                        spriteSheetId: sheetMap[type],
                    },
                    create: {
                        type,
                        tier: parseInt(tier),
                        skin: tpl.skin,
                        name: tpl.name,
                        spriteX: tpl.sprite.x,
                        spriteY: tpl.sprite.y,
                        spriteW: tpl.sprite.w,
                        spriteH: tpl.sprite.h,
                        spriteSheetId: sheetMap[type],
                    },
                });
                count++;
            }
        }
    }

    console.log(`Seeded ${count} item templates across ${Object.keys(sheetMap).length} sprite sheets.`);
}

main()
    .catch((err) => {
        console.error('Seed error:', err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
