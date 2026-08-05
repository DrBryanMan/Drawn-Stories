AVATAR_GRADIENTS = [
    ("#4f46e5", "#7c3aed"),  # Indigo to Purple
    ("#2563eb", "#0284c7"),  # Blue to Sky
    ("#0d9488", "#059669"),  # Teal to Emerald
    ("#d97706", "#dc2626"),  # Amber to Red
    ("#7c3aed", "#db2777"),  # Purple to Pink
    ("#475569", "#334155"),  # Slate
]


def generate_default_avatar_svg(username: str) -> str:
    """
    Generates a stylish SVG default avatar stub for users without a custom photo.
    Uses a deterministic gradient background based on username hash and a clean Lucide user silhouette.
    """
    cleaned_name = (username or "").strip()
    hash_val = sum(ord(c) for c in cleaned_name) if cleaned_name else 0
    c1, c2 = AVATAR_GRADIENTS[hash_val % len(AVATAR_GRADIENTS)]
    grad_id = f"avatar-grad-{hash_val % len(AVATAR_GRADIENTS)}"

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="{grad_id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{c1}" />
      <stop offset="100%" stop-color="{c2}" />
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#{grad_id})"/>
  <g transform="translate(26, 26) scale(2)" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="8" r="5"/>
    <path d="M20 21a8 8 0 0 0-16 0"/>
  </g>
</svg>"""
