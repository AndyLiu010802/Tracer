"""Author ten miniature environments in Blender; export merged game meshes.
Run Blender --background --factory-startup --threads 6 --python this.py -- konoha
Use -- all to build all sets. Source .blend files include a lit presentation pond.
"""
import bpy, bmesh, math, json, sys, struct, random
from pathlib import Path
from mathutils import Vector, Matrix

ROOT=Path(__file__).resolve().parents[1]
ART=ROOT/'skins/tracer/fishing-art'
SOURCE=ROOT/'art-source/fishing-pond-skins'
OUT=ROOT/'output/fishing-pond-skins/blender'
for p in (SOURCE,OUT): p.mkdir(parents=True,exist_ok=True)
TAU=math.tau
MATS={};ANCHORS={};anchor='back';skin='konoha'

def material(name,color,kind=7,metal=0,rough=.5):
    m=bpy.data.materials.new(name);m.use_nodes=True
    rgb=tuple(int(color[i:i+2],16)/255 for i in (1,3,5));linear=tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)
    m.diffuse_color=(*linear,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*linear,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
    if kind==11:p.inputs['Emission Color'].default_value=(*linear,1);p.inputs['Emission Strength'].default_value=.65
    if kind in (5,7):
        nodes=m.node_tree.nodes;links=m.node_tree.links;tex=nodes.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=35 if kind==7 else 8;tex.inputs['Detail'].default_value=2
        coord=nodes.new('ShaderNodeTexCoord');mapping=nodes.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY';mapping.inputs[1].default_value=(3,60,5) if kind==5 else (5,5,5);links.new(coord.outputs['Generated'],mapping.inputs[0]);links.new(mapping.outputs['Vector'],tex.inputs['Vector']);bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.17;bump.inputs['Distance'].default_value=.018;links.new(tex.outputs['Fac'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
    m['game_color']=color;m['game_material']=kind;MATS[name]=m;return name

def finish(o,name,mat,bevel=0,smooth=False):
    o.name=name;o.data.materials.append(MATS[mat]);o.parent=ANCHORS[anchor];o['pond_anchor']=anchor
    if bevel:
        mod=o.modifiers.new('Crafted edge bevel','BEVEL');mod.width=bevel;mod.segments=2;mod.limit_method='ANGLE'
        mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True;mod.weight=30
    if smooth and o.type=='MESH':
        for p in o.data.polygons:p.use_smooth=True
    return o

def cube(name,xyz,size,mat,bevel=.006,rot=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz);o=bpy.context.object;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.rotation_euler=rot;return finish(o,name,mat,bevel)

def cyl(name,xyz,r,depth,mat,vertices=24,r2=None):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=xyz);return finish(bpy.context.object,name,mat,.006,True)

def ellipsoid(name,xyz,scale,mat,segments=16,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=xyz);o=bpy.context.object;o.scale=scale;return finish(o,name,mat,0,True)

def pipe(name,points,r,mat,closed=False):
    cu=bpy.data.curves.new(name,'CURVE');cu.dimensions='3D';cu.resolution_u=2;cu.bevel_depth=r;cu.bevel_resolution=1;cu.resolution_u=8
    sp=cu.splines.new('POLY');sp.points.add(len(points)-1)
    for p,q in zip(sp.points,points):p.co=(*q,1)
    sp.use_cyclic_u=closed;ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);return finish(ob,name,mat)

def beam(name,a,b,r,mat):
    midpoint=(Vector(a)+Vector(b))*.5;delta=Vector(b)-Vector(a);o=cyl(name,midpoint,r,delta.length,mat,12);o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();return o

def torus(name,xyz,major,minor,mat,rot=(0,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=40,minor_segments=6,location=xyz,rotation=rot);return finish(bpy.context.object,name,mat,0,True)

def mesh(name,verts,faces,mat,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update();obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);return finish(obj,name,mat,0,smooth)

def deck(x=0,y=0,w=2.35,d=.92):
    cube('Foundation stone', (x,y,.015),(w+.12,d+.12,.14),'stone',.035)
    for i in range(18):cube('Individual deck plank',(x-w/2+(i+.5)*w/18,y,.105),(w/18-.005,d,.07),'wood' if i%4 else 'woodlight',.004)
    for side in (-1,1):cube('Mortised deck edge',(x,y+side*d/2,.105),(w+.12,.075,.13),'wooddark')
    for side in (-1,1):
        for yy in (-d*.39,d*.39):cyl('Foundation support',(x+side*w*.40,y+yy,-.12),.062,.23,'stone')

def railing(x,y,w,z=.18):
    for i in range(9):cube('Railing baluster',(x-w/2+i*w/8,y,z+.16),(.035,.035,.32),'wooddark',.004)
    cube('Railing top',(x,y,z+.34),(w+.08,.075,.055),'trim',.010);cube('Railing foot',(x,y,z+.045),(w+.02,.05,.03),'wooddark')

def roof(name,x,y,z,w,d,rise=.27,tile='roof',gold=False):
    # Closed curved hip roof: curvature is in the mesh, not a flat plane.
    countx,county=18,14;verts=[];faces=[]
    def point(u,v):
        edge=max(abs(u),abs(v));height=rise*(1-abs(v))+.055*abs(v)**7+.050*abs(u)**7
        return (x+u*w/2,y+v*d/2,z+height)
    for i in range(countx+1):
        for j in range(county+1):verts.append(point(-1+2*i/countx,-1+2*j/county))
    for i in range(countx):
        for j in range(county):a=i*(county+1)+j;faces.append((a,a+county+1,a+county+2,a+1))
    ob=mesh(name+' roof shell',verts,faces,tile,True);mod=ob.modifiers.new('Solid ceramic eaves','SOLIDIFY');mod.thickness=.027
    for i in range(19):
        u=-1+i/9;points=[point(u,-1+k/6) for k in range(13)];pipe(name+' ceramic channel',[(a,b,c+.012) for a,b,c in points],.010,'rooflight')
    for side in (-1,1):
        pts=[point(-1+2*k/20,side) for k in range(21)];pipe(name+' rolled eave',pts,.021,'trim' if gold else 'rooflight')
        for i in range(19):
            px,py,pz=point(-1+i/9,side);ellipsoid('Round tile end',(px,py+side*.004,pz),(.021,.011,.020),'rooflight',10,5)
    pipe(name+' ridge',[(x-w*.53,y,z+rise+.055),(x-w*.48,y,z+rise+.035),(x+w*.48,y,z+rise+.035),(x+w*.53,y,z+rise+.055)],.032,'trim')
    for side in (-1,1):ellipsoid('Ridge finial',(x+side*w*.54,y,z+rise+.070),(.042,.035,.055),'trim')

def window(x,y,z,w=.22,h=.34):
    cube('Recessed glazing',(x,y,z),(w,.025,h),'glass',.012)
    for side in (-1,1):cube('Window jamb',(x+side*(w/2+.014),y+.015,z),(.025,.035,h+.055),'wooddark')
    for side in (-1,1):cube('Window lintel',(x,y+.016,z+side*(h/2+.014)),(w+.04,.04,.027),'trim')
    for i in (-1,0,1):cube('Lattice mullion',(x+i*w/4,y+.036,z),(.009,.009,h),'woodlight',.002)
    cube('Lattice crosspiece',(x,y+.037,z),(w,.01,.012),'woodlight',.002)

def pavilion(name,x,y,z,w=1.12,d=.74,h=.73,tier=1,wall='plaster',open_sides=False):
    for level in range(tier):
        scale=1-level*.22;ww=w*scale;dd=d*scale;zz=z+level*(h+.08)
        cube(name+' raised sill',(x,y,zz+.035),(ww+.10,dd+.10,.07),'wooddark',.015)
        if not open_sides:cube(name+' wall',(x,y,zz+h*.49),(ww-.055,dd-.055,h*.90),wall,.017)
        for sx in (-1,1):
            for sy in (-1,1):
                cyl('Column stone shoe',(x+sx*ww*.47,y+sy*dd*.47,zz+.04),.066,.10,'stone',12)
                cyl('Carved support post',(x+sx*ww*.47,y+sy*dd*.47,zz+h*.5),.032,h,'wooddark',12)
                cube('Dougong bracket',(x+sx*ww*.44,y+sy*dd*.46,zz+h-.035),(.18,.12,.055),'trim')
        for sy in (-1,1):cube('Upper lintel',(x,y+sy*dd*.48,zz+h-.015),(ww+.06,.06,.08),'wooddark')
        if not open_sides:
            for k in (-1,0,1):window(x+k*ww*.29,y+dd/2,zz+h*.49,ww*.22,h*.46)
            for i in range(12):cube('Lower wall boarding',(x-ww*.47+i*ww*.94/11,y+dd*.505,zz+.11),(.055,.022,.15),'woodlight',.002)
        roof(name+str(level),x,y,zz+h,ww*1.31,dd*1.40,.24*scale,gold=tier>1)
    return z+(tier-1)*(h+.08)+h+.28

def lantern(x,y,z,mat='glow'):
    cyl('Lantern foot',(x,y,z+.035),.075,.07,'stone',12);cyl('Lantern post',(x,y,z+.26),.024,.45,'wooddark',12)
    ellipsoid('Paper lantern',(x,y,z+.47),(.105,.09,.14),mat,16,10)
    for zz in (.35,.59):cyl('Lantern rim',(x,y,z+zz),.084,.019,'trim',16)
    for k in range(8):
        a=k*TAU/8;pipe('Lantern fine rib',[(x+math.cos(a)*(.075+.03*math.sin(i*math.pi/8)),y+math.sin(a)*(.065+.03*math.sin(i*math.pi/8)),z+.35+i*.03) for i in range(9)],.003,'wooddark')

def tree(x,y,z,flower=False,snow=False):
    pts=[(x,y,z),(x-.08,y+.01,z+.32),(x+.03,y,z+.66),(x-.05,y+.015,z+.98)]
    pipe('Twisting tree trunk',pts,.053,'wooddark')
    rng=random.Random(7)
    for k in range(7):
        a=k*2.399;px=x+math.cos(a)*(.26 if k%2 else .19);py=y+math.sin(a)*.20;pz=z+.69+(k%3)*.13
        pipe('Tapered branch',[(x,y,z+.34),(x+.03,y,z+.57),(px,py,pz)],.018,'wooddark')
        for j in range(5):
            aa=j*2.4;ellipsoid('Layered canopy',(px+math.cos(aa)*.09,py+math.sin(aa)*.09,pz+rng.uniform(-.045,.045)),(.17,.135,.115),'snow' if snow and j%2==0 else 'petal' if flower else 'leaf',12,6)

def leaf_mark(x,y,z,r=.16):
    pipe('Leaf spiral',[(x+math.cos(k*.13)*r*(1-k/70),y,z+math.sin(k*.13)*r*(1-k/70)) for k in range(62)],.013,'trim')
    pipe('Leaf crest tail',[(x-r*.8,y,z-r*.2),(x-r*1.2,y,z-r*.55),(x-r*.4,y,z-r*.6)],.014,'trim')

def banner(x,y,z,w=.28,h=.50,mat='cloth'):
    beam('Banner mast',(x,y,.14),(x,y,z+.11),.014,'trim');beam('Banner crossbar',(x-.05,y,z),(x+w+.05,y,z),.014,'wooddark')
    v=[(x+i*w/8,y+.025*math.sin(i*.62+j*.24),z-j*h/8) for i in range(9) for j in range(9)];f=[]
    for i in range(8):
        for j in range(8):a=i*9+j;f.append((a,a+9,a+10,a+1))
    ob=mesh('Woven hanging banner',v,f,mat,True);mod=ob.modifiers.new('Cloth edge thickness','SOLIDIFY');mod.thickness=.004

def konoha():
    deck(w=2.65,d=1.02)
    pavilion('Village hall',-.20,-.02,.15,1.25,.79,.70)
    cyl('Upper circular study',(-.20,-.04,1.18),.32,.49,'plaster',32)
    cyl('Upper red fascia',(-.20,-.04,1.42),.365,.14,'red',32)
    cyl('Conical tiled crown',(-.20,-.04,1.59),.44,.27,'roof',32,r2=.025)
    cyl('Crown brass tip',(-.20,-.04,1.77),.021,.18,'trim',12)
    for k in range(12):
        a=k*TAU/12;beam('Upper radial baluster',(-.20+math.cos(a)*.33,-.04+math.sin(a)*.33,1.04),(-.20+math.cos(a)*.33,-.04+math.sin(a)*.33,1.34),.010,'wooddark')
    cube('Leaf plaque',(-.20,.44,.74),(.42,.035,.29),'red',.015);leaf_mark(-.20,.464,.74,.094)
    for i in range(4):cube('Welcoming stair',(-.20,.48+i*.08,.12-i*.028),(.59,.12,.05),'stone',.012)
    for x in (-1.12,1.12):lantern(x,.23,.16)
    railing(-.87,.51,.48);railing(.88,.51,.52)
    global anchor
    anchor='left';tree(0,0,.06);cyl('Training stump',(.20,.18,.13),.13,.26,'wood',18);torus('Stump growth ring',(.20,.18,.266),.085,.004,'wooddark')
    anchor='right';deck(w=.68,d=.51);pavilion('Ramen kiosk',0,0,.15,.56,.44,.40,open_sides=True);cube('Ramen counter',(0,.23,.34),(.65,.10,.10),'woodlight');banner(-.19,.26,.53,.16,.16,'cloth');banner(.02,.26,.53,.16,.16,'cloth')

def akatsuki():
    deck(w=2.55,d=.84)
    for k,(x,h) in enumerate([(-.80,1.03),(0,1.72),(.78,1.29)]):
        cube('Rain tower footing',(x,0,.22),(.54,.55,.22),'steel',.03)
        cube('Weathered rain tower',(x,0,.23+h/2),(.38,.42,h),'slate',.015)
        for j in range(7):
            zz=.37+j*h*.12;cube('Recessed vent',(x,.217,zz),(.23,.016,.058),'glass')
            cube('Vent sill',(x,.236,zz-.028),(.29,.04,.016),'steel')
        cube('Overhanging tower crown',(x,0,.30+h),(.57,.58,.10),'steel',.018)
        for sy in (-1,1):pipe('External rain drain',[(x+.26,sy*.12,.22),(x+.26,sy*.12,h*.75),(x+.13,sy*.12,h*.75),(x+.13,sy*.12,h+.41)],.031,'silver')
        for sx in (-1,1):beam('Tower antenna',(x+sx*.21,0,h+.32),(x+sx*.21,0,h+.55),.010,'silver')
    cube('Akatsuki enamel screen',(0,.268,1.13),(.39,.035,.43),'steel',.017)
    for dx,dz,r in [(-.10,0,.07),(0,.07,.083),(.10,0,.07),(0,-.035,.09)]:ellipsoid('Red cloud enamel',(dx,.303,1.13+dz),(r,.017,r*.68),'red')
    torus('Rinnegan seal',(.75,.24,.50),.126,.012,'purple',(math.pi/2,0,0));torus('Rinnegan inner seal',(.75,.255,.50),.08,.007,'trim',(math.pi/2,0,0))
    for i in range(4):cube('Rain landing step',(0,.43+i*.085,.13-i*.026),(.66,.13,.05),'stone')
    global anchor
    anchor='left';lantern(0,0,0,'red');pipe('Paper branch',[(0,0,.12),(.11,0,.48),(.02,0,.66)],.019,'silver')
    for i in range(5):cube('Folded paper charm',(.02+i*.025,0,.36+i*.062),(.095,.006,.045),'paper',0,(0,.35+i*.2,.1))
    anchor='right';cyl('Seal pedestal',(0,0,.1),.20,.20,'slate',16);torus('Seal rim',(0,0,.205),.15,.01,'red');ellipsoid('Obsidian seal',(0,0,.23),(.10,.10,.05),'glass')

def sunny():
    # Stationed ship with a shaped hull, deckhouse, double mast rig and lion prow.
    xs=[-1.25,-1.0,-.6,0,.6,1.0,1.25];widths=[.04,.32,.44,.47,.40,.24,.025];v=[]
    for band in range(4):
        zz=[-.08,.10,.30,.44][band];scale=[.40,.73,.95,1][band]
        for side in (-1,1):
            for x,w in zip(xs,widths):v.append((x,w*side*scale,zz+abs(x)**2*.07))
    faces=[]
    for band in range(3):
        for side in range(2):
            for i in range(6):a=band*14+side*7+i;faces.append((a,a+1,a+15,a+14))
    mesh('Curved carvel hull',v,faces,'wood',True)
    deck(w=1.94,d=.71)
    for i in range(14):cube('Deck board',(i*.14-.91,0,.446),(.13,.74,.032),'woodlight')
    for side in (-1,1):
        pipe('White gunwale',[(x,w*side,.46+abs(x)**2*.07) for x,w in zip(xs,widths)],.040,'paper')
        pipe('Hull red sheer strake',[(x,w*side*.90,.23+abs(x)**2*.07) for x,w in zip(xs,widths)],.022,'red')
    pavilion('Sunny deckhouse',-.49,-.06,.46,.66,.53,.45,wall='plaster')
    for x in (-.42,0,.42):torus('Brass porthole',(x,.425,.27),.053,.012,'trim',(math.pi/2,0,0))
    for x,height in ((.28,1.95),(-.72,1.38)):
        beam('Ship mast',(x,0,.44),(x,0,height),.029,'wooddark');beam('Mast crossarm',(x-.40,0,height-.14),(x+.40,0,height-.14),.018,'wooddark')
        width=.75 if x>0 else .46;hh=.85 if x>0 else .42
        vs=[(x+(u/10-.5)*width,-.05-.10*math.sin(u/10*math.pi)*math.sin(t/12*math.pi),height-.18-t/12*hh) for u in range(11) for t in range(13)];fs=[]
        for u in range(10):
            for t in range(12):a=u*13+t;fs.append((a,a+13,a+14,a+1))
        ob=mesh('Billowing linen sail',vs,fs,'paper',True);ob.modifiers.new('Sail thickness','SOLIDIFY').thickness=.005
        pipe('Standing rigging',[(x-.39,0,height-.14),(x-.55,.25,.47)],.007,'rope');pipe('Standing rigging',[(x+.39,0,height-.14),(x+.50,-.23,.47)],.007,'rope')
    for k in range(12):
        a=k*TAU/12;ellipsoid('Sun lion mane',(1.15,.015+math.cos(a)*.23,.60+math.sin(a)*.23),(.07,.075,.09),'gold',12,6)
    ellipsoid('Lion prow muzzle',(1.23,.015,.60),(.105,.17,.17),'gold');ellipsoid('Lion ivory muzzle',(1.315,.015,.557),(.035,.10,.064),'paper');
    for side in (-1,1):ellipsoid('Lion eye',(1.32,.015+side*.07,.65),(.016,.023,.028),'glass')
    ellipsoid('Lion nose',(1.353,.015,.587),(.012,.029,.018),'wooddark')
    for side in (-1,1):torus('Lifebuoy',(-.54,side*.44,.60),.109,.024,'paper',(math.pi/2,0,0))
    global anchor
    anchor='left';tree(0,0,0);rng=random.Random(8)
    for i in range(7):ellipsoid('Tangerine',(.17*math.cos(i*2.4),.16*math.sin(i*2.4),.66+rng.random()*.28),(.045,.045,.045),'gold')
    anchor='right';cyl('Mooring bollard',(0,0,.14),.065,.28,'wooddark');torus('Coiled mooring rope',(0,0,.018),.12,.014,'rope');torus('Coiled mooring rope',(0,0,.020),.155,.014,'rope')

def wano():
    deck(w=2.15,d=.98);pavilion('Wano keep',-.17,-.05,.16,1.1,.78,.66,2)
    for side in (-1,1):lantern(side*.88,.28,.15,'petal')
    railing(0,.50,1.8)
    global anchor
    anchor='left';tree(0,0,0,True)
    anchor='right';tree(0,0,0,True);cyl('Stone lantern pedestal',(.20,.17,.18),.09,.36,'stone',8)
    anchor='front'
    for k in range(13):
        x=-.57+k*.095;z=.035+.17*math.sin(k/12*math.pi);cube('Arched bridge board',(x,0,z),(.092,.39,.045),'red')
        if k%2==0:
            for side in (-1,1):beam('Bridge baluster',(x,side*.19,z),(x,side*.19,z+.22),.012,'trim')
    for side in (-1,1):pipe('Bridge curved handrail',[(-.57+k*.095,side*.19,.26+.17*math.sin(k/12*math.pi)) for k in range(13)],.019,'wooddark')

def valorant():
    cube('Radianite platform',(0,0,.09),(2.55,1.12,.20),'steel',.055)
    for i in range(9):cube('Industrial paving seam',(i*.28-1.12,.42,.199),(.012,.24,.005),'slate',0)
    for side in (-1,1):
        x=side*.80;cube('Angular reactor pylon',(x,0,.74),(.39,.56,1.15),'steel',.045,rot=(0,side*-.12,0));cube('Ceramic armor panel',(x,.303,.85),(.34,.055,.76),'paper',.018,rot=(0,side*-.12,0))
        cube('Recessed cyan conduit',(x,.34,.85),(.061,.027,.54),'cyan',.009,rot=(0,side*-.12,0));cube('Pylon footing',(x,0,.19),(.62,.72,.18),'slate',.027)
        for j in range(4):cube('Vent louvre',(x,.355,.37+j*.051),(.24,.017,.023),'slate',.002)
        for yy in (-.24,.24):
            for zz in (.34,1.12):ellipsoid('Titanium bolt',(x,yy,zz),(.022,.015,.023),'silver',10,5)
    cyl('Containment ring',(0,0,.29),.36,.15,'silver',12);cyl('Crystal cradle',(0,0,.41),.27,.17,'steel',8)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(0,0,.83));ob=bpy.context.object;ob.scale=(.26,.25,.52);finish(ob,'Faceted radianite core','cyan')
    for k in range(3):
        a=k*TAU/3;beam('Containment jaw',(math.cos(a)*.27,math.sin(a)*.27,.35),(math.cos(a)*.18,math.sin(a)*.18,1.20),.038,'steel')
    cube('Reactor crown',(0,-.02,1.40),(1.48,.55,.13),'steel',.040);cube('Crown cyan inset',(0,.26,1.39),(.44,.022,.04),'cyan',.005)
    for side in (-1,1):
        cube('Equipment rack',(side*1.11,.20,.39),(.30,.50,.45),'steel',.025);cube('Service screen',(side*1.11,.46,.48),(.22,.018,.13),'glass');cube('Active screen line',(side*1.11,.475,.49),(.14,.01,.015),'cyan')
    global anchor
    for anchor in ('left','right'):
        cube('Radianite supply crate',(0,0,.15),(.43,.43,.30),'steel',.026)
        for side in (-1,1):cube('Crate white brace',(side*.16,0,.16),(.045,.47,.28),'paper',.008)
        cube('Supply neon inset',(0,.224,.17),(.18,.015,.10),'cyan',.008)

def dragon():
    deck(w=2.6,d=1.03);pavilion('Jade sea palace',0,0,.15,1.2,.80,.63,2,wall='jade')
    for side in (-1,1):
        x=side*1.02;cyl('Dragon pillar plinth',(x,0,.20),.17,.16,'jade',16);cyl('Jade column',(x,0,.61),.085,.76,'jade',20)
        pipe('Gilded dragon around pillar',[(x+.115*math.cos(k*.19),.115*math.sin(k*.19),.28+k*.011) for k in range(65)],.028,'gold')
        ellipsoid('Dragon head',(x+.10,.01,1.04),(.073,.055,.048),'gold');pipe('Sweeping dragon horn',[(x+.10,.01,1.06),(x+.16,.02,1.13),(x+.18,.025,1.11)],.013,'gold');ellipsoid('Pearl crown',(x,0,1.16),(.075,.075,.075),'paper')
    for i in range(6):cube('Jade palace stair',(0,.49+i*.065,.15-i*.023),(.63,.10,.049),'jade',.012)
    global anchor
    for anchor in ('left','right'):
        cyl('Pearl basin base',(0,0,.075),.22,.15,'jade',16)
        for k in range(9):
            a=k*TAU/9;ellipsoid('Shell petal',(math.cos(a)*.135,math.sin(a)*.135,.19),(.065,.034,.10),'paper',12,6)
        ellipsoid('Luminous pearl',(0,0,.27),(.088,.088,.088),'glow')

def redcliff():
    deck(w=2.70,d=1.02)
    for side in (-1,1):
        x=side*.77;cube('Watchtower stonework',(x,-.02,.51),(.64,.71,.75),'stone',.025)
        for row in range(5):
            for k in range(3):cube('Dressed ashlar block',(x+(k-1)*.205+(row%2)*.025,.347,.22+row*.13),(.197,.028,.123),'stone' if (k+row)%3 else 'slate',.009)
        pavilion('Fortress watch pavilion',x,-.02,.89,.63,.66,.41,open_sides=True)
        for k in range(4):cube('Crenellation',(x-.25+k*.17,.345,.94),(.095,.09,.15),'stone')
        banner(x+side*.37,-.04,1.72,.24,.53)
    cube('Gate lintel',(0,.0,.70),(.96,.30,.18),'wooddark',.012)
    for side in (-1,1):cube('Ironbound gate',(side*.18,.11,.42),(.34,.10,.47),'wood')
    for z in (.28,.49,.61):cube('Gate iron strap',(0,.17,z),(.75,.025,.033),'steel')
    for side in (-1,1):torus('Gate bronze pull',(side*.06,.20,.44),.037,.010,'gold',(math.pi/2,0,0))
    railing(0,.51,2.45)
    global anchor
    for anchor in ('left','right'):
        for k in range(5):cyl('Sharpened timber palisade',((k-2)*.075,0,.20),.035,.40,'wooddark',10,r2=.011)
        beam('Palisade tie',(-.19,.026,.15),(.19,.026,.15),.020,'rope')
        cyl('Beacon brazier',(0,.20,.23),.13,.18,'steel',12,r2=.18);ellipsoid('Banked charcoal',(0,.20,.33),(.12,.10,.033),'red')

def clockwork():
    deck(w=2.5,d=1.04)
    cube('Brick engine house',(-.37,0,.63),(1.08,.75,.93),'red',.018)
    for row in range(8):
        for k in range(8):cube('Kiln brick',(-.89+k*.146+(row%2)*.033,.382,.23+row*.103),(.137,.018,.087),'red' if (row+k)%4 else 'wood',.005)
    roof('Copper engine roof',-.37,0,1.10,1.32,1.04,.30,'roof')
    for x in (-.68,-.07):window(x,.411,.77,.22,.34)
    cube('Boiler door',(-.37,.407,.46),(.28,.028,.44),'steel',.018);torus('Boiler sight glass',(-.37,.436,.56),.061,.013,'trim',(math.pi/2,0,0));ellipsoid('Pressure glass',(-.37,.447,.56),(.049,.016,.049),'cyan')
    for x,height in ((-.73,1.93),(-.08,1.62)):
        cyl('Copper chimney',(x,-.18,1.18+(height-1.18)/2),.063,height-1.18,'copper',16)
        for z in (1.20,height-.09):cyl('Chimney ferrule',(x,-.18,z),.081,.036,'trim',16)
        cyl('Chimney cap',(x,-.18,height),.12,.055,'steel',16)
    x=.70;y=.05;z=.63
    for yy in (-.04,.13):torus('Wheel brass rim',(x,yy,z),.44,.033,'trim',(math.pi/2,0,0))
    for k in range(14):
        a=k*TAU/14;beam('Wheel spoke',(x,y,z),(x+math.cos(a)*.44,y,z+math.sin(a)*.44),.018,'trim');cube('Waterwheel paddle',(x+math.cos(a)*.44,y,z+math.sin(a)*.44),(.13,.27,.055),'wood',.006,(0,-a,0))
    ellipsoid('Waterwheel bearing',(x,.19,z),(.09,.033,.09),'cyan');beam('Wheel axle',(x,-.27,z),(x,.21,z),.044,'steel')
    pipe('Sweeping boiler pipe',[(.08,-.13,.28),(.34,-.13,.28),(.34,-.13,1.05),(.16,-.13,1.05)],.043,'copper')
    global anchor
    anchor='left';cyl('Fuel barrel',(0,0,.20),.17,.40,'wood',16)
    for z in (.04,.20,.36):torus('Barrel hoop',(0,0,z),.173,.012,'steel')
    anchor='right';lantern(0,0,0);torus('Spare gear',(0,.21,.12),.13,.018,'trim',(math.pi/2,0,0))

def astral():
    cyl('Observatory marble foundation',(0,0,.12),.75,.23,'stone',48)
    cyl('Observatory rotunda',(0,0,.54),.56,.65,'slate',48)
    for k in range(12):
        a=k*TAU/12;beam('Fluted observatory pilaster',(math.cos(a)*.57,math.sin(a)*.57,.27),(math.cos(a)*.57,math.sin(a)*.57,.84),.022,'trim')
        if k%2==0:ellipsoid('Arched star window',(math.cos(a)*.572,math.sin(a)*.572,.55),(.065,.065,.15),'glass')
    # Hemispherical metal dome with a real open observation slit.
    v=[];f=[];cols=48;rows=12
    for j in range(rows+1):
        a=j/rows*math.pi/2
        for k in range(cols+1):
            b=.15+(TAU-.30)*k/cols;v.append((math.cos(b)*math.cos(a)*.64,math.sin(b)*math.cos(a)*.64,.88+math.sin(a)*.51))
    for j in range(rows):
        for k in range(cols):a=j*(cols+1)+k;f.append((a,a+1,a+cols+2,a+cols+1))
    ob=mesh('Opening observatory dome',v,f,'roof',True)
    bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
    ob.modifiers.new('Dome metal thickness','SOLIDIFY').thickness=.020
    torus('Dome azimuth track',(0,0,.89),.65,.023,'trim')
    for k in range(6):
        b=.22+k*1.0;pipe('Dome seam',[(math.cos(b)*math.cos(j/12*math.pi/2)*.645,math.sin(b)*math.cos(j/12*math.pi/2)*.645,.88+math.sin(j/12*math.pi/2)*.515) for j in range(13)],.007,'silver')
    beam('Telescope barrel',(.13,0,1.11),(.86,0,1.56),.066,'silver');beam('Telescope collar',(.72,0,1.474),(.88,0,1.57),.086,'trim');ellipsoid('Telescope lens',(.89,0,1.575),(.035,.07,.07),'cyan')
    for i in range(5):cube('Observatory stair',(0,.65+i*.06,.20-i*.04),(.47,.10,.057),'stone',.012)
    global anchor
    anchor='left';cyl('Armillary foot',(0,0,.09),.18,.18,'stone',16);beam('Armillary stem',(0,0,.15),(0,0,.49),.025,'trim')
    for rot in ((math.pi/2,0,0),(.50,.72,.3),(0,0,0)):torus('Armillary orbital ring',(0,0,.68),.30,.012,'trim',rot)
    ellipsoid('Amethyst globe',(0,0,.68),(.073,.073,.073),'purple')
    anchor='right';lantern(0,0,0,'purple')

def onsen():
    deck(w=2.6,d=1.13);pavilion('Hinoki bath house',-.1,-.06,.15,1.49,.95,.85,open_sides=True)
    for k in range(17):cube('Bamboo privacy screen',(-.79+k*.085,-.46,.66),(.04,.028,.89),'woodlight',.012)
    for side in (-1,1):cube('Paper changing screen',(-.1+side*.54,.0,.71),(.20,.018,.79),'paper',.006)
    for side in (-1,1):
        for k in range(5):ellipsoid('Settled roof snow',(-.71+k*.30,side*.31,1.15+(.07 if k%2 else .05)),(.23,.25,.060),'snow',16,8)
    for x in (-1.06,1.10):lantern(x,.38,.15)
    for k in range(4):cube('Cedar approach step',(-.1,.56+k*.10,.12-k*.030),(.73,.15,.058),'woodlight',.010)
    global anchor
    anchor='left';tree(0,0,0,True,True)
    anchor='right'
    for k in range(7):
        a=k*2.399;ellipsoid('Volcanic bath stone',(.22*math.cos(a),.17*math.sin(a),.06+(k%3)*.035),(.15,.12,.09),'stone')
        if k%2==0:ellipsoid('Natural snow cap',(.22*math.cos(a),.17*math.sin(a),.15+(k%3)*.035),(.14,.115,.034),'snow')
    pipe('Bamboo spring spout',[(0,-.10,.0),(0,-.10,.48),(0,.10,.48)],.025,'woodlight')

BUILDERS={k:v for k,v in list(globals().items()) if k in ['konoha','akatsuki','sunny','wano','valorant','dragon','redcliff','clockwork','astral','onsen']}

def prepare(id):
    global anchor,skin,MATS,ANCHORS
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):bpy.data.materials.remove(block)
    MATS={};ANCHORS={};anchor='back';skin=id
    palette={
      'konoha':('#a95d39','#597657','#d5bd7e','#dcd0ad'), 'akatsuki':('#364050','#262e3d','#b098a0','#515566'),
      'sunny':('#b87840','#bb4e3a','#deb870','#f0dfb6'), 'wano':('#934f59','#433d59','#d5b980','#e5c7b6'),
      'valorant':('#495965','#34434e','#aebdc5','#d9e1de'), 'dragon':('#527a75','#256d6d','#dec890','#cbe0c9'),
      'redcliff':('#78624d','#425e5a','#c3a77c','#aea68e'), 'clockwork':('#a25d40','#496f69','#d4ae70','#c6ba95'),
      'astral':('#545a87','#303855','#cbbd96','#b8b9ce'), 'onsen':('#a5916a','#6a8080','#c6b38f','#dfd4b8')
    }[id]
    for name,color,kind,metal,rough in [
      ('wood',palette[0],5,0,.48),('woodlight',palette[3],5,0,.47),('wooddark','#514d40',5,0,.52),
      ('roof',palette[1],7,.12,.38),('rooflight',palette[1],7,.05,.47),('trim',palette[2],10,.55,.30),('plaster',palette[3],7,0,.63),
      ('stone','#88938b',7,0,.69),('slate','#3b4759',7,.05,.58),('steel','#374a59',10,.70,.38),('silver','#a7babd',10,.73,.28),
      ('gold','#d7ad57',10,.65,.29),('copper','#b77b56',10,.66,.35),('glass','#203c46',23,.18,.18),
      ('red','#ad4845',7,.05,.45),('cloth','#9d4a55',7,0,.81),('paper','#ecdfc2',7,0,.60),('rope','#b4a17b',5,0,.85),
      ('leaf','#6e8b54',6,0,.65),('petal','#d8a1b4',7,0,.72),('snow','#e6efeb',24,0,.68),('jade','#9bcec0',23,.12,.25),
      ('cyan','#63d4d4',11,.1,.24),('glow','#e5ce93',11,0,.35),('purple','#b4a0db',23,.18,.22)]:material(name,color,kind,metal,rough)
    for name,location in {'back':(0,-2.12,.11),'left':(-2.26,-.28,.11),'right':(2.26,-.13,.11),'front':(0,1.91,.11)}.items():
        obj=bpy.data.objects.new(name.upper()+' shoreline anchor',None);bpy.context.collection.objects.link(obj);obj.location=location;ANCHORS[name]=obj

def export_game(id):
    deps=bpy.context.evaluated_depsgraph_get();groups={};objects=[o for o in bpy.context.scene.objects if o.get('pond_anchor') in ('back','left','right','front')]
    for ob in objects:
        ev=ob.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();an=ob['pond_anchor'];matrix=ANCHORS[an].matrix_world.inverted() @ ob.matrix_world;normal=matrix.to_3x3().inverted().transposed()
        for tri in me.loop_triangles:
            mat=me.materials[tri.material_index] if len(me.materials) else MATS['stone'];key=(an,mat.name);group=groups.setdefault(key,{'anchor':an,'color':mat['game_color'],'material':mat['game_material'],'p':[],'n':[]})
            # Swapping Blender Y/Z changes handedness: reverse triangle order
            # so geometric faces and the exported shading normals agree.
            for vi,li in reversed(list(zip(tri.vertices,tri.loops))):
                p=matrix @ me.vertices[vi].co;n=(normal @ me.corner_normals[li].vector).normalized();group['p'].extend((p.x,p.z,p.y));group['n'].extend((n.x,n.z,n.y))
        ev.to_mesh_clear()
    data=bytearray();parts=[]
    for (an,name),g in groups.items():
        offset=len(data);values=g.pop('p');normals=g.pop('n');data.extend(struct.pack('<'+'f'*len(values),*values));data.extend(struct.pack('<'+'f'*len(normals),*normals));parts.append({**g,'name':name,'offset':offset,'count':len(values)//3})
    base='pond-skin-'+id+'-scene-v1';(ART/(base+'.bin')).write_bytes(data)
    manifest={'version':1,'id':id,'authoring':'Blender '+bpy.app.version_string,'coordinates':'X right / Y up / Z depth','binary':'/fishing-art/'+base+'.bin','triangles':sum(p['count'] for p in parts)//3,'parts':parts}
    (ART/(base+'.json')).write_text(json.dumps(manifest,indent=2),encoding='utf8')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects:ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(SOURCE/(id+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_animations=False,export_lights=False,export_cameras=False)
    print('POND_MODEL',json.dumps({'id':id,'triangles':manifest['triangles'],'parts':len(parts),'bytes':len(data),'objects':len(objects)}),flush=True)

def presentation(id):
    global anchor
    # Add a separate presentation pond. It is not exported into game geometry:
    # the game keeps its real selected ground, live water, and swimming fish.
    anchor='presentation';empty=bpy.data.objects.new('PRESENTATION ONLY',None);bpy.context.collection.objects.link(empty);ANCHORS[anchor]=empty
    material('pond_base','#477772',7,0,.65);material('pond_water','#629e99',23,.10,.20)
    cyl('Preview pond geological base',(0,0,-.19),2.57,.32,'pond_base',96)
    verts=[];faces=[];uv=[];N=192
    for r,z in [(1.84,.02),(2.57,.13)]:
        for i in range(N):a=i*TAU/N;verts.append((math.cos(a)*r,math.sin(a)*r*.83,z))
    for i in range(N):faces.append((i,(i+1)%N,(i+1)%N+N,i+N))
    ob=mesh('Imagegen bank material',verts,faces,'pond_base',True);ob['pond_anchor']='presentation';me=ob.data;layer=me.uv_layers.new(name='Generated bank annulus')
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi=me.loops[li].vertex_index;a=(vi%N)*TAU/N;r=.30 if vi<N else .474;layer.data[li].uv=(.5+math.cos(a)*r,.5-math.sin(a)*r)
    mat=bpy.data.materials.new('IMAGEGEN bank '+id);mat.use_nodes=True;tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ART/('pond-skin-'+id+'-bank-v1.png')));mat.node_tree.links.new(tex.outputs['Color'],mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color']);me.materials.clear();me.materials.append(mat)
    cyl('Preview water',(0,0,-.01),1.83,.025,'pond_water',96).scale.y=.83
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.film_transparent=True;scene.world.color=(.35,.35,.35)
    for name,loc,power,size in [('Key',(-3,-4,7),700,5),('Fill',(4,1,5),450,5),('Rim',(-2,4,4),500,4)]:
        bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(5.2,7.5,6.1));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.9;scene.camera=cam
    scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/(id+'.png'))
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(id+'.blend')))
    bpy.ops.render.render(write_still=True)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['konoha']
if '--pack-existing' in args:
    for id in BUILDERS:
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE/(id+'.blend')))
        ANCHORS={name:bpy.data.objects[name.upper()+' shoreline anchor'] for name in ('back','left','right','front')}
        export_game(id)
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.file.pack_all()
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(id+'.blend')))
        assert all(im.packed_file for im in bpy.data.images if im.source=='FILE' and im.filepath)
    sys.exit(0)
ids=list(BUILDERS) if 'all' in args else [a for a in args if a in BUILDERS]
for id in ids:
    prepare(id);BUILDERS[id]();export_game(id);presentation(id)

