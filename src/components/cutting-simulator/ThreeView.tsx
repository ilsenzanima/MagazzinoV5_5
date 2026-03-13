"use client";

/**
 * Vista 3D reale del progetto canala usando Three.js / React Three Fiber.
 * Riceve i nodi 3D calcolati da computeLayout() e li renderizza come geometria WebGL.
 * 
 * Coordinate: il layout engine usa (x, y, z) dove Y è la profondità e Z è l'altezza.
 * Three.js usa (x, y, z) dove Y è l'altezza. La funzione v3() fa la conversione.
 */

import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Text } from "@react-three/drei";
import * as THREE from "three";
import type { SegmentNode3D, Vec3 } from "@/lib/cutting-simulator/project-layout";
import type { StraightSegment, Elbow90Segment, ContextualElementSegment, SectionProfile } from "@/lib/cutting-simulator/project-model";

// ==================== COSTANTI ====================

const DUCT_COLOR = "#d4c8a8";       // calciosilicato
const DUCT_COLOR_SELECTED = "#f59e0b";
const WALL_COLOR = "#8b8680";
const FLOOR_COLOR = "#6b7280";
const PENDINO_COLOR = "#71717a";
const JOINT_COLOR = "#ef4444";
const ELBOW_COLOR = "#e8a838";

const SCALE = 0.001; // 1mm → 0.001 unità Three.js (lavoriamo in metri)

// ==================== HELPERS ====================

/** Converte coordinate layout (x,y,z dove Z=altezza) → Three.js (x,y,z dove Y=altezza) */
function v3(p: Vec3): THREE.Vector3 {
    return new THREE.Vector3(p.x * SCALE, p.z * SCALE, -p.y * SCALE);
}

/** Calcola posizione, quaternion e lunghezza tra due punti layout */
function orientBetween(start: Vec3, end: Vec3) {
    const s = v3(start);
    const e = v3(end);
    const mid = new THREE.Vector3().lerpVectors(s, e, 0.5);
    const dir = new THREE.Vector3().subVectors(e, s);
    const len = dir.length();
    const quat = new THREE.Quaternion();
    if (len > 0.0001) {
        // Estrude lungo Z di default, ruotiamo da Z verso la direzione reale
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
    }
    return { position: mid, quaternion: quat, length: len };
}

// ==================== COMPONENTI SEGMENTO ====================

interface SegmentMeshProps {
    node: SegmentNode3D;
    section: SectionProfile;
    selected: boolean;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    jointBands?: boolean;
    jointBandWidth?: number;
}

/** Tratto dritto — box cavo (sezione rettangolare con foro interno, estruso) */
function StraightMesh({ node, section, selected, onClick, jointBands, jointBandWidth }: SegmentMeshProps) {
    const outerW = node.outerW * SCALE;
    const outerH = node.outerH * SCALE;
    const t = section.thickness * SCALE;
    const color = selected ? DUCT_COLOR_SELECTED : DUCT_COLOR;

    const { position, quaternion, length } = useMemo(
        () => orientBetween(node.start, node.end),
        [node.start, node.end]
    );

    // Shape cava
    const geometry = useMemo(() => {
        const s = new THREE.Shape();
        const hw = outerW / 2, hh = outerH / 2;
        s.moveTo(-hw, -hh); s.lineTo(hw, -hh); s.lineTo(hw, hh); s.lineTo(-hw, hh); s.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-hw + t, -hh + t); hole.lineTo(hw - t, -hh + t);
        hole.lineTo(hw - t, hh - t); hole.lineTo(-hw + t, hh - t); hole.closePath();
        s.holes.push(hole);
        const geo = new THREE.ExtrudeGeometry(s, { steps: 1, depth: length, bevelEnabled: false });
        geo.translate(0, 0, -length / 2); // centra sull'origine
        return geo;
    }, [outerW, outerH, t, length]);

    if (length < 0.0001) return null;

    return (
        <group position={position} quaternion={quaternion}>
            <mesh geometry={geometry}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
                <meshStandardMaterial
                    color={color} transparent opacity={selected ? 0.85 : 0.7}
                    side={THREE.DoubleSide} roughness={0.8} metalness={0.05}
                />
            </mesh>
            <mesh geometry={geometry}>
                <meshBasicMaterial color={selected ? "#f59e0b" : "#999"} wireframe transparent opacity={0.25} />
            </mesh>
            {jointBands && (
                <mesh position={[0, 0, -length / 2]}>
                    <boxGeometry args={[outerW + 0.002, outerH + 0.002, (jointBandWidth || 100) * SCALE]} />
                    <meshStandardMaterial color={JOINT_COLOR} transparent opacity={0.4} />
                </mesh>
            )}

            {/* Freccia Direzionale: linea + cono → mostra direzione scorrimento */}
            {length > 0.1 && (() => {
                const arrowLen = Math.min(length * 0.5, 0.4); // max 40 cm
                const coneH = Math.min(outerW * 0.5, arrowLen * 0.4);
                const shaftLen = arrowLen - coneH;
                // Il gruppo è già orientato con quaternion corretto:
                // +Z locale = direzione verso node.end
                // Posizioniamo la freccia sopra la canala, centrata
                const posZ = 0;          // centro del segmento (già centrato nella geom)
                const posY = outerH / 2 + 0.008; // appena sopra il top
                return (
                    <group position={[0, posY, posZ]}>
                        {/* Asta lineare (thin box) */}
                        <mesh position={[0, 0, shaftLen / 2]}>
                            <boxGeometry args={[outerW * 0.05, 0.005, shaftLen]} />
                            <meshBasicMaterial
                                color={selected ? '#f59e0b' : '#2563eb'}
                                transparent opacity={0.9} depthTest={false}
                            />
                        </mesh>
                        {/* Punta conica (+Z = verso la fine) */}
                        <mesh position={[0, 0, shaftLen + coneH / 2]} rotation={[Math.PI / 2, 0, 0]}>
                            <coneGeometry args={[outerW * 0.22, coneH, 4]} />
                            <meshBasicMaterial
                                color={selected ? '#f59e0b' : '#3b82f6'}
                                transparent opacity={0.9} depthTest={false}
                            />
                        </mesh>
                    </group>
                );
            })()}
        </group>
    );
}

/** Curva 90° — due bracci + blocco d'angolo */
function ElbowMesh({ node, section, selected, onClick }: SegmentMeshProps) {
    const outerW = node.outerW * SCALE;
    const outerH = node.outerH * SCALE;
    const color = selected ? DUCT_COLOR_SELECTED : ELBOW_COLOR;

    const corner = node.corner || node.end;

    // Braccio A: start → corner
    const armA = useMemo(() => orientBetween(node.start, corner), [node.start, corner]);
    // Braccio B: corner → end
    const armB = useMemo(() => orientBetween(corner, node.end), [corner, node.end]);
    // Posizione blocco angolo
    const cornerPos = useMemo(() => v3(corner), [corner]);

    return (
        <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {/* Braccio A */}
            {armA.length > 0.0001 && (
                <group position={armA.position} quaternion={armA.quaternion}>
                    <mesh>
                        <boxGeometry args={[outerW, outerH, armA.length]} />
                        <meshStandardMaterial color={color} transparent opacity={selected ? 0.8 : 0.6} roughness={0.7} />
                    </mesh>
                </group>
            )}
            {/* Braccio B */}
            {armB.length > 0.0001 && (
                <group position={armB.position} quaternion={armB.quaternion}>
                    <mesh>
                        <boxGeometry args={[outerW, outerH, armB.length]} />
                        <meshStandardMaterial color={color} transparent opacity={selected ? 0.8 : 0.6} roughness={0.7} />
                    </mesh>
                </group>
            )}
            {/* Blocco d'angolo */}
            <mesh position={cornerPos}>
                <boxGeometry args={[outerW, outerH, outerW]} />
                <meshStandardMaterial color={color} transparent opacity={selected ? 0.8 : 0.6} />
            </mesh>
        </group>
    );
}

/** Indicatore muro/solaio — bordi wireframe con offset dalle quote */
function WallIndicator({ node }: { node: SegmentNode3D }) {
    const seg = node.segment as ContextualElementSegment;
    const isWall = seg.obstacleType === 'wall';
    const wallColor = isWall ? WALL_COLOR : FLOOR_COLOR;

    const { position, quaternion } = useMemo(
        () => orientBetween(node.start, node.end),
        [node.start, node.end]
    );

    // Lo "spessore" è lungo la direzione di flusso (depth).
    // La "width" (base) è ortogonale al flusso (asse X locale del muro).
    // La "height" è verticale (asse Y locale del muro, che corrisponde a Z globale).
    const w = seg.width * SCALE;
    const h = seg.height * SCALE;
    const d = seg.thickness * SCALE;

    // Offset calcolato dal layout engine (quote top/bottom/left/right)
    const finalPosition = useMemo(() => {
        const p = position.clone();
        if (node.obstacleOffset) {
            // Le quote sono state aggiunte in coords mondiali prima, le ribadiamo su v3
            p.add(v3(node.obstacleOffset));
        }
        return p;
    }, [position, node.obstacleOffset]);

    const edgesGeo = useMemo(
        () => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
        [w, h, d]
    );

    return (
        <group position={finalPosition} quaternion={quaternion}>
            <lineSegments geometry={edgesGeo}>
                <lineBasicMaterial color={wallColor} transparent opacity={0.7} />
            </lineSegments>
            <mesh>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={wallColor} transparent opacity={0.2} depthWrite={false} />
            </mesh>
        </group>
    );
}

/** Pendino — fissaggio orientabile (top=soffitto, bottom=pavimento, left/right=muro laterale) */
function PendinoMesh({ node, selected, onClick }: SegmentMeshProps) {
    const pos = useMemo(() => v3(node.start), [node.start]);
    const color = selected ? DUCT_COLOR_SELECTED : PENDINO_COLOR;
    const outerH = node.outerH * SCALE;
    const outerW = node.outerW * SCALE;
    const orient = node.pendinoOrientation || 'top';

    // Quaternion composto: prima orienta verso la direzione canala, poi ruota per l'orientamento staffa
    const quat = useMemo(() => {
        const q = new THREE.Quaternion();
        const dir = node.direction;
        // Base: asse Z locale = direzione canala
        switch (dir) {
            case '+x': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); break;
            case '-x': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); break;
            case '+y': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); break;
            case '-y': /* default */ break;
            case '+z': q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); break;
            case '-z': q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); break;
        }
        // Ruota attorno Z locale per l'orientamento della staffa
        const orientQ = new THREE.Quaternion();
        switch (orient) {
            case 'top': /* default, nessuna rotazione extra */ break;
            case 'bottom': orientQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI); break;
            case 'left': orientQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2); break;
            case 'right': orientQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2); break;
        }
        q.multiply(orientQ);
        return q;
    }, [node.direction, orient]);

    // Tutto è nello spazio locale orientato dal quaternion
    // Y locale = alto (verso il fissaggio), X locale = larghezza canala
    const pendHeight = 0.6;
    const barX = outerW / 2 + 0.01;
    const ceilY = outerH / 2 + pendHeight;
    const barY = -outerH / 2 - 0.005;
    const rodBottom = barY - 0.02;
    const rodLen = ceilY - rodBottom;
    const rodY = (ceilY + rodBottom) / 2;

    return (
        <group position={pos} quaternion={quat} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {/* Barre filettate verticali */}
            <mesh position={[-barX, rodY, 0]}>
                <cylinderGeometry args={[0.004, 0.004, rodLen, 8]} />
                <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[barX, rodY, 0]}>
                <cylinderGeometry args={[0.004, 0.004, rodLen, 8]} />
                <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Piastre fissaggio */}
            <mesh position={[-barX, ceilY, 0]}>
                <boxGeometry args={[0.04, 0.003, 0.04]} />
                <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[barX, ceilY, 0]}>
                <boxGeometry args={[0.04, 0.003, 0.04]} />
                <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Staffa di supporto sotto la canala */}
            <mesh position={[0, barY, 0]}>
                <boxGeometry args={[outerW + 0.04, 0.004, 0.03]} />
                <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
            </mesh>
        </group>
    );
}

// ==================== LABELS ====================

function SegmentLabel({ node }: { node: SegmentNode3D }) {
    const seg = node.segment;
    const mid = useMemo(() => {
        const s = v3(node.start), e = v3(node.end);
        return new THREE.Vector3().lerpVectors(s, e, 0.5);
    }, [node.start, node.end]);

    let text = '';
    if (seg.type === 'straight') text = `${(seg as StraightSegment).length}mm`;
    else if (seg.type === 'elbow90') text = `90° ${(seg as Elbow90Segment).direction}`;
    else if (seg.type === 'obstacle') {
        const obs = seg as ContextualElementSegment;
        text = `${obs.obstacleType === 'wall' ? 'Muro' : 'Solaio'} ${obs.thickness}mm`;
    } else if (seg.type === 'pendino') text = 'Pendino';

    if (!text) return null;

    return (
        <Text
            position={[mid.x, mid.y + node.outerH * SCALE / 2 + 0.04, mid.z]}
            fontSize={0.025} color="white"
            anchorX="center" anchorY="bottom"
            outlineWidth={0.002} outlineColor="black"
        >
            {text}
        </Text>
    );
}

// ==================== SCENE ====================

interface SceneProps {
    nodes3D: SegmentNode3D[];
    section: SectionProfile;
    selectedIdx: number | null;
    onSelect: (idx: number) => void;
    onContextMenu?: (idx: number, e: React.MouseEvent) => void;
    jointBands?: boolean;
    jointBandWidth?: number;
}

function Scene({ nodes3D, section, selectedIdx, onSelect, onContextMenu, jointBands, jointBandWidth }: SceneProps) {
    const center = useMemo(() => {
        if (nodes3D.length === 0) return new THREE.Vector3();
        const c = new THREE.Vector3();
        for (const n of nodes3D) { c.add(v3(n.start)); c.add(v3(n.end)); }
        c.divideScalar(nodes3D.length * 2);
        return c;
    }, [nodes3D]);

    const cameraDistance = useMemo(() => {
        if (nodes3D.length === 0) return 2;
        let maxDist = 0;
        for (const n of nodes3D) {
            maxDist = Math.max(maxDist, v3(n.start).distanceTo(center), v3(n.end).distanceTo(center));
        }
        return Math.max(maxDist * 2.5, 0.5);
    }, [nodes3D, center]);

    return (
        <>
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
            <directionalLight position={[-3, 4, -3]} intensity={0.3} />

            <OrbitControls
                target={center}
                enableDamping dampingFactor={0.15}
                maxDistance={cameraDistance * 3} minDistance={0.1}
                mouseButtons={{
                    LEFT: THREE.MOUSE.PAN,
                    MIDDLE: THREE.MOUSE.ROTATE,
                    RIGHT: undefined as unknown as THREE.MOUSE,
                }}
            />

            <Grid
                infiniteGrid
                cellSize={0.1} cellThickness={0.5} cellColor="#444"
                sectionSize={1} sectionThickness={1} sectionColor="#666"
                fadeDistance={cameraDistance * 4} fadeStrength={1.5}
                position={[center.x, -0.01, center.z]}
            />

            {nodes3D.map((node) => {
                const props: SegmentMeshProps = {
                    node, section,
                    selected: selectedIdx === node.index,
                    onClick: () => onSelect(node.index),
                    onContextMenu: onContextMenu ? (e: React.MouseEvent) => onContextMenu(node.index, e) : undefined,
                    jointBands, jointBandWidth,
                };
                switch (node.segment.type) {
                    case 'straight':
                        return <StraightMesh key={node.segment.id} {...props} />;
                    case 'elbow90':
                        return <ElbowMesh key={node.segment.id} {...props} />;
                    case 'obstacle':
                        // Muro = solo indicatore bordi overlay (non consuma lunghezza)
                        return <WallIndicator key={node.segment.id} node={node} />;
                    case 'pendino':
                        return <PendinoMesh key={node.segment.id} {...props} />;
                    default:
                        return null;
                }
            })}

            {nodes3D.map((node) => (
                <SegmentLabel key={`lbl-${node.segment.id}`} node={node} />
            ))}
        </>
    );
}

// ==================== COMPONENTE PRINCIPALE ====================

interface ThreeViewProps {
    nodes3D: SegmentNode3D[];
    section: SectionProfile;
    selectedIdx: number | null;
    onSelect: (idx: number) => void;
    onContextMenu?: (idx: number, e: React.MouseEvent) => void;
    jointBands?: boolean;
    jointBandWidth?: number;
}

export function ThreeView({ nodes3D, section, selectedIdx, onSelect, onContextMenu, jointBands, jointBandWidth }: ThreeViewProps) {
    const cameraPos = useMemo(() => {
        if (nodes3D.length === 0) return [1, 1, 1] as [number, number, number];
        const c = new THREE.Vector3();
        for (const n of nodes3D) { c.add(v3(n.start)); c.add(v3(n.end)); }
        c.divideScalar(nodes3D.length * 2 || 1);
        let maxDist = 0;
        for (const n of nodes3D) {
            maxDist = Math.max(maxDist, v3(n.start).distanceTo(c), v3(n.end).distanceTo(c));
        }
        const dist = Math.max(maxDist * 2.5, 0.5);
        return [c.x + dist * 0.6, c.y + dist * 0.5, c.z + dist * 0.6] as [number, number, number];
    }, [nodes3D]);

    return (
        <div className="w-full h-full bg-black/90 rounded-lg overflow-hidden">
            <Canvas
                camera={{ position: cameraPos, fov: 50, near: 0.01, far: 100 }}
                gl={{ antialias: true, alpha: false }}
                style={{ width: '100%', height: '100%' }}
                onPointerMissed={() => onSelect(-1)}
            >
                <color attach="background" args={['#111111']} />
                <Scene
                    nodes3D={nodes3D} section={section}
                    selectedIdx={selectedIdx} onSelect={onSelect}
                    onContextMenu={onContextMenu}
                    jointBands={jointBands} jointBandWidth={jointBandWidth}
                />
            </Canvas>
        </div>
    );
}
