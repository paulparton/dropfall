# Arena theme source assets

Original assets authored for Dropfall; no downloaded models, textures or third-party artwork.

- `DropfallSpheres.blend`: editable Forge, Turbine and Orbit meshes.
- `build_spheres.py`: deterministic authoring, UVs, FBX export and clean-scene round-trip validation.
- `import_assets.py`: Unreal asset import, material generation and bounds/material-slot validation.

Contract: metres, Z-up, +X forward in source; FBX export -Y forward / Z-up.
Applied scale, central pivot, one UV layer, semantic `Shell` and `Team` material slots.
Each mesh is about one metre in diameter, 1,860–2,478 polygons. Imported bounds
are checked at 47–54cm half extent. No external textures or linked libraries.
These are render-only shells: gameplay always uses the same 1.05m spherical
collision body and 95kg mass. No cosmetic affects acceleration or collision.

Run the builder in a **separate background factory-startup Blender process**;
it intentionally clears that scratch scene, never the user's open project.
Import through Unreal's Python commandlet, not by editing `.uasset` bytes.
The runtime uses the imported assets under `/Game/Arena` and retains hard
references so they are discoverable by the cooker. No skeletal rig or animation
is needed; the shells roll with the simulated body. LODs are deferred for these
two low-poly local fighters; a packaged performance gate is still required.

Arena layouts are source-authored in `DropfallArenaLayout.cpp`, in centimetres.
The permanent core is built first, then intermediate galleries, then starting
extensions. Every ramp, pad and decoration carries its parent's collapse layer.
