CONCEPT_MAP_EXAMPLE = """
graph TD
    A[Central Concept] --> B[Related Concept 1]
    A --> C[Related Concept 2]
    B --> D[Sub Concept]
    C --> D
"""

FLOWCHART_EXAMPLE = """
flowchart LR
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
"""

TIMELINE_EXAMPLE = """
timeline
    title Research Timeline
    Section 1 : First event : Second event
    Section 2 : Third event
"""

COMPARISON_TABLE_EXAMPLE = """
graph LR
    subgraph Option A
    A1[Feature 1]
    A2[Feature 2]
    end
    subgraph Option B
    B1[Feature 1]
    B2[Feature 3]
    end
"""

SEQUENCE_EXAMPLE = """
sequenceDiagram
    Actor A->>Actor B: Message
    Actor B-->>Actor A: Response
"""

TREE_EXAMPLE = """
graph TD
    Root --> Branch1
    Root --> Branch2
    Branch1 --> Leaf1
    Branch1 --> Leaf2
    Branch2 --> Leaf3
"""

DIAGRAM_TEMPLATES = {
    "concept_map": CONCEPT_MAP_EXAMPLE,
    "flowchart": FLOWCHART_EXAMPLE,
    "timeline": TIMELINE_EXAMPLE,
    "comparison_table": COMPARISON_TABLE_EXAMPLE,
    "sequence": SEQUENCE_EXAMPLE,
    "tree": TREE_EXAMPLE,
}
