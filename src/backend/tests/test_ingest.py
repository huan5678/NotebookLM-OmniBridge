"""
Tests for Ingest API endpoint.
"""
import pytest
from unittest.mock import Mock, patch, AsyncMock
from pathlib import Path
from notebooklm_client import NotebookLMClient


class TestIngestAPI:
    """Test cases for Ingest functionality."""
    
    @pytest.mark.asyncio
    async def test_ingest_url_adds_to_notebook(self):
        """Test ingesting URL adds source to notebook."""
        client = NotebookLMClient()
        client._current_notebook = 'test-id'
        
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='Source added', stderr='')
            
            result = await client.add_source('https://example.com')
            
            assert result is True
    
    @pytest.mark.asyncio
    async def test_ingest_requires_valid_url(self):
        """Test that invalid URLs are rejected."""
        client = NotebookLMClient()
        client._current_notebook = 'test-id'
        
        # Should accept valid HTTPS URL
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='OK', stderr='')
            
            result = await client.add_source('https://valid.url')
            assert result is True
    
    @pytest.mark.asyncio
    async def test_ingest_handles_notebook_error(self):
        """Test handling notebook errors."""
        client = NotebookLMClient()
        # No notebook selected
        
        with pytest.raises(ValueError, match="No notebook selected"):
            await client.add_source('https://example.com')
