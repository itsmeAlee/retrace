import logging
from typing import Literal

from langgraph.graph import END, START, StateGraph

from .nodes.diagram import diagram
from .nodes.file_agent import file_agent
from .nodes.orchestrator import orchestrator
from .nodes.synthesis import synthesis
from .nodes.text_agent import text_agent
from .nodes.url_agent import url_agent
from .nodes.video_agent import video_agent
from .nodes.writer import writer
from .state import CaptureItem, FinalOutput, RetraceState

logger = logging.getLogger(__name__)

AgentRoute = Literal[
    "text_agent",
    "url_agent",
    "video_agent",
    "file_agent",
    "synthesis",
]
SynthesisRoute = Literal["diagram", "writer"]


def route_to_agents(state: RetraceState) -> list[AgentRoute]:
    if not state.captures:
        return ["synthesis"]

    routes: list[AgentRoute] = []
    if state.has_text:
        routes.append("text_agent")
    if state.has_urls:
        routes.append("url_agent")
    if state.has_youtube:
        routes.append("video_agent")
    if state.has_files or state.has_images:
        routes.append("file_agent")
    return routes or ["synthesis"]


def route_after_synthesis(state: RetraceState) -> SynthesisRoute:
    if state.synthesis_output and state.synthesis_output.diagram_warranted:
        return "diagram"
    return "writer"


graph = StateGraph(RetraceState)
graph.add_node("orchestrator", orchestrator)
graph.add_node("text_agent", text_agent)
graph.add_node("url_agent", url_agent)
graph.add_node("video_agent", video_agent)
graph.add_node("file_agent", file_agent)
graph.add_node("synthesis", synthesis)
graph.add_node("diagram", diagram)
graph.add_node("writer", writer)

graph.add_edge(START, "orchestrator")
graph.add_conditional_edges(
    "orchestrator",
    route_to_agents,
    path_map=["text_agent", "url_agent", "video_agent", "file_agent", "synthesis"],
)
graph.add_edge("text_agent", "synthesis")
graph.add_edge("url_agent", "synthesis")
graph.add_edge("video_agent", "synthesis")
graph.add_edge("file_agent", "synthesis")
graph.add_conditional_edges(
    "synthesis",
    route_after_synthesis,
    path_map={
        "diagram": "diagram",
        "writer": "writer",
    },
)
graph.add_edge("diagram", "writer")
graph.add_edge("writer", END)

compiled_graph = graph.compile()


def run_pipeline(
    session_id: str,
    checkpoint_id: str,
    checkpoint_name: str,
    captures: list[dict],
) -> FinalOutput | None:
    try:
        initial_state = RetraceState(
            session_id=session_id,
            checkpoint_id=checkpoint_id,
            checkpoint_name=checkpoint_name,
            captures=[CaptureItem.model_validate(capture) for capture in captures],
        )
        result = compiled_graph.invoke(initial_state)
        final_output = result.get("final_output") if isinstance(result, dict) else result.final_output
        if final_output is None:
            return None
        return final_output if isinstance(final_output, FinalOutput) else FinalOutput.model_validate(final_output)
    except Exception:
        logger.exception("Retrace AI pipeline failed.")
        return None


def graph_mermaid() -> str:
    return compiled_graph.get_graph().draw_mermaid()
