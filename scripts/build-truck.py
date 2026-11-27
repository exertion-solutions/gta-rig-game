"""Camioneta pickup doble cabina 4x4 (modelo propio, sin marcas ni texto) -> public/models/vehicle/pickup.glb

Reproducible:
  C:\\Tools\\Blender\\blender.exe --background --python scripts/build-truck.py -- <salida.glb>
  npx gltf-transform meshopt <salida.glb> public/models/vehicle/pickup.glb   (compresion opcional)

Coordenadas: se piensa en las del juego (three: x ancho, y arriba, z atras; el frente mira a -Z, suelo en y = -0.8, origen en
el centro del chasis). `P()` las pasa a Blender (x, -z, y) y el exportador glTF (+Y arriba) las devuelve iguales.
Nodos: `body` (todo menos ruedas), `wheel_FL/FR/RL/RR` (pivote de direccion/altura) con hijo `tire_*` (gira sobre X) que lleva
caucho, llanta y disco. Materiales con nombre `truck_*` (el juego enciende `truck_headlight` y `truck_taillight`).
"""
import math
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'pickup.glb'
MAX_TRIS = 12000
WHEEL_R, WHEEL_W = 0.4, 0.3
WHEELS = {'FL': (-1.0, -0.4, -1.5), 'FR': (1.0, -0.4, -1.5), 'RL': (-1.0, -0.4, 1.4), 'RR': (1.0, -0.4, 1.4)}


def P(x, y, z):
    return Vector((x, -z, y))


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materiales
def mat(name, color, metal=0.0, rough=0.5, coat=0.0, coat_rough=0.1, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if coat:
        b.inputs['Coat Weight'].default_value = coat
        b.inputs['Coat Roughness'].default_value = coat_rough
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = 1.0
    return m


def srgb(h):  # '#rrggbb' -> lineal
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


MATS = {
    'paint': mat('truck_paint', srgb('#1b4fa3'), metal=0.7, rough=0.3, coat=1.0, coat_rough=0.06),
    'glass': mat('truck_glass', srgb('#1a2833'), metal=0.7, rough=0.04),
    'chrome': mat('truck_chrome', srgb('#c9ced4'), metal=1.0, rough=0.16),
    'plastic': mat('truck_plastic', srgb('#1f2227'), metal=0.1, rough=0.72),
    'rubber': mat('truck_rubber', srgb('#161616'), rough=0.92),
    'rim': mat('truck_rim', srgb('#b4b9c0'), metal=0.9, rough=0.3),
    'headlight': mat('truck_headlight', srgb('#f4f1e6'), rough=0.1, emit=srgb('#fff2c0')),
    'taillight': mat('truck_taillight', srgb('#7a0d0d'), rough=0.25, emit=srgb('#ff1a1a')),
}
objs = []  # (objeto, clave de material, grupo)


def commit(bm, name, key, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MATS[key])
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if parent is not None:
        ob.parent = parent
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    objs.append((ob, key, parent))
    return ob


def sgn(v):
    return 1.0 if v >= 0 else -1.0


def ring(hw, y0, y1, n=4.0, N=28, crown=0.0):
    ym, hh = (y0 + y1) / 2, (y1 - y0) / 2
    pts = []
    for k in range(N):
        t = 2 * math.pi * k / N
        c, s = math.cos(t), math.sin(t)
        x = hw * sgn(c) * abs(c) ** (2 / n)
        y = ym + hh * sgn(s) * abs(s) ** (2 / n)
        if y > ym:
            y += crown * (1 - (x / hw) ** 2)
        pts.append((x, y))
    return pts


def loft(name, secs, key, parent=None, n=4.0, crown=0.0, N=28):
    """secs: (z, hw, y0, y1) de adelante (z<0) hacia atras; cada una es un rectangulo redondeado."""
    bm = bmesh.new()
    rings = []
    for z, hw, y0, y1 in secs:
        rings.append([bm.verts.new(P(x, y, z)) for x, y in ring(hw, y0, y1, n, N, crown)])
    for a, b in zip(rings, rings[1:]):
        for k in range(N):
            bm.faces.new((a[k], a[(k + 1) % N], b[(k + 1) % N], b[k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1][::-1])
    return commit(bm, name, key, parent)


def box(name, key, c, s, bevel=0.02, parent=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * s[0], v.co.y * s[1], v.co.z * s[2]))
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=2, affect='EDGES')
    for v in bm.verts:  # (x,y,z) del juego -> Blender
        v.co = Vector((v.co.x, -v.co.z, v.co.y))
    bmesh.ops.translate(bm, verts=bm.verts, vec=P(*c))
    return commit(bm, name, key, parent, smooth=False)


def tube(name, key, path, rx, ry, radial, parent=None, N=10, caps=True):
    """Tubo a lo largo de `path` (puntos del juego); la seccion es una elipse: rx a lo largo de X, ry segun `radial` (vector
    unitario del juego, perpendicular al camino)."""
    bm = bmesh.new()
    rings = []
    for p, rad in zip(path, radial):
        r = []
        for k in range(N):
            t = 2 * math.pi * k / N
            q = Vector(p) + Vector((1, 0, 0)) * (rx * math.cos(t)) + Vector(rad) * (ry * math.sin(t))
            r.append(bm.verts.new(P(*q)))
        rings.append(r)
    for a, b in zip(rings, rings[1:]):
        for k in range(N):
            bm.faces.new((a[k], a[(k + 1) % N], b[(k + 1) % N], b[k]))
    if caps:
        bm.faces.new(rings[0])
        bm.faces.new(rings[-1][::-1])
    return commit(bm, name, key, parent)


def cyl(name, key, c, r, length, seg=24, axis='x', parent=None, open_ends=False, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=not open_ends, segments=seg, radius1=r, radius2=r, depth=length)
    # create_cone: eje Z de Blender; hay que llevarlo a X del juego (= X de Blender)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y') if axis == 'x' else Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=P(*c))
    return commit(bm, name, key, parent, smooth)


# ------------------------------------------------------------ carroceria
body = bpy.data.objects.new('body', None)
scene.collection.objects.link(body)
B = body

# chapa inferior: trompa, capot, bajos de la cabina y piso de la caja (ytop baja a 0,12 en la caja)
HW = 1.02
main = loft('paint_main', [
    (-2.14, 0.93, -0.36, 0.40), (-2.08, 0.985, -0.40, 0.46), (-1.80, 1.0, -0.42, 0.50),  # trompa alta y casi vertical
    (-1.00, HW, -0.44, 0.54), (0.95, HW, -0.44, 0.54), (0.95, 0.96, -0.42, 0.14), (2.28, 0.96, -0.40, 0.14),
], 'paint', B, n=5.0, crown=0.05)

# cabina: vidrio (cupula), techo, pilares
loft('glass_cab', [
    (-0.97, 0.98, 0.50, 0.55), (-0.80, 0.95, 0.50, 0.88), (-0.55, 0.91, 0.50, 1.11), (-0.30, 0.87, 0.50, 1.17),
    (0.62, 0.87, 0.50, 1.17), (0.82, 0.89, 0.50, 1.06), (0.95, 0.93, 0.50, 0.80),
], 'glass', B, n=4.0)
loft('paint_roof', [(-0.40, 0.84, 1.10, 1.185), (-0.30, 0.875, 1.12, 1.19), (0.62, 0.875, 1.12, 1.19), (0.77, 0.885, 1.10, 1.17)], 'paint', B, n=3.2)
for s in (-1, 1):
    tube(f'pilar_A_{s}', 'paint', [(s * 0.955, 0.52, -0.99), (s * 0.935, 0.80, -0.82), (s * 0.90, 1.08, -0.52), (s * 0.86, 1.17, -0.34)],
         0.035, 0.035, [(0, 0.4, -0.9)] * 4, B)
    tube(f'pilar_C_{s}', 'paint', [(s * 0.90, 0.60, 0.95), (s * 0.89, 0.92, 0.83), (s * 0.87, 1.14, 0.67)], 0.05, 0.07, [(0, 0, 1)] * 3, B)
    box(f'pilar_B_{s}', 'paint', (s * 0.92, 0.84, 0.0), (0.06, 0.68, 0.10), 0.012, B)
    box(f'umbral_{s}', 'paint', (s * 0.96, 0.52, 0.0), (0.10, 0.07, 1.80), 0.02, B)
    # juntas de puertas, manijas y escalon
    for z in (-0.88, 0.0, 0.88):  # cuatro puertas
        box(f'junta_{s}_{z}', 'plastic', (s * 1.025, 0.05, z), (0.012, 0.86, 0.018), 0.004, B)
    box(f'junta_alta_{s}', 'plastic', (s * 1.025, -0.38, 0.0), (0.012, 0.02, 1.76), 0.004, B)
    for z in (-0.16, 0.72):
        box(f'manija_{s}_{z}', 'chrome', (s * 1.04, 0.36, z), (0.035, 0.045, 0.19), 0.012, B)
    box(f'escalon_{s}', 'plastic', (s * 1.08, -0.50, -0.06), (0.18, 0.06, 1.60), 0.02, B)
    box(f'escalon_cromo_{s}', 'chrome', (s * 1.095, -0.46, -0.06), (0.015, 0.012, 1.52), 0, B)
    # espejos
    box(f'espejo_brazo_{s}', 'plastic', (s * 1.10, 0.76, -0.86), (0.16, 0.035, 0.05), 0.01, B)
    box(f'espejo_{s}', 'paint', (s * 1.2, 0.84, -0.86), (0.07, 0.16, 0.20), 0.035, B)
    box(f'espejo_luna_{s}', 'chrome', (s * 1.2, 0.84, -0.763), (0.055, 0.13, 0.008), 0.003, B)

# caja: piso, laterales, frente y compuerta
box('caja_piso', 'plastic', (0, 0.16, 1.62), (1.78, 0.05, 1.34), 0.01, B)
for s in (-1, 1):
    box(f'caja_pared_{s}', 'paint', (s * 0.925, 0.40, 1.62), (0.10, 0.52, 1.36), 0.03, B)
    box(f'caja_borde_{s}', 'plastic', (s * 0.925, 0.665, 1.62), (0.12, 0.022, 1.38), 0, B)
    box(f'barra_parante_{s}', 'plastic', (s * 0.90, 0.92, 1.08), (0.07, 0.50, 0.07), 0.02, B)  # barra antivuelco de la caja
box('caja_frente', 'paint', (0, 0.40, 0.99), (1.90, 0.52, 0.08), 0.03, B)
box('barra_travesano', 'plastic', (0, 1.15, 1.08), (1.87, 0.07, 0.07), 0.02, B)
box('cubrecarter', 'chrome', (0, -0.40, -1.95), (1.0, 0.03, 0.42), 0, B)  # protector bajo la trompa (4x4)
box('caja_compuerta', 'paint', (0, 0.36, 2.28), (1.90, 0.46, 0.09), 0.035, B)
box('compuerta_manija', 'plastic', (0, 0.52, 2.335), (0.30, 0.05, 0.02), 0.01, B)
box('compuerta_borde', 'chrome', (0, 0.60, 2.28), (1.88, 0.02, 0.11), 0.008, B)

# frente: parrilla, faros, paragolpes, luces traseras
# Frente (plano z = -2,14): parrilla ancha al centro con marco cromado, barras horizontales y parantes; a cada lado un
# faro rectangular en su carcasa oscura, con luz de posición debajo. Las piezas chicas van sin bisel (pocos triángulos).
FZ = -2.14
GW, GH, GY = 1.04, 0.40, 0.12  # parrilla: ancho, alto, centro
box('parrilla_fondo', 'plastic', (0, GY, FZ - 0.005), (GW, GH, 0.04), 0, B)
for i in range(5):  # barras horizontales
    box(f'parrilla_barra_{i}', 'chrome', (0, GY - GH / 2 + 0.045 + i * 0.0775, FZ - 0.035), (GW - 0.04, 0.022, 0.03), 0, B)
for i in range(7):  # parantes finos, por detrás de las barras
    box(f'parrilla_parante_{i}', 'plastic', ((i - 3) * 0.15, GY, FZ - 0.028), (0.016, GH - 0.03, 0.02), 0, B)
for sy in (-1, 1):  # marco cromado
    box(f'parrilla_marco_h_{sy}', 'chrome', (0, GY + sy * GH / 2, FZ - 0.04), (GW + 0.06, 0.035, 0.05), 0.01, B)
for sx in (-1, 1):
    box(f'parrilla_marco_v_{sx}', 'chrome', (sx * GW / 2, GY, FZ - 0.04), (0.035, GH + 0.035, 0.05), 0.01, B)
box('paragolpes_del', 'chrome', (0, -0.25, -2.19), (1.98, 0.16, 0.20), 0.06, B)
box('faldon_del', 'plastic', (0, -0.38, -2.07), (1.5, 0.14, 0.14), 0.04, B)
box('paragolpes_tras', 'chrome', (0, -0.20, 2.34), (1.98, 0.17, 0.20), 0.07, B)
box('escalon_trasero', 'plastic', (0, -0.31, 2.36), (1.2, 0.04, 0.18), 0.01, B)
box('luz_antiniebla_L', 'headlight', (-0.55, -0.37, -2.15), (0.16, 0.06, 0.04), 0.02, B)
box('luz_antiniebla_R', 'headlight', (0.55, -0.37, -2.15), (0.16, 0.06, 0.04), 0.02, B)
for s in (-1, 1):
    box(f'faro_carcasa_{s}', 'plastic', (s * 0.715, 0.17, FZ - 0.01), (0.31, 0.30, 0.05), 0.02, B)
    box(f'faro_{s}', 'headlight', (s * 0.715, 0.215, FZ - 0.035), (0.26, 0.15, 0.04), 0.03, B)  # luz principal
    box(f'faro_posicion_{s}', 'headlight', (s * 0.715, 0.075, FZ - 0.035), (0.26, 0.045, 0.03), 0, B)  # luz de posición
    box(f'faro_ceja_{s}', 'chrome', (s * 0.715, 0.325, FZ - 0.03), (0.31, 0.018, 0.06), 0, B)
    box(f'luz_trasera_{s}', 'taillight', (s * 0.80, 0.30, 2.335), (0.20, 0.30, 0.05), 0.03, B)

# bajos: chasis y escape
box('chasis', 'plastic', (0, -0.42, 0.2), (1.60, 0.10, 4.0), 0.02, B)
cyl('escape', 'chrome', (0.55, -0.50, 2.2), 0.045, 0.45, 12, axis='y', parent=B)

# pasos de rueda: corte en la chapa, forro oscuro y guardabarros abultado (semi-toro) en cada rueda
for k, (wx, wy, wz) in WHEELS.items():
    s = 1 if wx > 0 else -1
    cut = cyl(f'corte_{k}', 'paint', (s * 0.96, wy, wz), 0.52, 0.5, 28, parent=None)
    objs.pop()  # no se exporta: es la herramienta booleana
    mod = main.modifiers.new('arco_' + k, 'BOOLEAN')
    mod.object, mod.operation, mod.solver = cut, 'DIFFERENCE', 'EXACT'
    bpy.context.view_layer.objects.active = main
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut)
    # forro: media caña interior
    bm = bmesh.new()
    seg = 14
    cols = []
    for xi in (0.83, 1.06):
        col = []
        for i in range(seg + 1):
            a = math.pi * i / seg
            col.append(bm.verts.new(P(s * xi, wy + 0.5 * math.sin(a), wz + 0.5 * math.cos(a))))
        cols.append(col)
    for i in range(seg):
        bm.faces.new((cols[0][i], cols[0][i + 1], cols[1][i + 1], cols[1][i]))
    me_o = commit(bm, f'forro_{k}', 'plastic', B)
    for p in me_o.data.polygons:
        p.use_smooth = True
    # guardabarros
    arc = [(s * 1.04, wy + 0.55 * math.sin(a), wz + 0.55 * math.cos(a)) for a in [math.radians(d) for d in range(5, 176, 17)]]
    rad = [(0, (p[1] - wy) / 0.55, (p[2] - wz) / 0.55) for p in arc]
    tube(f'guardabarros_{k}', 'paint', arc, 0.075, 0.05, rad, B, N=10)

# ----------------------------------------------------------------- ruedas
def wheel(k, wx, wy, wz):
    s = 1 if wx > 0 else -1
    pivot = bpy.data.objects.new(f'wheel_{k}', None)
    scene.collection.objects.link(pivot)
    pivot.location = P(wx, wy, wz)
    tire = bpy.data.objects.new(f'tire_{k}', None)
    scene.collection.objects.link(tire)
    tire.parent = pivot
    # neumatico: perfil revolucionado en torno a X, con tacos alternados en la banda de rodadura
    segs = 40
    prof = [(0.255, -0.135), (0.33, -0.15), (0.375, -0.145), (0.397, -0.105), (0.40, -0.075), (0.40, -0.02), (0.40, 0.02),
            (0.40, 0.075), (0.397, 0.105), (0.375, 0.145), (0.33, 0.15), (0.255, 0.135)]
    lug = {4: 1, 5: 1, 6: 1, 7: 1}  # los de la banda (r=0,40) se hunden en los huecos entre tacos
    bm = bmesh.new()
    rings = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        gap = (i % 2 == 0)
        r = []
        for j, (rr, xx) in enumerate(prof):
            rr2 = rr - (0.016 if (gap and j in lug) else 0.0)
            r.append(bm.verts.new(P(s * xx * 1.0, rr2 * math.cos(a), rr2 * math.sin(a))))
        rings.append(r)
    for i in range(segs):
        a, b = rings[i], rings[(i + 1) % segs]
        for j in range(len(prof) - 1):
            bm.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
        bm.faces.new((a[-1], a[0], b[0], b[-1]))
    t_ob = commit(bm, f'caucho_{k}', 'rubber', tire, smooth=False)
    bm2 = bmesh.new()  # aro: plato hundido + labio
    rp = [(0.265, 0.138), (0.255, 0.120), (0.215, 0.105), (0.18, 0.090), (0.075, 0.100), (0.0, 0.112)]
    rr = []
    for i in range(24):
        a = 2 * math.pi * i / 24
        rr.append([bm2.verts.new(P(s * xx, r_ * math.cos(a), r_ * math.sin(a))) for r_, xx in rp])
    for i in range(24):
        a, b = rr[i], rr[(i + 1) % 24]
        for j in range(len(rp) - 1):
            bm2.faces.new((a[j], a[j + 1], b[j + 1], b[j]))
    commit(bm2, f'llanta_{k}', 'rim', tire)
    for q in range(5):  # radios (coordenadas de rueda del juego: x lateral, y arriba, z atras)
        bx = bmesh.new()
        bmesh.ops.create_cube(bx, size=1.0)
        for v in bx.verts:
            v.co = Vector((v.co.x * 0.028, v.co.y * 0.20 + 0.17, v.co.z * 0.075))
        bmesh.ops.rotate(bx, verts=bx.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(q * 2 * math.pi / 5, 3, 'X'))
        for v in bx.verts:
            v.co = Vector((v.co.x + s * 0.112, -v.co.z, v.co.y))
        commit(bx, f'radio_{k}_{q}', 'rim', tire, smooth=False)
    cyl(f'disco_{k}', 'plastic', (s * 0.07, 0, 0), 0.215, 0.025, 20, parent=tire)
    return pivot, tire


for k, (wx, wy, wz) in WHEELS.items():
    wheel(k, wx, wy, wz)

# ------------------------------------------------- unir por material y UV
body_parts = {}
for ob, key, parent in objs:
    gname = parent.name if parent is not None else 'root'
    if parent is body:
        gname = 'body'
    body_parts.setdefault((gname, key), []).append(ob)
bpy.context.view_layer.update()
for (gname, key), lst in body_parts.items():
    if gname == 'root':
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in lst:
        o.select_set(True)
    bpy.context.view_layer.objects.active = lst[0]
    with bpy.context.temp_override(active_object=lst[0], selected_editable_objects=lst, selected_objects=lst):
        if len(lst) > 1:
            bpy.ops.object.join()
    ob = lst[0]
    ob.name = f'{gname}_{key}'
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
    ob.select_set(False)

# el cuerpo principal (paint_main) ya se unio con el resto de pintura; recuento
tris = 0
for o in scene.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
print('TRIANGULOS', tris, 'OBJETOS', sum(1 for o in scene.objects if o.type == 'MESH'))
assert tris <= MAX_TRIS, f'{tris} triangulos > {MAX_TRIS}'

bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_apply=True, export_yup=True, export_materials='EXPORT',
    export_cameras=False, export_lights=False, export_extras=False, export_normals=True, export_texcoords=True,
)
print('GLB', OUT)
