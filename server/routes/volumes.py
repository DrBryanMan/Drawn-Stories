from fastapi import APIRouter, HTTPException
from ..db import get_db

router = APIRouter(prefix="/api/volumes", tags=["volumes"])

@router.get("/{volume_id}")
async def get_volume_detail(volume_id: int):
    db = get_db()

    volume = db.get_one(
        """
        SELECT v.*, p.name as publisher_name, p.cv_slug as publisher_slug
        FROM volumes v
        LEFT JOIN publishers p ON v.publisher = p.id
        WHERE v.id = ?
        """,
        [volume_id],
    )

    if not volume:
        raise HTTPException(status_code=404, detail="Том не знайдено")

    cv_id = volume.get("cv_id")

    issues = db.get_all(
        """
        SELECT i.*, 'issue' as type, COUNT(ci.collection_id) as collection_count
        FROM issues i
        LEFT JOIN collection_issues ci ON i.id = ci.issue_id
        WHERE i.ds_vol_id = ?
           OR (i.ds_vol_id IS NULL AND i.cv_vol_id = ?)
        GROUP BY i.id
        """,
        [volume_id, cv_id],
    )

    collections = db.get_all(
        """
        SELECT *, 'collection' as type
        FROM collections
        WHERE volume_id = ?
           OR (volume_id IS NULL AND cv_vol_id = ?)
        """,
        [volume_id, cv_id],
    )

    # Combine and sort
    items = issues + collections
    items.sort(key=lambda x: (
        float(x.get('issue_number') or 0) if str(x.get('issue_number', '')).replace('.', '').isdigit() else 999999,
        x.get('issue_number') or '',
        x.get('cover_date') or x.get('release_date') or ''
    ))

    themes = db.get_all(
        """
        SELECT DISTINCT t.id, t.cv_id, t.name, t.ua_name, COALESCE(t.type, 'theme') as type
        FROM volume_themes vt
        JOIN themes t ON t.id = vt.theme_id
        WHERE vt.volume_id = ?
           OR (? IS NOT NULL AND vt.cv_vol_id = ?)
        ORDER BY
          CASE COALESCE(t.type, 'theme')
            WHEN 'type' THEN 0
            WHEN 'genre' THEN 1
            ELSE 2
          END,
          COALESCE(t.ua_name, t.name) ASC
        """,
        [volume_id, cv_id, cv_id],
    )

    issue_dates = sorted(
        item.get("cover_date") or item.get("release_date")
        for item in items
        if item.get("cover_date") or item.get("release_date")
    )

    issue_years = sorted(
        int(d[:4])
        for d in issue_dates
        if d and len(d) >= 4 and d[:4].isdigit()
    )

    end_year = None
    if volume.get("status") in ["Ongoing", "Триває", "Виходить"]:
        end_year = "Ongoing"
    elif issue_years:
        end_year = issue_years[-1]

    volume_with_end = dict(volume)
    volume_with_end["end_year"] = end_year

    translation_parents = db.get_all(
        """
        SELECT v.*, p.name as publisher_name, vt.rel_type,
               (SELECT COUNT(*)
                FROM collections c
                WHERE (c.cv_vol_id = v.cv_id AND v.cv_id IS NOT NULL)
                   OR c.volume_id = v.id) as collections_count
        FROM volume_translations vt
        JOIN volumes v ON v.id = vt.parent_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE vt.child_id = ?
        ORDER BY
          CASE vt.rel_type
            WHEN 'source' THEN 0
            WHEN 'translation' THEN 1
            WHEN 'original' THEN 2
            ELSE 3
          END,
          v.name ASC
        """,
        [volume_id]
    )

    translations = db.get_all(
        """
        SELECT DISTINCT v.*, p.name as publisher_name, vt.rel_type,
               (SELECT COUNT(*)
                FROM collections c
                WHERE (c.cv_vol_id = v.cv_id AND v.cv_id IS NOT NULL)
                   OR c.volume_id = v.id) as collections_count
        FROM volume_translations vt
        JOIN volumes v ON v.id = vt.child_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE (vt.parent_id = ?
           OR vt.parent_id IN (
               SELECT parent_id
               FROM volume_translations
               WHERE child_id = ?
           ))
          AND v.id != ?
        ORDER BY v.lang ASC, v.name ASC
        """,
        [volume_id, volume_id, volume_id]
    )

    magazine_parents = db.get_all(
        """
        SELECT v.*, p.name as publisher_name
        FROM volume_magazines vm
        JOIN volumes v ON v.id = vm.magazine_id
        LEFT JOIN publishers p ON p.id = v.publisher
        WHERE vm.child_id = ?
        ORDER BY v.name ASC
        """,
        [volume_id]
    )
    magazine = magazine_parents[0] if magazine_parents else None

    return {
        "volume": volume_with_end,
        "items": items,
        "issues": issues,
        "collections": collections,
        "themes": themes,
        "magazine": magazine,
        "translation_parents": translation_parents,
        "translations": translations,
        "magazine_parents": magazine_parents,
        "stats": {
            "issues": len(issues),
            "collections": len(collections),
            "total_items": len(items),
            "first_release": issue_dates[0] if issue_dates else None,
            "last_release": issue_dates[-1] if issue_dates else None,
        },
    }

@router.get("/issue/{issue_id}/collections-membership")
async def get_issue_collections_membership(issue_id: int):
    db = get_db()
    collections = db.get_all(
        """
        SELECT c.*, v.name as volume_name, v.id as volume_id
        FROM collection_issues ci
        JOIN collections c ON c.id = ci.collection_id
        LEFT JOIN volumes v ON (c.cv_vol_id = v.cv_id AND c.cv_vol_id IS NOT NULL) OR (c.volume_id = v.id AND c.volume_id IS NOT NULL)
        WHERE ci.issue_id = ?
        ORDER BY CAST(c.issue_number AS REAL) ASC, COALESCE(c.release_date, c.cover_date) ASC
        """,
        [issue_id],
    )
    return {"data": collections}

@router.get("/{volume_id}/collections-from-issues")
async def get_volume_collections_from_issues(volume_id: int):
    db = get_db()
    volume = db.get_one("SELECT * FROM volumes WHERE id = ?", [volume_id])
    if not volume:
        return {"data": []}

    is_manga_vol = not volume.get("cv_id") and bool(volume.get("hikka_slug"))
    
    if is_manga_vol:
        collections = db.get_all(
            """
            SELECT DISTINCT c.*, pv.id as parent_vol_id, pv.name as parent_vol_name, pv.lang as parent_vol_lang
            FROM collections c
            LEFT JOIN volumes pv ON c.volume_id = pv.id
            WHERE c.volume_id = ?
            ORDER BY pv.name ASC, CAST(c.issue_number AS REAL) ASC, c.name ASC
            """,
            [volume_id]
        )
    else:
        collections = db.get_all(
            """
            SELECT DISTINCT c.*, pv.id as parent_vol_id, pv.name as parent_vol_name, pv.lang as parent_vol_lang
            FROM collections c
            JOIN collection_issues ci ON c.id = ci.collection_id
            JOIN issues i ON ci.issue_id = i.id
            LEFT JOIN volumes pv ON (c.cv_vol_id = pv.cv_id AND c.cv_vol_id IS NOT NULL) OR (c.volume_id = pv.id AND c.volume_id IS NOT NULL)
            WHERE i.cv_vol_id = ? AND i.cv_vol_id IS NOT NULL
            ORDER BY pv.name ASC, CAST(c.issue_number AS REAL) ASC, c.name ASC
            """,
            [volume.get("cv_id")]
        )

    # For each collection, find the issue numbers from THIS volume
    result = []
    for col in collections:
        if is_manga_vol:
            nums = db.get_all(
                """
                SELECT i.issue_number FROM collection_issues ci
                JOIN issues i ON ci.issue_id = i.id
                WHERE ci.collection_id = ? AND i.ds_vol_id = ? AND i.issue_number IS NOT NULL
                ORDER BY CAST(i.issue_number AS REAL) ASC
                """,
                [col["id"], volume_id]
            )
        else:
            nums = db.get_all(
                """
                SELECT i.issue_number FROM collection_issues ci
                JOIN issues i ON ci.issue_id = i.id
                WHERE ci.collection_id = ? AND i.cv_vol_id = ? AND i.issue_number IS NOT NULL
                ORDER BY CAST(i.issue_number AS REAL) ASC
                """,
                [col["id"], volume.get("cv_id")]
            )
        col["volume_issue_numbers"] = [r["issue_number"] for r in nums]
        result.append(col)

    return {"data": result}
