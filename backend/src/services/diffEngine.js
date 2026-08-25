export function createDiff(before='', after='') {
  return {
    removed: before ? before.split('\n').length : 0,
    added: after ? after.split('\n').length : 0,
    before,
    after
  };
}
