"""
Unit tests for NotebookLMClient.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from pathlib import Path
from notebooklm_client import NotebookLMClient
from notebooklm_client.client import CLIResult


class TestNotebookLMClient:
    """Test cases for NotebookLMClient."""

    @pytest.fixture
    def client(self):
        return NotebookLMClient(storage_path=Path('/tmp/test_storage.json'))

    def _mock_cli(self, returncode=0, stdout='', stderr=''):
        """Helper to mock _run_cli."""
        result = CLIResult(returncode=returncode, stdout=stdout, stderr=stderr)
        return AsyncMock(return_value=result)

    @pytest.mark.asyncio
    async def test_list_notebooks(self, client):
        json_out = '{"notebooks": [{"id": "abc123", "title": "Test", "is_owner": true, "created_at": "2026-04-01"}]}'
        client._run_cli = self._mock_cli(stdout=json_out)

        notebooks = await client.list_notebooks()

        assert len(notebooks) == 1
        assert notebooks[0].title == "Test"
        assert notebooks[0].id == "abc123"

    @pytest.mark.asyncio
    async def test_list_notebooks_empty_on_error(self, client):
        client._run_cli = self._mock_cli(returncode=1, stderr='Auth required')

        notebooks = await client.list_notebooks()

        assert len(notebooks) == 0

    @pytest.mark.asyncio
    async def test_get_or_create_notebook_existing(self, client):
        json_out = '{"notebooks": [{"id": "abc123", "title": "My Notes", "is_owner": true, "created_at": "2026-04-01"}]}'
        client._run_cli = self._mock_cli(stdout=json_out)

        notebook = await client.get_or_create_notebook("My Notes")

        assert notebook.title == "My Notes"
        assert client.current_notebook == "abc123"

    @pytest.mark.asyncio
    async def test_use_notebook(self, client):
        client._run_cli = self._mock_cli()

        result = await client.use_notebook("test-id")

        assert result is True
        assert client.current_notebook == "test-id"

    @pytest.mark.asyncio
    async def test_add_source_success(self, client):
        client._run_cli = self._mock_cli()
        client._current_notebook = 'test-id'

        result = await client.add_source('https://example.com')

        assert result is True

    @pytest.mark.asyncio
    async def test_add_source_with_title(self, client):
        mock = self._mock_cli()
        client._run_cli = mock
        client._current_notebook = 'test-id'

        await client.add_source('Some text content', title='My Title')

        mock.assert_called_once_with(['source', 'add', 'Some text content', '--title', 'My Title'])

    @pytest.mark.asyncio
    async def test_chat_success(self, client):
        client._run_cli = self._mock_cli(stdout='AI response\n')
        client._current_notebook = 'test-id'

        response = await client.chat('Hello world')

        assert response == 'AI response'

    @pytest.mark.asyncio
    async def test_add_source_requires_notebook(self, client):
        with pytest.raises(ValueError, match="No notebook selected"):
            await client.add_source("https://example.com")

    @pytest.mark.asyncio
    async def test_chat_requires_notebook(self, client):
        with pytest.raises(ValueError, match="No notebook selected"):
            await client.chat("Hello")

    @pytest.mark.asyncio
    async def test_is_authenticated_no_storage(self, client):
        client.storage_path = Path('/nonexistent/path')

        result = await client.is_authenticated()

        assert result is False
