"""
NotebookLM Client - Async wrapper around notebooklm-py.
"""
import subprocess
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

DEFAULT_STORAGE = Path.home() / '.notebooklm' / 'storage_state.json'


@dataclass
class Notebook:
    id: str
    title: str
    is_owner: bool
    created_at: str


class NotebookLMClient:
    """Async wrapper for notebooklm-py CLI."""
    
    def __init__(self, storage_path: Path = DEFAULT_STORAGE):
        self.storage_path = storage_path
        self._current_notebook: Optional[str] = None
    
    async def list_notebooks(self) -> list[Notebook]:
        """List all notebooks."""
        result = await self._run_cli(['list', '--json'])
        
        # Handle error case
        if result.returncode != 0:
            return []
        
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            return []
            
        return [
            Notebook(
                id=nb['id'],
                title=nb['title'],
                is_owner=nb['is_owner'],
                created_at=nb['created_at']
            )
            for nb in data.get('notebooks', [])
        ]
    
    async def get_notebook(self, notebook_id: str) -> Optional[Notebook]:
        """Get a specific notebook by ID."""
        notebooks = await self.list_notebooks()
        for nb in notebooks:
            if nb.id == notebook_id or nb.id.startswith(notebook_id):
                return nb
        return None
    
    async def get_or_create_notebook(self, name: str) -> Notebook:
        """Get existing notebook or create new one."""
        notebooks = await self.list_notebooks()
        
        # Try to find by partial match
        for nb in notebooks:
            if name.lower() in nb.title.lower():
                self._current_notebook = nb.id
                return nb
        
        # Create new notebook
        await self._run_cli(['create', name])
        notebooks = await self.list_notebooks()
        
        # Find the newly created notebook
        for nb in notebooks:
            if nb.title == name:
                self._current_notebook = nb.id
                return nb
        
        raise ValueError(f"Failed to create notebook: {name}")
    
    async def use_notebook(self, notebook_id: str) -> bool:
        """Set current notebook context."""
        result = await self._run_cli(['use', notebook_id])
        self._current_notebook = notebook_id
        return result.returncode == 0
    
    async def add_source(self, url: str) -> bool:
        """Add URL source to current notebook."""
        if not self._current_notebook:
            raise ValueError("No notebook selected. Call use_notebook() first.")
        
        result = await self._run_cli(['source', 'add', url])
        return result.returncode == 0
    
    async def chat(self, message: str) -> str:
        """Send chat message to current notebook."""
        if not self._current_notebook:
            raise ValueError("No notebook selected. Call use_notebook() first.")
        
        result = await self._run_cli(['ask', message])
        if result.returncode != 0:
            raise RuntimeError(f"Chat failed: {result.stderr}")
        return result.stdout
    
    async def _run_cli(self, args: list[str]) -> subprocess.CompletedProcess:
        """Run notebooklm CLI command."""
        cmd = ['python3.11', '-m', 'notebooklm'] + args
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True
        )
    
    @property
    def current_notebook(self) -> Optional[str]:
        """Get current notebook ID."""
        return self._current_notebook
