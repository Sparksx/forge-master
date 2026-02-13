#!/usr/bin/env python3
"""
Detect individual sprite bounding boxes in a sprite sheet PNG.

All sheets are 1024×1536 with 8 rows of ~192px.
We know the column count per type from visual inspection.
For each grid cell we find the bounding box of non-transparent pixels,
using percentile trimming to ignore sparse shadow/glow pixels at edges.
Empty cells (< MIN_PIXELS opaque) are skipped.

Outputs JSON mapping type → list of rows → list of { x, y, w, h }.
"""

import json
import sys
from PIL import Image
import numpy as np
from scipy import ndimage

# Column count per sprite sheet (verified visually)
SHEET_COLS = {
    'helmets':   4,
    'armors':    4,
    'weapons':   4,
    'necklaces': 4,
    'rings':     4,
    'gloves':    5,
    'belts':     4,
    'boots':     4,
}

GRID_ROWS = 8         # all sheets have 8 rows of 192 px
MIN_PIXELS = 50       # minimum opaque pixels to consider a cell occupied
CELL_MARGIN = 8       # pixels to trim from each cell edge to avoid bleed
ALPHA_THRESHOLD = 100 # ignore semi-transparent shadows / glows


def get_alpha_mask(img, threshold=ALPHA_THRESHOLD):
    arr = np.array(img)
    if arr.shape[2] >= 4:
        return arr[:, :, 3] > threshold
    return np.any(arr[:, :, :3] < 240, axis=2)


def tight_bbox_in_cell(mask, y0, y1, x0, x1):
    """Find bounding box of the largest connected component within a grid cell."""
    # Apply margin to avoid picking up neighbouring sprites
    y0c = min(y0 + CELL_MARGIN, y1)
    y1c = max(y1 - CELL_MARGIN, y0c)
    x0c = min(x0 + CELL_MARGIN, x1)
    x1c = max(x1 - CELL_MARGIN, x0c)

    sub = mask[y0c:y1c, x0c:x1c]
    total_opaque = sub.sum()
    if total_opaque < MIN_PIXELS:
        return None

    # Use scipy for fast connected component labeling
    labeled, num_labels = ndimage.label(sub)
    if num_labels == 0:
        return None

    # Find the largest component
    sizes = ndimage.sum(sub, labeled, range(1, num_labels + 1))
    largest_label = np.argmax(sizes) + 1
    largest_mask = labeled == largest_label

    if largest_mask.sum() < MIN_PIXELS:
        return None

    ys, xs = np.where(largest_mask)
    return {
        'x': int(x0c + xs.min()),
        'y': int(y0c + ys.min()),
        'w': int(xs.max() - xs.min() + 1),
        'h': int(ys.max() - ys.min() + 1),
    }


def process_sheet(path, cols):
    img = Image.open(path).convert('RGBA')
    mask = get_alpha_mask(img)
    img_h, img_w = mask.shape

    cell_h = img_h / GRID_ROWS
    cell_w = img_w / cols

    grid = []
    for r in range(GRID_ROWS):
        y0 = round(r * cell_h)
        y1 = round((r + 1) * cell_h)
        row_boxes = []
        for c in range(cols):
            x0 = round(c * cell_w)
            x1 = round((c + 1) * cell_w)
            box = tight_bbox_in_cell(mask, y0, y1, x0, x1)
            if box:
                row_boxes.append(box)
        grid.append(row_boxes)  # always append, even if empty

    return grid, img_w, img_h


def main():
    assets_dir = '/home/user/forge-master/public/assets'
    sheet_names = ['helmets', 'armors', 'weapons', 'necklaces', 'rings', 'gloves', 'belts', 'boots']

    all_data = {}
    for name in sheet_names:
        path = f'{assets_dir}/{name}.png'
        cols = SHEET_COLS[name]
        print(f'Processing {name} ({cols} cols)...', file=sys.stderr)
        grid, img_w, img_h = process_sheet(path, cols)
        all_data[name] = {
            'imageWidth': img_w,
            'imageHeight': img_h,
            'grid': grid,
        }
        for r, row in enumerate(grid):
            if row:
                sizes = ', '.join(f'{b["w"]}x{b["h"]}' for b in row)
                print(f'  Row {r}: {len(row)} sprites  [{sizes}]', file=sys.stderr)
            else:
                print(f'  Row {r}: empty', file=sys.stderr)

    print(json.dumps(all_data, indent=2))


if __name__ == '__main__':
    main()
