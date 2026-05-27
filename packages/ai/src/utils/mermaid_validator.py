VALID_START_KEYWORDS = (
    "graph",
    "flowchart",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "stateDiagram-v2",
    "pie",
    "quadrantChart",
    "xychart-beta",
    "block-beta",
)


def clean_mermaid(raw: str) -> str:
    text = raw.strip()
    lines = text.splitlines()

    if lines and lines[0].strip().startswith("```"):
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
    elif lines and lines[0].strip().startswith("~~~"):
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("~~~"):
            lines = lines[:-1]

    cleaned_lines = [line.rstrip() for line in lines]
    while cleaned_lines and not cleaned_lines[0].strip():
        cleaned_lines.pop(0)
    while cleaned_lines and not cleaned_lines[-1].strip():
        cleaned_lines.pop()

    if cleaned_lines and cleaned_lines[0].strip().lower() == "mermaid":
        cleaned_lines = cleaned_lines[1:]

    return "\n".join(cleaned_lines).strip()


def validate_mermaid(mermaid_str: str) -> tuple[bool, str]:
    cleaned = clean_mermaid(mermaid_str)
    if not cleaned:
        return False, "Mermaid diagram is empty."

    if "```" in cleaned or "~~~" in cleaned:
        return False, "Mermaid diagram must not contain markdown code fences."

    lines = [line for line in cleaned.splitlines() if line.strip()]
    if lines and lines[0].strip().lower() == "mermaid":
        return False, "Mermaid diagram must not contain a standalone mermaid line."

    first = lines[0].strip() if lines else ""
    if not any(first == keyword or first.startswith(f"{keyword} ") for keyword in VALID_START_KEYWORDS):
        return False, f"Mermaid diagram must start with one of: {', '.join(VALID_START_KEYWORDS)}."

    if len(lines) < 3:
        return False, "Mermaid diagram must contain at least two content lines after the diagram type."

    return True, cleaned
