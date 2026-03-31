---
version: 2.1
milestone: v2.1 Online Multiplayer
created: 2026-03-31
---

# Dropfall v2.1 Requirements

## Active Requirements

### Online Input Routing

- [ ] **ONLINE-01**: Player 2 can control their blue ball when joining as client
- [ ] **ONLINE-02**: Player input mapped to assigned player slot, not hardcoded Player 1

### Player Slot Assignment

- [ ] **ONLINE-03**: Server assigns player slot on client connect
- [ ] **ONLINE-04**: Client knows "I am player N" (stored in game state)
- [ ] **ONLINE-05**: Input handler reads assigned slot, routes to correct player

### Visual Verification

- [ ] **ONLINE-06**: Both players see red ball (Player 1) and blue ball (Player 2)
- [ ] **ONLINE-07**: Names displayed above each ball (already working)

### Integration Testing

- [ ] **ONLINE-08**: Server host can control red ball with Player 1 keys
- [ ] **ONLINE-09**: Client can control blue ball with Player 1 keys
- [ ] **ONLINE-10**: No regression in 1P/2P local modes

### Scalability (Design)

- [ ] **ONLINE-11**: Architecture supports 3+ player slots (green, yellow, etc.)
- [ ] **ONLINE-12**: Player colors assigned by slot number

---

## Future Requirements (Out of Scope)

- 3+ player actual implementation
- Room/lobby system
- Spectator mode

---

## Out of Scope

- New game modes or arenas
- Performance optimization
- UI redesign

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ONLINE-01 | 1 | Not Started |
| ONLINE-02 | 1 | Not Started |
| ONLINE-03 | 1 | Not Started |
| ONLINE-04 | 1 | Not Started |
| ONLINE-05 | 1 | Not Started |
| ONLINE-06 | 1 | Not Started |
| ONLINE-07 | - | Existing |
| ONLINE-08 | 2 | Not Started |
| ONLINE-09 | 2 | Not Started |
| ONLINE-10 | 2 | Not Started |
| ONLINE-11 | 1 | Not Started |
| ONLINE-12 | 1 | Not Started |

---

*Created: 2026-03-31 at v2.1 milestone start*
