MERMAID_TEMPLATES: dict[str, str] = {
    "graph": """graph TD
    A[Core Concept] --> B[Related Idea]
    B --> C[Consequence]
    A --> D[Supporting Detail]""",
    "flowchart": """flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[Alternative]""",
    "sequenceDiagram": """sequenceDiagram
    participant User
    participant System
    User->>System: Provide input
    System-->>User: Return result""",
    "classDiagram": """classDiagram
    class Concept {
      +property
      +operation()
    }
    Concept <|-- SpecificConcept""",
    "stateDiagram": """stateDiagram-v2
    [*] --> Initial
    Initial --> Active
    Active --> Complete
    Complete --> [*]""",
    "pie": """pie title Proportional Breakdown
    "Part A" : 40
    "Part B" : 35
    "Part C" : 25""",
    "quadrantChart": """quadrantChart
    title Concept Tradeoffs
    x-axis Low complexity --> High complexity
    y-axis Low impact --> High impact
    quadrant-1 High impact, high complexity
    quadrant-2 High impact, low complexity
    quadrant-3 Low impact, low complexity
    quadrant-4 Low impact, high complexity
    Important idea: [0.72, 0.82]
    Quick win: [0.28, 0.74]""",
    "xychart-beta": """xychart-beta
    title "Training Loss Over Iterations"
    x-axis "Iteration" [0, 1, 2, 3, 4, 5]
    y-axis "Loss" 0 --> 10
    line [9, 7, 5, 3, 2, 1]""",
    "block-diagram": """block-beta
    columns 3
    input["Input"] process["Process"] output["Output"]
    input --> process
    process --> output""",
}


def template_for(mermaid_type: str) -> str:
    return MERMAID_TEMPLATES.get(mermaid_type, MERMAID_TEMPLATES["graph"])
