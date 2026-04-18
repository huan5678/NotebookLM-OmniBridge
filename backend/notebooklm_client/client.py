"""
NotebookLM Client - Async wrapper around notebooklm-py CLI.
"""
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Optional
from dataclasses import dataclass

logger = logging.getLogger("omni-bridge")

DEFAULT_STORAGE = Path.home() / '.notebooklm' / 'storage_state.json'


@dataclass
class CLIResult:
    returncode: int
    stdout: str
    stderr: str


@dataclass
class Source:
    id: str
    title: str
    type: str
    url: Optional[str] = None
    status: str = "ready"
    created_at: str = ""


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

    async def is_authenticated(self) -> bool:
        """Check if notebooklm-py has valid auth."""
        if not self.storage_path.exists():
            return False
        result = await self._run_cli(['status'])
        return result.returncode == 0

    async def list_notebooks(self) -> list[Notebook]:
        """List all notebooks."""
        result = await self._run_cli(['list', '--json'])
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
                is_owner=nb.get('is_owner', True),
                created_at=nb.get('created_at', '')
            )
            for nb in data.get('notebooks', [])
        ]

    async def get_notebook(self, notebook_id: str) -> Optional[Notebook]:
        """Get a specific notebook by ID (supports partial match)."""
        notebooks = await self.list_notebooks()
        for nb in notebooks:
            if nb.id == notebook_id or nb.id.startswith(notebook_id):
                return nb
        return None

    async def get_or_create_notebook(self, name: str) -> Notebook:
        """Get existing notebook by exact title match, or create new one."""
        notebooks = await self.list_notebooks()
        for nb in notebooks:
            if name.lower() == nb.title.lower():
                self._current_notebook = nb.id
                return nb

        await self._run_cli(['create', name])
        notebooks = await self.list_notebooks()
        for nb in notebooks:
            if nb.title == name:
                self._current_notebook = nb.id
                return nb

        raise ValueError(f"Failed to create notebook: {name}")

    async def use_notebook(self, notebook_id: str) -> bool:
        """Set current notebook context."""
        result = await self._run_cli(['use', notebook_id])
        if result.returncode == 0:
            self._current_notebook = notebook_id
        return result.returncode == 0

    async def add_source(self, content: str, title: Optional[str] = None, source_type: Optional[str] = None) -> bool:
        """Add a source to current notebook.

        content can be a URL, file path, or inline text.
        notebooklm-py auto-detects the type unless source_type is given.
        source_type: "url", "text", "file", "youtube"
        """
        if not self._current_notebook:
            raise ValueError("No notebook selected. Call use_notebook() first.")

        args = ['source', 'add', content, '-n', self._current_notebook]
        if source_type:
            args.extend(['--type', source_type])
        if title:
            args.extend(['--title', title])
        result = await self._run_cli(args)
        logger.warning(f"[CLI] source add returncode={result.returncode}, stdout={result.stdout[:200]!r}, stderr={result.stderr[:200]!r}")
        return result.returncode == 0

    async def list_sources(self, notebook_id: Optional[str] = None) -> list[Source]:
        """List all sources in a notebook."""
        nb_id = notebook_id or self._current_notebook
        if not nb_id:
            raise ValueError("No notebook selected. Call use_notebook() first.")

        args = ['source', 'list', '--json', '-n', nb_id]
        result = await self._run_cli(args)
        if result.returncode != 0:
            return []

        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError:
            return []

        return [
            Source(
                id=s['id'],
                title=s.get('title', ''),
                type=s.get('type', 'unknown'),
                url=s.get('url'),
                status=s.get('status', 'ready'),
                created_at=s.get('created_at', ''),
            )
            for s in data.get('sources', [])
        ]

    async def delete_source(self, source_id: str, notebook_id: Optional[str] = None) -> bool:
        """Delete a source from a notebook."""
        nb_id = notebook_id or self._current_notebook
        if not nb_id:
            raise ValueError("No notebook selected. Call use_notebook() first.")

        args = ['source', 'delete', source_id, '-y', '-n', nb_id]
        result = await self._run_cli(args)
        return result.returncode == 0

    async def rename_source(self, source_id: str, new_title: str, notebook_id: Optional[str] = None) -> bool:
        """Rename a source in a notebook."""
        nb_id = notebook_id or self._current_notebook
        if not nb_id:
            raise ValueError("No notebook selected. Call use_notebook() first.")

        args = ['source', 'rename', source_id, new_title, '-n', nb_id]
        result = await self._run_cli(args)
        return result.returncode == 0

    async def chat(self, message: str) -> str:
        """Send chat message to current notebook."""
        if not self._current_notebook:
            raise ValueError("No notebook selected. Call use_notebook() first.")

        result = await self._run_cli(['ask', message, '-n', self._current_notebook])
        if result.returncode != 0:
            raise RuntimeError(f"Chat failed: {result.stderr}")
        return result.stdout.strip()

    async def _run_cli(self, args: list[str]) -> CLIResult:
        """Run notebooklm CLI command asynchronously."""
        cmd = [sys.executable, '-m', 'notebooklm',
               '--storage', str(self.storage_path)] + args

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout_bytes, stderr_bytes = await proc.communicate()

        return CLIResult(
            returncode=proc.returncode or 0,
            stdout=stdout_bytes.decode(),
            stderr=stderr_bytes.decode(),
        )

    @property
    def current_notebook(self) -> Optional[str]:
        """Get current notebook ID."""
        return self._current_notebook
