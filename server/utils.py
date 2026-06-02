from typing import Optional, List

def parse_id_list(value: Optional[str]) -> List[int]:
    return [
        int(item)
        for item in (value or "").split(",")
        if item.strip().isdigit()
    ]
