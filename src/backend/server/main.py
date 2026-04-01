"""
NotebookLM Omni-Bridge Backend API Server.
FastAPI server for handling ingestion and chat requests.
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio
import os
import sys
import hashlib

# Add parent to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from notebooklm_client import NotebookLMClient

app = FastAPI(title="NotebookLM Omni-Bridge API")

# Global client instance
nlm_client = NotebookLMClient()


# Request models
class IngestRequest(BaseModel):
    url: str
    notebook_id: Optional[str] = None


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


def generate_source_id(url: str) -> str:
    """Generate a unique source ID from URL."""
    hash_obj = hashlib.md5(url.encode())
    return f"src_{hash_obj.hexdigest()[:8]}"


@app.post("/ingest", response_model=IngestResponse)
async def ingest_url(request: IngestRequest):
    """Ingest a URL to NotebookLM."""
    try:
        # Select notebook
        if request.notebook_id:
            await nlm_client.use_notebook(request.notebook_id)
        elif not nlm_client.current_notebook:
            # Get or create default
            notebook = await nlm_client.get_or_create_notebook("Omni-Bridge Inbox")
            await nlm_client.use_notebook(notebook.id)
        
        # Add source
        success = await nlm_client.add_source(request.url)
        
        if success:
            return IngestResponse(
                success=True,
                source_id=generate_source_id(request.url)
            )
        else:
            return IngestResponse(success=False, error="Failed to add source")
            
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
            # Try to use first available or create new
            notebooks = await nlm_client.list_notebooks()
            if notebooks:
                await nlm_client.use_notebook(notebooks[0].id)
            else:
                notebook = await nlm_client.get_or_create_notebook("Omni-Bridge Chat")
                await nlm_client.use_notebook(notebook.id)
        
        # Send message
        response = await nlm_client.chat(request.message)
        
        return ChatResponse(response=response)
        
    except Exception as e:
        return ChatResponse(response="", error=str(e))


@app.get("/status")
async def status():
    """Get current status."""
    return {
        "current_notebook": nlm_client.current_notebook,
        "connected": True
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
