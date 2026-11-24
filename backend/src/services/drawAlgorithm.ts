import crypto from 'node:crypto';

export interface DrawPair {
  giverId: number;
  receiverId: number;
  revealToken: string;
}

export interface DrawAlgorithmInput {
  participantIds: number[];
  exclusions: Array<{ giverId: number; excludedReceiverId: number }>;
  avoidReciprocal?: boolean;
}

export type DrawAlgorithmResult =
  | { success: true; pairs: DrawPair[] }
  | { success: false; error: string };

/**
 * Baraja una copia de un array usando crypto.randomInt (Fisher-Yates criptográficamente seguro).
 */
function secureShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Genera una asignación válida de Amigo Invisible respetando:
 * 1. Nadie se regala a sí mismo.
 * 2. Todas las exclusiones dirigidas configuradas.
 * 3. Opcionalmente, nadie forma un par recíproco (A -> B y B -> A) cuando hay 3 o más personas.
 */
export function runSecretSantaDraw(input: DrawAlgorithmInput): DrawAlgorithmResult {
  const uniqueIds = Array.from(new Set(input.participantIds));
  const n = uniqueIds.length;

  if (n < 3) {
    return {
      success: false,
      error: 'Se necesitan al menos 3 participantes para realizar un sorteo de Amigo Invisible.',
    };
  }

  const avoidReciprocal = Boolean(input.avoidReciprocal) && n >= 3;

  // Mapa de exclusiones: giverId -> Set de receiverIds prohibidos
  const forbidden = new Map<number, Set<number>>();
  for (const id of uniqueIds) {
    forbidden.set(id, new Set([id])); // Nadie puede regalarse a sí mismo
  }

  for (const ex of input.exclusions) {
    const set = forbidden.get(ex.giverId);
    if (set && uniqueIds.includes(ex.excludedReceiverId)) {
      set.add(ex.excludedReceiverId);
    }
  }

  // Lista de candidatos permitidos por cada participante (barajados aleatoriamente)
  const allowedByGiver = new Map<number, number[]>();
  const allowedIncomingCount = new Map<number, number>();
  for (const id of uniqueIds) {
    allowedIncomingCount.set(id, 0);
  }

  for (const giverId of uniqueIds) {
    const blocked = forbidden.get(giverId)!;
    const candidates = secureShuffle(uniqueIds.filter((candidateId) => !blocked.has(candidateId)));
    if (candidates.length === 0) {
      return {
        success: false,
        error:
          'Hay al menos un participante que no tiene a nadie disponible a quien regalar debido a las exclusiones.',
      };
    }
    allowedByGiver.set(giverId, candidates);
    for (const c of candidates) {
      allowedIncomingCount.set(c, (allowedIncomingCount.get(c) ?? 0) + 1);
    }
  }

  // Comprobar que cada participante pueda ser elegido por al menos una persona
  for (const id of uniqueIds) {
    if ((allowedIncomingCount.get(id) ?? 0) === 0) {
      return {
        success: false,
        error:
          'Hay al menos un participante excluido por todos los demás; nadie podría regalarle.',
      };
    }
  }

  const assignment = new Map<number, number>();
  const usedReceivers = new Set<number>();
  const unassigned = new Set<number>(uniqueIds);

  const MAX_BACKTRACK_STEPS = 150_000;
  let steps = 0;

  function getValidCandidates(giverId: number): number[] {
    const all = allowedByGiver.get(giverId)!;
    const result: number[] = [];
    for (const candidate of all) {
      if (usedReceivers.has(candidate)) continue;
      if (avoidReciprocal && assignment.get(candidate) === giverId) continue;
      result.push(candidate);
    }
    return result;
  }

  function backtrack(): boolean {
    if (unassigned.size === 0) {
      return true;
    }

    steps++;
    if (steps > MAX_BACKTRACK_STEPS) {
      return false;
    }

    // Heurística MRV (Minimum Remaining Values): elegir primero al participante más restringido
    let chosenGiver: number | null = null;
    let chosenCandidates: number[] = [];

    for (const giverId of unassigned) {
      const candidates = getValidCandidates(giverId);
      if (candidates.length === 0) {
        return false; // Poda inmediata
      }
      if (chosenGiver === null || candidates.length < chosenCandidates.length) {
        chosenGiver = giverId;
        chosenCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }

    if (chosenGiver === null) {
      return false;
    }

    unassigned.delete(chosenGiver);

    for (const receiverId of chosenCandidates) {
      assignment.set(chosenGiver, receiverId);
      usedReceivers.add(receiverId);

      if (backtrack()) {
        return true;
      }

      assignment.delete(chosenGiver);
      usedReceivers.delete(receiverId);
    }

    unassigned.add(chosenGiver);
    return false;
  }

  const solved = backtrack();
  if (!solved) {
    return {
      success: false,
      error: avoidReciprocal
        ? 'No existe ninguna combinación válida con las exclusiones actuales y evitando regalos mutuos. Prueba a quitar alguna exclusión o desactivar "Evitar regalos mutuos".'
        : 'No existe ninguna combinación válida con las exclusiones actuales. Revisa o reduce las exclusiones.',
    };
  }

  const pairs: DrawPair[] = uniqueIds.map((giverId) => ({
    giverId,
    receiverId: assignment.get(giverId)!,
    revealToken: crypto.randomBytes(24).toString('hex'),
  }));

  return { success: true, pairs };
}
