export default function McpContextBar({ servers = [], activeIds = [], onToggle }) {
  return <div className="pcx-mcp-line" aria-label="Ferramentas MCP">
    <span className="pcx-mcp-label">Ferramentas</span>
    {servers.map((server) => {
      const active = activeIds.includes(server.id);
      return <button key={server.id} className={`pcx-mcp-item ${active ? 'active' : ''}`} onClick={() => onToggle?.(server.id)} aria-pressed={active}>
        <i />{server.name}<small>{active ? 'ligado' : 'desligado'}</small>
      </button>;
    })}
    {!servers.length && <span className="pcx-mcp-empty">Nenhuma ferramenta conectada</span>}
  </div>;
}
