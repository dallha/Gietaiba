export const mapToNewId = (id: string | number): string => {
  if (typeof id === 'string' && id.startsWith('GIE-T')) {
    return id;
  }
  // This is a simple placeholder migration logic.
  // In a real scenario, this would likely be a lookup table or a more sophisticated mapping.
  const numericId = parseInt(String(id), 10);
  if (isNaN(numericId)) return String(id);
  
  return `GIE-T${String(numericId).padStart(4, '0')}`;
};

export const migrateData = <T extends { id: string | number; code?: string }>(data: T[]): T[] => {
  return data.map((item) => ({
    ...item,
    id: mapToNewId(item.id),
    code: item.code || mapToNewId(item.id),
  }));
};
