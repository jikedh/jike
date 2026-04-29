export type SequencedMediaItem<
  T extends Record<string, any> = Record<string, any>,
> = T & {
  sequence?: number;
  mediaIndex?: number;
  order?: number;
};

const getStoredSequence = (item: SequencedMediaItem | undefined) => {
  const value = item?.sequence ?? item?.mediaIndex ?? item?.order;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.floor(numericValue)
    : undefined;
};

export const getMediaSequence = (
  item: SequencedMediaItem | undefined,
  fallbackIndex: number,
) => getStoredSequence(item) ?? fallbackIndex + 1;

export const assignMissingMediaSequences = <T extends Record<string, any>>(
  items: T[],
): Array<SequencedMediaItem<T>> => {
  let maxSequence = items.reduce((max, item) => {
    return Math.max(max, getStoredSequence(item) ?? 0);
  }, 0);

  return items.map((item, index) => {
    const sequence = getStoredSequence(item);
    if (sequence) {
      return {
        ...item,
        sequence,
      };
    }

    maxSequence += 1;
    return {
      ...item,
      sequence: maxSequence || index + 1,
    };
  });
};

export const appendMediaSequences = <T extends Record<string, any>>(
  existingItems: T[],
  incomingItems: T[],
): Array<SequencedMediaItem<T>> => {
  const normalizedExisting = assignMissingMediaSequences(existingItems);
  let nextSequence = normalizedExisting.reduce((max, item) => {
    return Math.max(max, getStoredSequence(item) ?? 0);
  }, 0);

  const normalizedIncoming = incomingItems.map((item) => {
    const sequence = getStoredSequence(item);
    if (sequence) {
      nextSequence = Math.max(nextSequence, sequence);
      return {
        ...item,
        sequence,
      };
    }

    nextSequence += 1;
    return {
      ...item,
      sequence: nextSequence,
    };
  });

  return [...normalizedIncoming, ...normalizedExisting];
};
