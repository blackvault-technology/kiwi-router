export type SessionStorageLike = Pick<Storage, "getItem" | "setItem">;

export function playgroundSessionKeyId(apiKeyId: string) {
  return `kiwi-playground-key:${apiKeyId}`;
}

export function rememberPlaygroundKey(storage: SessionStorageLike, apiKeyId: string, plainKey: string) {
  storage.setItem(playgroundSessionKeyId(apiKeyId), plainKey);
}

export function selectPlaygroundKey(storage: Pick<Storage, "getItem">, apiKeyId: string) {
  return apiKeyId ? storage.getItem(playgroundSessionKeyId(apiKeyId)) : null;
}
