import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runSecretSantaDraw } from './drawAlgorithm.js';

describe('Algoritmo de sorteo Amigo Invisible', () => {
  it('rechaza sorteos con menos de 3 participantes', () => {
    const res = runSecretSantaDraw({ participantIds: [1, 2], exclusions: [] });
    assert.equal(res.success, false);
  });

  it('genera una biyección válida sin auto-regalos para 3, 5, 10 y 30 participantes', () => {
    for (const size of [3, 5, 10, 30]) {
      const ids = Array.from({ length: size }, (_, i) => i + 1);
      const res = runSecretSantaDraw({
        participantIds: ids,
        exclusions: [],
        avoidReciprocal: true,
      });

      assert.equal(res.success, true, `Debería resolverse para ${size} participantes`);
      if (!res.success) continue;

      assert.equal(res.pairs.length, size);
      const givers = new Set(res.pairs.map((p) => p.giverId));
      const receivers = new Set(res.pairs.map((p) => p.receiverId));
      assert.equal(givers.size, size);
      assert.equal(receivers.size, size);

      const map = new Map(res.pairs.map((p) => [p.giverId, p.receiverId]));
      for (const p of res.pairs) {
        assert.notEqual(p.giverId, p.receiverId, 'Nadie puede regalarse a sí mismo');
        assert.notEqual(
          map.get(p.receiverId),
          p.giverId,
          'No debería haber parejas recíprocas cuando avoidReciprocal=true'
        );
        assert.equal(p.revealToken.length, 48);
      }
    }
  });

  it('respeta exclusiones de parejas (bidireccionales)', () => {
    // 3 parejas: (1,2), (3,4), (5,6)
    const ids = [1, 2, 3, 4, 5, 6];
    const exclusions = [
      { giverId: 1, excludedReceiverId: 2 },
      { giverId: 2, excludedReceiverId: 1 },
      { giverId: 3, excludedReceiverId: 4 },
      { giverId: 4, excludedReceiverId: 3 },
      { giverId: 5, excludedReceiverId: 6 },
      { giverId: 6, excludedReceiverId: 5 },
    ];

    for (let trial = 0; trial < 25; trial++) {
      const res = runSecretSantaDraw({
        participantIds: ids,
        exclusions,
        avoidReciprocal: true,
      });
      assert.equal(res.success, true);
      if (!res.success) continue;

      for (const pair of res.pairs) {
        const forbidden = exclusions.some(
          (e) => e.giverId === pair.giverId && e.excludedReceiverId === pair.receiverId
        );
        assert.equal(forbidden, false, 'Se violó una exclusión de pareja');
      }
    }
  });

  it('detecta exclusiones imposibles con error claro', () => {
    // 1 no puede regalar a 2 ni a 3 -> imposible
    const res = runSecretSantaDraw({
      participantIds: [1, 2, 3],
      exclusions: [
        { giverId: 1, excludedReceiverId: 2 },
        { giverId: 1, excludedReceiverId: 3 },
      ],
    });
    assert.equal(res.success, false);
  });

  it('detecta cuando avoidReciprocal hace el sorteo imposible pero funciona al desactivarlo', () => {
    // 4 personas divididas en dos parejas excluidas entre sí:
    // (1,2) no pueden regalarse entre ellos, y (3,4) no pueden regalarse entre ellos.
    // Aún existe ciclo 1->3->2->4->1 (no recíproco), así que probamos un caso forzado a 2-ciclo:
    // 1 solo puede a 2, 2 solo puede a 1 (3 y 4 excluidos para 1 y 2)
    const ids = [1, 2, 3, 4];
    const exclusions = [
      { giverId: 1, excludedReceiverId: 3 },
      { giverId: 1, excludedReceiverId: 4 },
      { giverId: 2, excludedReceiverId: 3 },
      { giverId: 2, excludedReceiverId: 4 },
    ];

    const strict = runSecretSantaDraw({
      participantIds: ids,
      exclusions,
      avoidReciprocal: true,
    });
    assert.equal(strict.success, false);

    const relaxed = runSecretSantaDraw({
      participantIds: ids,
      exclusions,
      avoidReciprocal: false,
    });
    assert.equal(relaxed.success, true);
  });
});
