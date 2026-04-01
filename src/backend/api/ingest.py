"""
Ingest API - Handle URL ingestion to NotebookLM.
"""
from typing import Optional
from dataclasses import dataclass
from notebooklm_client import NotebookLMClient
import asyncio


@dataclass
class IngestResult:
    success: bool
    source_id: Optional[str] = None
    error: Optional[str] = None


class IngestAPI:
    """API for ingesting URLs to NotebookLM."""
    
    def __init__(self):
        self.client = NotebookLMClient()
    
    async def ingest_url(self, url: str, notebook_id: Optional[str] = None) -> IngestResult:
        """Ingest a URL to NotebookLM."""
        # Validate URL
        try:
            parsed = urlparse(url)
            if not parsed.scheme or not parsed.netloc:
                return IngestResult(success=False, error="Invalid URL format")
        except Exception as e:
            return IngestResult(success=False, error=str(e))
        
        # Select notebook
        if notebook_id:
            await self.client.use_notebook(notebook_id)
        elif not self.client.current_notebook:
            # Try to get or create default notebook
            try:
                await self.client.get_or_create_notebook("Omni-Bridge Inbox")
            except Exception as e:
                return IngestResult(success=False, error=f"No notebook: {e}")
        
        # Add source
        try:
            success = await self.client.add_source(url)
            if success:
                return IngestResult(
                    success=True,
                    source_id=f"src_{hash(url)[:8]}"
                )
            else:
                return IngestResult(success=False, error="Failed to add source")
        except Exception as e:
            return IngestResult(success=False, error=str(e))


from urllib.parse import urlparse


async def handle_ingest_request(url: str, notebook_id: Optional[str] = None) -> dict:
    """Handle HTTP request for ingestion."""
    api = IngestAPI()
    result = await api.ingest_url(url, notebook_id)
    
    return {
        "success": result.success,
        "sourceId": result.source_id,
        "error": result.error
    }
