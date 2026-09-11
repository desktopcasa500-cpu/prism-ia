export function detectFileType(name='') {
  const ext = name.split('.').pop()?.toLowerCase();
  const types = {
    pdf:'document', zip:'project', js:'code', ts:'code', jsx:'code', tsx:'code', html:'web', css:'style', json:'config', md:'text'
  };
  return types[ext] || 'unknown';
}

export function analyzeProject(file) {
  return {
    name: file?.name || 'unknown',
    type: detectFileType(file?.name),
    status: 'ready',
    actions: ['read','edit','generate']
  };
}
