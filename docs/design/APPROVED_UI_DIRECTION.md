# MebelFlow AI approved UI direction

Status: approved on 2026-08-12.

Canonical visual references:

- `approved/desktop-ai-editor-v3.png`
- `approved/mobile-super-screen-v1.png`

## Product hierarchy

1. The kitchen scene is the primary visual object.
2. The AI architect console is the primary interaction object.
3. Module properties, library and action history are contextual tools.
4. Desktop uses a wide editor; mobile follows kitchen → AI → properties → library → history.

## Visual tokens

- Bone canvas: `#f2efe7`
- Chalk surface: `#fbfaf6`
- Graphite: `#20231f`
- Muted text: `#62655f`
- Aluminium line: `#c9cbc3`
- Olive action: `#697048`
- Deep olive: `#505735`
- Warning orange: `#d96c20`
- Success olive: `#758052`

No purple or blue AI gradients, neon, glassmorphism or generic dashboard cards.

## Implementation rule

Adopt the direction incrementally. Existing voice, Turnstile, state, undo and
Three.js behavior must remain functional during layout changes. Do not add
visual controls until their action exists.
