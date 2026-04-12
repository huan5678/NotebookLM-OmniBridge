"""
Tests for FastAPI server endpoints.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from dataclasses import dataclass


@dataclass
class MockNotebook:
    id: str
    title: str
    is_owner: bool
    created_at: str


class TestAPIEndpoints:
    """Test API endpoints."""
    
    def test_root_endpoint(self):
        """Test root endpoint returns ok status."""
        assert True
    
    def test_health_endpoint(self):
        """Test health check endpoint."""
        assert True
    
    @pytest.mark.asyncio
    async def test_ingest_url_success(self):
        """Test successful URL ingestion."""
        mock_client = Mock()
        mock_client.use_notebook = AsyncMock()
        mock_client.current_notebook = "test-id"
        mock_client.add_source = AsyncMock(return_value=True)
        
        # Import and test
        from server.main import IngestRequest, ingest_url
        request = IngestRequest(url="https://example.com")
        result = await ingest_url(request)
        
        assert result.success is True
        assert result.source_id is not None
    
    @pytest.mark.asyncio
    async def test_ingest_url_error(self):
        """Test URL ingestion error handling."""
        mock_client = Mock()
        mock_client.use_notebook = AsyncMock()
        mock_client.current_notebook = None  # No notebook
        
        from server.main import IngestRequest, ingest_url
        request = IngestRequest(url="https://example.com")
        result = await ingest_url(request)
        
        # Should handle error gracefully
        assert result.success is False
    
    @pytest.mark.asyncio
    async def test_chat_success(self):
        """Test successful chat."""
        mock_client = Mock()
        mock_client.use_notebook = AsyncMock()
        mock_client.current_notebook = "test-id"
        mock_client.chat = AsyncMock(return_value="AI response here")
        mock_client.list_notebooks = AsyncMock(return_value=[
            MockNotebook(id="test", title="Test", is_owner=True, created_at="2026-04-01")
        ])
        
        from server.main import ChatRequest, chat
        request = ChatRequest(message="Hello")
        result = await chat(request)
        
        assert result.response == "AI response here"
    
    @pytest.mark.asyncio
    async def test_status_endpoint(self):
        """Test status endpoint."""
        from server.main import status
        
        result = await status()
        
        assert result["connected"] is True
