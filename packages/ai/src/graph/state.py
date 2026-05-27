import operator
from typing import Annotated, Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class CaptureItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(validation_alias=AliasChoices("id", "$id"))
    type: str
    content: str
    source_url: str | None = Field(default=None, validation_alias=AliasChoices("source_url", "sourceUrl"))
    source_title: str | None = Field(default=None, validation_alias=AliasChoices("source_title", "sourceTitle"))
    file_id: str | None = Field(default=None, validation_alias=AliasChoices("file_id", "fileId"))
    file_name: str | None = Field(default=None, validation_alias=AliasChoices("file_name", "fileName"))
    file_mime_type: str | None = Field(default=None, validation_alias=AliasChoices("file_mime_type", "fileMimeType"))
    duration: int | None = None
    timestamp: str | None = None
    created_at: str = Field(validation_alias=AliasChoices("created_at", "createdAt", "$createdAt"))
    effective_type: str | None = None


class TextAgentOutput(BaseModel):
    key_topics: list[str]
    key_claims: list[str]
    entities: list[str]
    user_thinking: str
    raw_summary: str


class UrlSource(BaseModel):
    url: str
    title: str
    summary: str
    main_argument: str
    source_type: Literal["academic", "news", "blog", "documentation", "other"]
    key_facts: list[str]


class UrlAgentOutput(BaseModel):
    sources: list[UrlSource]


class YoutubeSource(BaseModel):
    url: str
    title: str
    captured_at_timestamp: str | None
    segment_summary: str
    key_points: list[str]
    relevance: str


class YoutubeAgentOutput(BaseModel):
    videos: list[YoutubeSource]


class FileSource(BaseModel):
    file_name: str
    file_type: Literal["pdf", "image", "word", "text", "other"]
    content_summary: str
    key_findings: list[str]
    image_description: str | None


class FileAgentOutput(BaseModel):
    files: list[FileSource]


class SynthesisOutput(BaseModel):
    central_question: str
    established: list[str]
    tensions: list[str]
    gaps: list[str]
    user_thinking: str
    key_sources: list[str]
    diagram_warranted: bool
    diagram_type: Literal["concept_map", "flowchart", "timeline", "comparison_table", "sequence", "tree"] | None
    diagram_elements: list[str] | None


class FinalOutput(BaseModel):
    summary: str
    key_findings: list[str]
    tensions: list[str]
    gaps: list[str]
    suggested_next: str
    diagram_mermaid: str | None = None
    capture_count: int = 0
    checkpoint_name: str = ""


class RetraceState(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    session_id: str
    checkpoint_ref: str = Field(validation_alias=AliasChoices("checkpoint_ref", "checkpoint_id"))
    checkpoint_name: str
    captures: list[CaptureItem]

    has_text: bool = False
    has_urls: bool = False
    has_youtube: bool = False
    has_images: bool = False
    has_files: bool = False
    diagram_warranted: bool = False
    diagram_type: str | None = None
    capture_count_by_type: dict[str, int] = Field(default_factory=dict)
    total_captures: int = 0

    text_output: TextAgentOutput | None = None
    url_output: UrlAgentOutput | None = None
    youtube_output: YoutubeAgentOutput | None = None
    file_output: FileAgentOutput | None = None

    synthesis_output: SynthesisOutput | None = None
    diagram_mermaid: str | None = None
    final_output: FinalOutput | None = None

    errors: Annotated[list[str], operator.add] = Field(default_factory=list)

    @classmethod
    def from_raw(cls, data: dict[str, Any]) -> "RetraceState":
        return cls.model_validate(data)

    @property
    def checkpoint_id(self) -> str:
        return self.checkpoint_ref
