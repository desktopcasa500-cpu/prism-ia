export default function McpContextBar({ servers = [], activeIds = [], onToggle }) {
  return <div className="pcx-mcp-line" aria-label="Ferramentas">
    <span className="pcx-mcp-label">Ferramentas</span>
    {servers.map((server) => {
      const active = activeIds.includes(server.id);
      return <button
        key={server.id}
        className={`pcx-mcp-item ${active ? 'active' : ''}`}
        onClick={() => onToggle?.(server.id)}
        aria-pressed={active}
        title={`${server.name}: ${active ? 'ligado' : 'desligado'}`}
      >
        <i />
        {server.name}
      </button>;
    })}
    {!servers.length && <span className="pcx-mcp-empty">Nenhuma ferramenta conectada</span>}
  </div>;
}
