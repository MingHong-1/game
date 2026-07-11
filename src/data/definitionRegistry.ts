interface IdentifiableDefinition {
  readonly id: string;
}

export function createDefinitionMap<T extends IdentifiableDefinition>(
  definitions: readonly T[],
  definitionName: string,
): ReadonlyMap<string, T> {
  const definitionMap = new Map<string, T>();

  for (const definition of definitions) {
    if (definitionMap.has(definition.id)) {
      throw new Error(`${definitionName}存在重复 id：${definition.id}`);
    }
    definitionMap.set(definition.id, definition);
  }

  return definitionMap;
}
