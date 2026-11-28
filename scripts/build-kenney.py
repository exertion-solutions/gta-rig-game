"""Junta los modelos elegidos de los kits de Kenney (CC0) en un solo GLB: un `scene` por modelo."""
import os, shutil, subprocess, sys

src, repo = sys.argv[1], sys.argv[2]
work = os.path.join(src, '_pack')
shutil.rmtree(work, ignore_errors=True)
PICK = {
    'car-kit': ('auto', 'sedan suv suv-luxury hatchback-sports taxi police van truck ambulance delivery-flat garbage-truck firetruck truck-flat'.split()),
    'city-kit-commercial': ('com', [f'building-{c}' for c in 'abcdefghiklm'] + [f'building-skyscraper-{c}' for c in 'abcde'] + [f'low-detail-building-{c}' for c in 'abcdefghijklm']),
    'city-kit-suburban': ('casa', [f'building-type-{c}' for c in 'abcdefghijklmnopqrstu']),
}
gt = os.path.join(repo, 'node_modules', '.bin', 'gltf-transform.cmd')
parts = []
for kit, (pre, names) in PICK.items():
    d = os.path.join(work, pre)
    os.makedirs(os.path.join(d, 'Textures'))
    g = os.path.join(src, kit, 'Models', 'GLB format')
    shutil.copy(os.path.join(g, 'Textures', 'colormap.png'), os.path.join(d, 'Textures', 'colormap.png'))
    for n in names:
        # el nombre del archivo pasa a ser el nombre del scene
        dst = os.path.join(d, f"{pre}_{n.replace('building-type-', '').replace('low-detail-building-', 'lejos-').replace('building-', '')}.glb")
        shutil.copy(os.path.join(g, n + '.glb'), dst)
        parts.append(dst)
out = os.path.join(work, 'merged.glb')
subprocess.run([gt, 'merge', *[os.path.relpath(x, work) for x in parts], 'merged.glb'], check=True, stdout=subprocess.DEVNULL, cwd=work)  # rutas cortas: cmd.exe corta en 8191 caracteres
subprocess.run([gt, 'dedup', out, out], check=True, stdout=subprocess.DEVNULL)
final = os.path.join(repo, 'public', 'models', 'ruta', 'kenney.glb')
os.makedirs(os.path.dirname(final), exist_ok=True)
subprocess.run([gt, 'draco', out, final], check=True, stdout=subprocess.DEVNULL)
print(len(parts), 'modelos ->', final, os.path.getsize(final), 'bytes')
