/**
 * Auto-seed equipment, monster, and player data into the database on server startup.
 * Only inserts data if the corresponding tables are empty (first run).
 * Creates Sprite records and links them to ItemTemplates / MonsterTemplates / PlayerTemplates.
 */

import prisma from './prisma.js';
import { SPRITE_SHEETS, EQUIPMENT_TEMPLATES } from './equipment-seed-data.js';
import {
    MONSTER_SPRITE_SHEET, PLAYER_SPRITE_SHEET,
    MONSTER_TEMPLATES, PLAYER_TEMPLATES,
    monsterGridToPixels, playerGridToPixels,
} from './monster-player-seed-data.js';

export async function seedEquipmentIfEmpty() {
    try {
        const sheetCount = await prisma.spriteSheet.count();
        if (sheetCount > 0) {
            console.log(`[Seed] Equipment data already present (${sheetCount} sprite sheets). Skipping equipment seed.`);
        } else {
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
        }

        // Seed monsters if empty
        await seedMonstersIfEmpty();

        // Seed players if empty
        await seedPlayersIfEmpty();
    } catch (err) {
        console.error('[Seed] Equipment seed failed (non-fatal):', err.message);
    }
}

async function seedMonstersIfEmpty() {
    try {
        const monsterCount = await prisma.monsterTemplate.count();
        if (monsterCount > 0) {
            console.log(`[Seed] Monster data already present (${monsterCount} monsters). Skipping monster seed.`);
            return;
        }

        console.log('[Seed] No monster data found. Seeding monster templates...');

        // Create or find monster sprite sheet
        let monsterSheet = await prisma.spriteSheet.findUnique({ where: { type: 'monster' } });
        if (!monsterSheet) {
            monsterSheet = await prisma.spriteSheet.create({
                data: {
                    type: MONSTER_SPRITE_SHEET.type,
                    file: MONSTER_SPRITE_SHEET.file,
                    width: MONSTER_SPRITE_SHEET.width,
                    height: MONSTER_SPRITE_SHEET.height,
                },
            });
        }

        let count = 0;
        for (const tpl of MONSTER_TEMPLATES) {
            const px = monsterGridToPixels(tpl.sprite[0], tpl.sprite[1]);

            // Create a Sprite record for this monster
            const sprite = await prisma.sprite.create({
                data: {
                    name: tpl.name,
                    spriteX: px.x,
                    spriteY: px.y,
                    spriteW: px.w,
                    spriteH: px.h,
                    spriteSheetId: monsterSheet.id,
                },
            });

            // Create the MonsterTemplate linked to the Sprite
            await prisma.monsterTemplate.create({
                data: {
                    slug: tpl.slug,
                    name: tpl.name,
                    emoji: tpl.emoji,
                    color: tpl.color,
                    wave: tpl.wave,
                    hpMultiplier: tpl.hpMultiplier,
                    dmgMultiplier: tpl.dmgMultiplier,
                    speedModifier: tpl.speedModifier,
                    spriteId: sprite.id,
                    spriteSheetId: monsterSheet.id,
                },
            });
            count++;
        }

        console.log(`[Seed] Inserted ${count} monster templates with sprites.`);
    } catch (err) {
        console.error('[Seed] Monster seed failed (non-fatal):', err.message);
    }
}

async function seedPlayersIfEmpty() {
    try {
        const playerCount = await prisma.playerTemplate.count();
        if (playerCount > 0) {
            console.log(`[Seed] Player data already present (${playerCount} player skins). Skipping player seed.`);
            return;
        }

        console.log('[Seed] No player skin data found. Seeding player templates...');

        // Create or find player sprite sheet
        let playerSheet = await prisma.spriteSheet.findUnique({ where: { type: 'player' } });
        if (!playerSheet) {
            playerSheet = await prisma.spriteSheet.create({
                data: {
                    type: PLAYER_SPRITE_SHEET.type,
                    file: PLAYER_SPRITE_SHEET.file,
                    width: PLAYER_SPRITE_SHEET.width,
                    height: PLAYER_SPRITE_SHEET.height,
                },
            });
        }

        let count = 0;
        for (const tpl of PLAYER_TEMPLATES) {
            const px = playerGridToPixels(tpl.sprite[0], tpl.sprite[1]);

            // Create a Sprite record for this player skin
            const sprite = await prisma.sprite.create({
                data: {
                    name: tpl.name,
                    spriteX: px.x,
                    spriteY: px.y,
                    spriteW: px.w,
                    spriteH: px.h,
                    spriteSheetId: playerSheet.id,
                },
            });

            // Create the PlayerTemplate linked to the Sprite
            await prisma.playerTemplate.create({
                data: {
                    slug: tpl.slug,
                    name: tpl.name,
                    isDefault: tpl.isDefault,
                    spriteId: sprite.id,
                    spriteSheetId: playerSheet.id,
                },
            });
            count++;
        }

        console.log(`[Seed] Inserted ${count} player templates with sprites.`);
    } catch (err) {
        console.error('[Seed] Player seed failed (non-fatal):', err.message);
    }
}
