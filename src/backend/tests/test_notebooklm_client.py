"""
Unit tests for NotebookLMClient.
"""
import pytest
import asyncio
from unittest.mock import Mock, patch
from pathlib import Path
from notebooklm_client import NotebookLMClient


class TestNotebookLMClient:
    """Test cases for NotebookLMClient."""
    
    @pytest.fixture
    def client(self):
        """Create a client instance."""
        return NotebookLMClient(storage_path=Path('/tmp/test_storage.json'))
    
    @pytest.mark.asyncio
    async def test_list_notebooks(self, client):
        """Test listing notebooks."""
        mock_response = {
            "notebooks": [
                {"id": "abc123", "title": "Test", "is_owner": True, "created_at": "2026-04-01"}
            ]
        }
        
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(
                returncode=0,
                stdout='{"notebooks": [{"id": "abc123", "title": "Test", "is_owner": true, "created_at": "2026-04-01"}]}',
                stderr=''
            )
            
            notebooks = await client.list_notebooks()
            
            assert len(notebooks) == 1
            assert notebooks[0].title == "Test"
    
    @pytest.mark.asyncio
    async def test_get_or_create_notebook_existing(self, client):
        """Test getting existing notebook."""
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(
                returncode=0,
                stdout='{"notebooks": [{"id": "abc123", "title": "My Notes", "is_owner": true, "created_at": "2026-04-01"}]}',
                stderr=''
            )
            
            notebook = await client.get_or_create_notebook("My Notes")
            
            assert notebook.title == "My Notes"
            assert client.current_notebook == "abc123"
    
    @pytest.mark.asyncio
    async def test_add_source_success(self, client):
        """Test adding source to notebook."""
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='OK', stderr='')
            client._current_notebook = 'test-id'
            
            result = await client.add_source('https://example.com')
            
            assert result is True
            mock_run.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_chat_success(self, client):
        """Test sending chat message."""
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='AI response', stderr='')
            client._current_notebook = 'test-id'
            
            response = await client.chat('Hello world')
            
            assert response == 'AI response'
    
    @pytest.mark.asyncio
    async def test_add_source_requires_notebook(self, client):
        """Test that adding source requires notebook selection."""
        with pytest.raises(ValueError, match="No notebook selected"):
            await client.add_source("https://example.com")
    
    @pytest.mark.asyncio
    async def test_chat_requires_notebook(self, client):
        """Test that chat requires notebook selection."""
        with pytest.raises(ValueError, match="No notebook selected"):
            await client.chat("Hello")
    
    @pytest.mark.asyncio
    async def test_handle_auth_error(self, client):
        """Test handling authentication errors."""
        with patch('notebooklm_client.client.subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=1, stdout='', stderr='Auth required')
            
            notebooks = await client.list_notebooks()
            
            # Should return empty list on error
            assert len(notebooks) == 0
