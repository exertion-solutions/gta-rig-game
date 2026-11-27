# Construye public/models/scenario/additions.glb (sin comprimir; después: gltf-transform meshopt).
# Uso: blender -b --factory-startup --python scripts/build-scenario.py -- <salida.glb>
# Escenario ilustrativo añadido por el juego, no as-built. Cada medida está en docs/scenario-additions.md
# como MEDIDA (de los GLB de public/models/rig10, ver docs/traversal-inventory.md) o ESTIMADA.
# Coordenadas en el marco del juego (glTF: Y arriba); g2b() pasa a Blender (Z arriba).
# Los anclajes (empties "anchor_*" con propiedades -> extras) los lee scripts/extract-traversal.mjs.
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def g2b(p):
    return Vector((p[0], -p[2], p[1]))


# ---------- medidas (ver docs/scenario-additions.md) ----------
# MEDIDA: pasarela de la planchada, grating plano y=1,05, x 4,97..16,95, z ±0,99 (sk575_planchada_grating).
DECK_Y, DECK_END_X = 1.05, 16.96
# ESTIMADA: escalera de acceso a la pasarela (proporciones industriales: 2R+G ≈ 0,60 m, 30-38°).
ST_N, ST_W = 6, 0.90  # contrahuellas, ancho libre entre zancas
ST_R = DECK_Y / ST_N  # 0,175 (derivada de la altura medida)
ST_G = 0.25  # huella
RAIL_H = 0.90  # pasamanos sobre la línea de narices (estimada)
# MEDIDA: rampa de la V (grating 25°): borde alto (1,47; 3,62), borde bajo (6,97; 1,09), ancho z ±0,60.
RAMP_TOP, RAMP_BOT, RAMP_HALF_W = (1.47, 3.62), (6.97, 1.09), 0.60
# ESTIMADA: baranda de la rampa (existencia: Libro DROPS PT-4 / PLA-2; medidas típicas).
RR_OFF, RR_TOP, RR_MID = 0.08, 1.00, 0.50
# MEDIDA: piso de trabajo y=3,61 (sk575_piso_acero); piso de enganche y=20,65 (grating sk575_enganche).
# MEDIDA: cara +X del reticulado del mástil x = -0,69 + 0,0487·(y-4,6) (ajuste de los nodos del reticulado).
FLOOR_Y, BOARD_Y = 3.61, 20.65
FACE = lambda y: -0.69 + 0.0487 * (y - 4.6)
# ESTIMADA: escalera vertical (peldaño cada 0,30 m, ancho libre 0,45 m, separación 0,18 m de la cara).
LAD_STANDOFF, LAD_W, LAD_PITCH, LAD_Z = 0.18, 0.45, 0.30, -0.55

# ---------- materiales PBR ----------
def mat(name, color, metal, rough, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if image:
        t = m.node_tree.nodes.new('ShaderNodeTexImage')
        t.image = image
        m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
    return m


def grating_image(n=128):
    # Reja electrosoldada procedimental (portante cada 1/4, travesaño cada 1/8 de la textura); sin marcas.
    img = bpy.data.images.new('grating', n, n)
    px = []
    for j in range(n):
        for i in range(n):
            bar = (i % (n // 4)) < 3 or (j % (n // 8)) < 2
            v = 0.55 if bar else 0.12
            px += [v, v * 1.02, v * 1.05, 1.0]
    img.pixels = px
    img.file_format = 'PNG'
    return img


M_YELLOW = mat('esc_amarillo', (0.85, 0.62, 0.05), 0.2, 0.55)  # pintura amarilla de seguridad (como el GLB)
M_GALV = mat('esc_galvanizado', (0.62, 0.64, 0.66), 0.9, 0.42)
M_GRATING = mat('esc_grating', (1, 1, 1), 0.8, 0.6, grating_image())

parts = {M_YELLOW.name: [], M_GALV.name: [], M_GRATING.name: []}


def add(obj, m):
    obj.data.materials.append(m)
    parts[m.name].append(obj)


def box(c, half, m, rot=None):
    """Caja con centro c (marco del juego), semiejes half y rotación opcional (Matrix 3x3 en Blender)."""
    me = bpy.data.meshes.new('b')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2.0)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new('b', me)
    scene.collection.objects.link(o)
    S = Matrix.Diagonal((half[0], half[2], half[1], 1))  # ejes de Blender: x, y(=-z), z(=y)
    R = (rot or Matrix.Identity(3)).to_4x4()
    o.matrix_world = Matrix.Translation(g2b(c)) @ R @ S
    add(o, m)
    return o


def tube(a, b, r, m, seg=8):
    """Caño entre dos puntos del juego."""
    pa, pb = g2b(a), g2b(b)
    d = pb - pa
    bpy.ops.mesh.primitive_cylinder_add(vertices=seg, radius=r, depth=d.length, location=(pa + pb) / 2)
    o = bpy.context.active_object
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    add(o, m)
    return o


def anchor(name, p, **props):
    e = bpy.data.objects.new(name, None)
    e.location = g2b(p)
    for k, v in props.items():
        e[k] = v
    scene.collection.objects.link(e)


def rot_z_game(angle):
    """Rotación alrededor del eje Z del juego (= -Y de Blender)."""
    return Matrix.Rotation(angle, 3, Vector((0, -1, 0)))


# ---------- A1: escalera de acceso a la pasarela de la planchada ----------
def stair(x_top, y_top, n, r, g, w):
    # Baja hacia +X. Huellas de grating; zancas en C (cajas) amarillas; pasamanos y pasamanos intermedio.
    for k in range(1, n):
        y = y_top - k * r
        x0 = x_top + (k - 1) * g
        box((x0 + g / 2, y - 0.015, 0), (g / 2 + 0.01, 0.015, w / 2), M_GRATING)
    run = n * g
    ang = math.atan2(n * r, run)
    L = math.hypot(run, n * r)
    for s in (-1, 1):
        z = s * (w / 2 + 0.03)
        cx, cy = x_top + run / 2, y_top / 2 - 0.10
        box((cx, cy, z), (L / 2, 0.10, 0.025), M_YELLOW, rot_z_game(-ang))
        z2 = s * (w / 2 + 0.06)
        top_a, top_b = (x_top, y_top + RAIL_H, z2), (x_top + run, RAIL_H, z2)
        tube(top_a, top_b, 0.024, M_YELLOW)  # pasamanos
        tube((x_top, y_top + RAIL_H / 2, z2), (x_top + run, RAIL_H / 2, z2), 0.016, M_YELLOW)  # intermedio
        for t in (0.0, 0.5, 1.0):  # parantes
            x = x_top + t * run
            y0 = y_top - t * n * r
            tube((x, y0, z2), (x, y0 + RAIL_H, z2), 0.022, M_YELLOW)
    return ang


ang1 = stair(DECK_END_X, DECK_Y, ST_N, ST_R, ST_G, ST_W)
anchor('anchor_stair_planchada', (DECK_END_X, DECK_Y, 0), kind='stair', partId='sk575_planchada',
       bottomX=DECK_END_X + ST_N * ST_G, bottomY=0.0, width=ST_W, rise=ST_R, going=ST_G, railHeight=RAIL_H,
       railOffset=ST_W / 2 + 0.06)

# ---------- A2: baranda de la rampa de la V ----------
(x1, y1), (x2, y2) = RAMP_TOP, RAMP_BOT
for s in (-1, 1):
    z = s * (RAMP_HALF_W + RR_OFF)
    tube((x1, y1 + RR_TOP, z), (x2, y2 + RR_TOP, z), 0.024, M_YELLOW)
    tube((x1, y1 + RR_MID, z), (x2, y2 + RR_MID, z), 0.016, M_YELLOW)
    n = 4
    for i in range(n + 1):
        t = i / n
        x, y = x1 + t * (x2 - x1), y1 + t * (y2 - y1)
        tube((x, y, z), (x, y + RR_TOP, z), 0.022, M_YELLOW)
anchor('anchor_rail_rampa', (x1, y1, 0), kind='rampRail', partId='sk575_planchada', endX=x2, endY=y2,
       halfWidth=RAMP_HALF_W + RR_OFF, railHeight=RR_TOP)

# ---------- A3: escalera vertical piso de trabajo -> piso de enganche ----------
def lad_x(y):
    return FACE(y) + LAD_STANDOFF


yb, yt = FLOOR_Y, BOARD_Y
for s in (-1, 1):
    z = LAD_Z + s * (LAD_W / 2 + 0.03)
    a, b = (lad_x(yb), yb, z), (lad_x(yt), yt, z)
    d = (g2b(b) - g2b(a))
    o = box(((a[0] + b[0]) / 2, (yb + yt) / 2, z), (0.006, d.length / 2, 0.03), M_GALV,
            rot_z_game(-math.atan2(b[0] - a[0], yt - yb)))  # largueros de planchuela
k = 1
while yb + k * LAD_PITCH < yt - 0.05:
    y = yb + k * LAD_PITCH
    tube((lad_x(y), y, LAD_Z - LAD_W / 2 - 0.03), (lad_x(y), y, LAD_Z + LAD_W / 2 + 0.03), 0.0125, M_GALV, seg=6)
    k += 1
# facing: el trepador mira hacia -X (al mástil); yaw del juego con avance (-sin, -cos) => pi/2.
anchor('anchor_ladder_mastil_bottom', (lad_x(yb), yb, LAD_Z), kind='ladderBottom', partId='sk575_mastil', facing=math.pi / 2)
anchor('anchor_ladder_mastil_top', (lad_x(yt), yt, LAD_Z), kind='ladderTop', partId='sk575_mastil', rungs=k - 1)

# ---------- UV y unión por material (pocas draw calls) ----------
bpy.ops.object.select_all(action='DESELECT')
for mname, objs in parts.items():
    if not objs:
        continue
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    j = bpy.context.active_object
    j.name = 'adic_' + mname.replace('esc_', '')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=0.5)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.select_all(action='DESELECT')

tris = sum(len(p.vertices) - 2 for o in scene.objects if o.type == 'MESH' for p in o.data.polygons)
print('TRIANGULOS', tris)
assert tris <= 30000, tris
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_extras=True, export_yup=True,
                          export_image_format='WEBP', export_apply=True)
