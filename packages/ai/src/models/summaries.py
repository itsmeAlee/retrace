from pydantic import BaseModel


class CustomSelectionSummary(BaseModel):
    overview: str
    common_themes: list[str]
    key_takeaways: list[str]
    connections: list[str]
    checkpoint_names: list[str]


class GrandSummary(BaseModel):
    session_overview: str
    learning_arc: str
    total_findings: list[str]
    unresolved_questions: list[str]
    suggested_next_session: str
    total_checkpoints_included: int
    session_name: str
