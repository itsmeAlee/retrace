from typing import Literal

from pydantic import BaseModel, Field


MermaidType = Literal[
    "graph",
    "flowchart",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram",
    "pie",
    "quadrantChart",
    "xychart-beta",
    "block-diagram",
]

SourceType = Literal["url", "youtube", "image", "pdf", "file", "text", "audio"]


class SourceReference(BaseModel):
    title: str = Field(default="Untitled source", description="Readable source title.")
    source_type: SourceType = Field(description="Type of source that contributed to the context.")
    url: str | None = Field(default=None, description="Original URL for web and YouTube sources.")
    file_id: str | None = Field(default=None, description="Appwrite Storage file ID for file-backed captures.")
    domain: str | None = Field(default=None, description="Domain name for URL display.")


class DiagramDecision(BaseModel):
    should_generate: bool = Field(default=False, description="Whether the content benefits from diagrams.")
    diagram_concepts: list[str] = Field(
        default_factory=list,
        description="Concepts that each need their own diagram. Empty when should_generate is false.",
    )
    diagram_types: list[MermaidType] = Field(
        default_factory=list,
        description="Mermaid syntax type for each concept, same length as diagram_concepts.",
    )


class DiagramOutput(BaseModel):
    diagram_type: str = Field(description="What this diagram represents conceptually.")
    mermaid_type: MermaidType = Field(description="Mermaid diagram syntax type chosen for the concept.")
    mermaid_code: str = Field(description="Clean, validated Mermaid code without markdown fences.")
    explanation: str = Field(description="One sentence explaining what this diagram shows.")


class CheckpointContext(BaseModel):
    title: str = Field(
        default="Untitled checkpoint",
        description="Short descriptive title for the checkpoint, 5-8 words max.",
    )
    context: str = Field(
        default="No content was captured in this checkpoint yet.",
        description=(
            "Main explanation in 4-8 paragraphs. Covers all key concepts encountered, explains "
            "relationships between ideas, references actual capture content, and uses plain prose "
            "without bullet points."
        ),
    )
    key_points: list[str] = Field(
        default_factory=list,
        description="Five to eight complete, meaningful insight sentences.",
    )
    diagram_decisions: list[DiagramDecision] = Field(
        default_factory=list,
        description="Model decisions about which diagrams should be generated.",
    )
    diagrams: list[DiagramOutput] = Field(default_factory=list, description="Generated Mermaid diagrams.")
    sources_used: list[SourceReference] = Field(
        default_factory=list,
        description="Capture sources that successfully contributed to the context.",
    )
    capture_count: int = 0
