from pydantic import BaseModel


class ResumeCard(BaseModel):
    last_checkpoint_name: str
    where_you_left_off: str
    what_you_established: list[str]
    suggested_next: str
    total_checkpoints: int
    session_name: str
