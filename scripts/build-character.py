# Construye public/models/character/worker.glb (sin comprimir) a partir de Microsoft Rocketbox (MIT).
# Uso: blender -b --factory-startup --python scripts/build-character.py -- <avatar.fbx> <texdir> <idle.fbx> <walk.fbx> <run.fbx> <operate.fbx> <out.glb>
# operate = m_work_mid.max.fbx (Rocketbox, trabajo con las manos a media altura): se usa al operar una válvula.
# Retarget: los esqueletos Biped de las animaciones tienen otra pose de reposo que el avatar, así que cada hueso
# copia la orientación de mundo del esqueleto animado (y la pelvis su posición) y se hornea. Se quita el
# avance del clip (root motion en X/Y) para que el clip quede en el lugar; el juego mueve al jugador.
import bpy, sys, os, json
a = sys.argv[sys.argv.index('--') + 1:]
AVATAR, TEX, CLIPS, OUT = a[0], a[1], {'idle': a[2], 'walk': a[3], 'run': a[4], 'operate': a[5]}, a[6]
TEX_SIZE = 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def imp(p):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=p, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before]


def fcurves(action):
    for layer in action.layers:
        for strip in layer.strips:
            for cb in strip.channelbags:
                yield from cb.fcurves


av = imp(AVATAR)
T = next(o for o in av if o.type == 'ARMATURE')
body = next(o for o in av if o.type == 'MESH')
for o in av:
    if o.type not in ('ARMATURE', 'MESH'):
        bpy.data.objects.remove(o)
T.animation_data_clear()
for act in list(bpy.data.actions):
    bpy.data.actions.remove(act)

# Materiales: color + normal (sin specular), webp al exportar.
for slot in body.material_slots:
    m = slot.material
    key = m.name.split('_')[-1]  # body/head/helmet
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    outn = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Roughness'].default_value = 0.75 if key != 'helmet' else 0.45
    nt.links.new(bsdf.outputs['BSDF'], outn.inputs['Surface'])
    for kind in ('color', 'normal'):
        img = bpy.data.images.load(os.path.join(TEX, f'm107_{key}_{kind}.tga'))
        if kind == 'normal':
            img.colorspace_settings.name = 'Non-Color'  # antes de escalar: cambiarlo recarga la imagen
        img.scale(TEX_SIZE, TEX_SIZE)
        img.name = f'worker_{key}_{kind}'
        tn = nt.nodes.new('ShaderNodeTexImage')
        tn.image = img
        if kind == 'color':
            nt.links.new(tn.outputs['Color'], bsdf.inputs['Base Color'])
        else:
            nm = nt.nodes.new('ShaderNodeNormalMap')
            nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
            nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])

report = {'tris': sum(len(p.vertices) - 2 for p in body.data.polygons), 'clips': {}}

for clip, path in CLIPS.items():
    objs = imp(path)
    A = next(o for o in objs if o.type == 'ARMATURE')
    act = A.animation_data.action
    f0, f1 = (int(v) for v in act.frame_range)
    # quitar la tendencia lineal de X/Y del objeto Bip01 (avance) conservando el balanceo
    travel = 0.0
    for fc in fcurves(act):
        if fc.data_path == 'location' and fc.array_index in (0, 1):
            k = fc.keyframe_points
            v0, v1 = k[0].co[1], k[-1].co[1]
            travel += (v1 - v0) ** 2
            for kp in k:
                t = (kp.co[0] - f0) / max(f1 - f0, 1)
                d = v0 + (v1 - v0) * t
                kp.co[1] -= d
                kp.handle_left[1] -= d
                kp.handle_right[1] -= d
    travel = travel ** 0.5  # en metros (location del objeto está en unidades de escena)
    report['clips'][clip] = {'frames': f1 - f0, 'fps': scene.render.fps, 'travel_m': travel, 'speed': travel / ((f1 - f0) / scene.render.fps)}

    for pb in T.pose.bones:
        if pb.name not in A.pose.bones:
            continue
        c = pb.constraints.new('COPY_ROTATION')
        c.target, c.subtarget = A, pb.name
        if pb.name == 'Bip01 Pelvis':
            c = pb.constraints.new('COPY_LOCATION')
            c.target, c.subtarget = A, pb.name
    scene.frame_start, scene.frame_end = f0, f1
    bpy.ops.object.select_all(action='DESELECT')
    T.select_set(True)
    bpy.context.view_layer.objects.active = T
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.nla.bake(frame_start=f0, frame_end=f1, only_selected=False, visual_keying=True, clear_constraints=True,
                     use_current_action=False, bake_types={'POSE'})
    bpy.ops.object.mode_set(mode='OBJECT')
    baked = T.animation_data.action
    baked.name = clip
    baked.use_fake_user = True
    # el clip arranca en 0 (frame f0 -> 0)
    for fc in fcurves(baked):
        for kp in fc.keyframe_points:
            kp.co[0] -= f0
            kp.handle_left[0] -= f0
            kp.handle_right[0] -= f0
    T.animation_data.action = None
    for o in objs:
        bpy.data.objects.remove(o)
    for x in list(bpy.data.actions):
        if x.name not in CLIPS:
            bpy.data.actions.remove(x)

for pb in T.pose.bones:  # pose de reposo limpia en el archivo
    pb.matrix_basis.identity()
T.animation_data.action = bpy.data.actions['idle']
scene.frame_set(0)

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_image_format='WEBP', export_animations=True,
                          export_animation_mode='ACTIONS', export_optimize_animation_size=True, export_def_bones=True,
                          export_morph=False, export_vertex_color='NONE', export_cameras=False, export_lights=False, export_yup=True)
print('JSON' + json.dumps(report))
