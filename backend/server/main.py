"""
NotebookLM Omni-Bridge Backend API Server.
FastAPI server for handling ingestion and chat requests.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import sys
import hashlib
import logging

logger = logging.getLogger("omni-bridge")

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from notebooklm_client import NotebookLMClient

app = FastAPI(title="NotebookLM Omni-Bridge API")

# CORS — allow Chrome Extension requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global client instance
nlm_client = NotebookLMClient()


# Request models
class IngestRequest(BaseModel):
    url: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None
    notebook_id: Optional[str] = None


class IngestPrepareRequest(BaseModel):
    notebook_id: Optional[str] = None


class IngestPrepareResponse(BaseModel):
    success: bool
    notebook_id: Optional[str] = None
    error: Optional[str] = None


class IngestAddRequest(BaseModel):
    notebook_id: str
    url: Optional[str] = None
    text: Optional[str] = None
    title: Optional[str] = None


class RenameSourceRequest(BaseModel):
    title: str


class ChatRequest(BaseModel):
    message: str
    notebook_id: Optional[str] = None


# Response models
class IngestResponse(BaseModel):
    success: bool
    source_id: Optional[str] = None
    error: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    sources: Optional[list[str]] = None
    error: Optional[str] = None


class NotebooksResponse(BaseModel):
    notebooks: list


@app.get("/")
async def root():
    return {"status": "ok", "service": "NotebookLM Omni-Bridge API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/notebooks", response_model=NotebooksResponse)
async def list_notebooks():
    """List all notebooks."""
    try:
        notebooks = await nlm_client.list_notebooks()
        return NotebooksResponse(
            notebooks=[
                {
                    "id": nb.id,
                    "title": nb.title,
                    "is_owner": nb.is_owner,
                    "created_at": nb.created_at
                }
                for nb in notebooks
            ]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notebooks", response_model=dict)
async def create_notebook(name: str):
    """Create a new notebook."""
    try:
        notebook = await nlm_client.get_or_create_notebook(name)
        return {
            "id": notebook.id,
            "title": notebook.title,
            "is_owner": notebook.is_owner
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/notebooks/{notebook_id}/select")
async def select_notebook(notebook_id: str):
    """Select a notebook as current."""
    try:
        success = await nlm_client.use_notebook(notebook_id)
        return {"success": success, "notebook_id": notebook_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/notebooks/{notebook_id}/sources")
async def list_sources(notebook_id: str):
    """List all sources in a notebook."""
    try:
        sources = await nlm_client.list_sources(notebook_id)
        return {
            "sources": [
                {
                    "id": s.id,
                    "title": s.title,
                    "type": s.type,
                    "url": s.url,
                    "status": s.status,
                    "created_at": s.created_at,
                }
                for s in sources
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/notebooks/{notebook_id}/sources/{source_id}")
async def delete_source(notebook_id: str, source_id: str):
    """Delete a source from a notebook."""
    try:
        success = await nlm_client.delete_source(source_id, notebook_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete source")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/notebooks/{notebook_id}/sources/{source_id}")
async def rename_source(notebook_id: str, source_id: str, request: RenameSourceRequest):
    """Rename a source in a notebook."""
    try:
        success = await nlm_client.rename_source(source_id, request.title, notebook_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to rename source")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def generate_source_id(url: str) -> str:
    """Generate a unique source ID from URL."""
    hash_obj = hashlib.md5(url.encode())
    return f"src_{hash_obj.hexdigest()[:8]}"


@app.post("/ingest/prepare", response_model=IngestPrepareResponse)
async def ingest_prepare(request: IngestPrepareRequest):
    """Phase 1: Select/prepare the target notebook."""
    try:
        if request.notebook_id:
            await nlm_client.use_notebook(request.notebook_id)
            return IngestPrepareResponse(success=True, notebook_id=request.notebook_id)
        elif nlm_client.current_notebook:
            return IngestPrepareResponse(success=True, notebook_id=nlm_client.current_notebook)
        else:
            notebook = await nlm_client.get_or_create_notebook("Omni-Bridge Inbox")
            await nlm_client.use_notebook(notebook.id)
            return IngestPrepareResponse(success=True, notebook_id=notebook.id)
    except Exception as e:
        return IngestPrepareResponse(success=False, error=str(e))


@app.post("/ingest/add_source", response_model=IngestResponse)
async def ingest_add_source(request: IngestAddRequest):
    """Phase 2: Add a source to the prepared notebook."""
    try:
        await nlm_client.use_notebook(request.notebook_id)
        if request.url:
            success = await nlm_client.add_source(request.url, source_type="url")
            if success:
                return IngestResponse(success=True, source_id=generate_source_id(request.url))
            return IngestResponse(success=False, error="Failed to add source")
        elif request.text:
            title = request.title or "Untitled"
            success = await nlm_client.add_source(request.text, title=title, source_type="text")
            if success:
                return IngestResponse(success=True, source_id=generate_source_id(request.text[:100]))
            return IngestResponse(success=False, error="Failed to add text source")
        else:
            return IngestResponse(success=False, error="Either url or text must be provided")
    except Exception as e:
        return IngestResponse(success=False, error=str(e))


@app.post("/ingest", response_model=IngestResponse)
async def ingest(request: IngestRequest):
    """Ingest a URL or text to NotebookLM."""
    try:
        # Select notebook
        if request.notebook_id:
            await nlm_client.use_notebook(request.notebook_id)
        elif not nlm_client.current_notebook:
            notebook = await nlm_client.get_or_create_notebook("Omni-Bridge Inbox")
            await nlm_client.use_notebook(notebook.id)

        if request.url:
            # URL ingestion
            success = await nlm_client.add_source(request.url, source_type="url")
            if success:
                return IngestResponse(
                    success=True,
                    source_id=generate_source_id(request.url)
                )
            else:
                return IngestResponse(success=False, error="Failed to add source")

        elif request.text:
            # Text ingestion — notebooklm-py natively supports inline text
            title = request.title or "Untitled"
            logger.warning(f"[INGEST] text len={len(request.text)}, title={title!r}, notebook={nlm_client.current_notebook}")
            success = await nlm_client.add_source(request.text, title=title, source_type="text")
            logger.warning(f"[INGEST] add_source returned: {success}")
            if success:
                return IngestResponse(
                    success=True,
                    source_id=generate_source_id(request.text[:100])
                )
            else:
                return IngestResponse(success=False, error="Failed to add text source")
        else:
            return IngestResponse(success=False, error="Either url or text must be provided")

    except Exception as e:
        return IngestResponse(success=False, error=str(e))


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a chat message to NotebookLM."""
    try:
        # Select notebook
        if request.notebook_id:
            await nlm_client.use_notebook(request.notebook_id)
        elif not nlm_client.current_notebook:
            notebooks = await nlm_client.list_notebooks()
            if notebooks:
                await nlm_client.use_notebook(notebooks[0].id)
            else:
                notebook = await nlm_client.get_or_create_notebook("Omni-Bridge Chat")
                await nlm_client.use_notebook(notebook.id)

        response = await nlm_client.chat(request.message)
        return ChatResponse(response=response)

    except Exception as e:
        return ChatResponse(response="", error=str(e))


@app.get("/status")
async def status():
    """Get current status including auth and notebooks."""
    authenticated = await nlm_client.is_authenticated()
    if not authenticated:
        return {
            "connected": False,
            "authenticated": False,
            "current_notebook": None,
            "notebooks": [],
            "message": "請先執行 notebooklm login 登入"
        }

    try:
        notebooks = await nlm_client.list_notebooks()
        return {
            "connected": True,
            "authenticated": True,
            "current_notebook": nlm_client.current_notebook,
            "notebooks": [
                {
                    "id": nb.id,
                    "title": nb.title,
                    "is_owner": nb.is_owner,
                    "created_at": nb.created_at
                }
                for nb in notebooks
            ]
        }
    except Exception:
        return {
            "connected": True,
            "authenticated": True,
            "current_notebook": None,
            "notebooks": []
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
