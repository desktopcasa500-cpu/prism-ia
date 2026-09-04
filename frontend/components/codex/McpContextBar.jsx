export default function McpContextBar({ servers = [], activeIds = [], onToggle }) {
  return <div className="cx-mcp-bar">
    <span className="cx-mcp-title">MCP / CONTEXTO</span>
    {servers.map((server) => {
      const active = activeIds.includes(server.id);
      return <button key={server.id} className={`cx-mcp-chip ${active ? 'active' : ''} ${server.builtin ? 'builtin' : ''}`} onClick={() => onToggle(server.id)} aria-pressed={active}>
        <i/>{server.name}{active ? ' · ON' : ' · OFF'}
      </button>;
    })}
    {!servers.length && <span className="cx-mcp-empty">Nenhum servidor conectado</span>}
  </div>;
}
