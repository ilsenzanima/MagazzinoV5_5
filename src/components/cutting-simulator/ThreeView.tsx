"use client";

/**
 * Vista 3D reale del progetto canala usando Three.js / React Three Fiber.
 * Riceve i nodi 3D calcolati da computeLayout() e li renderizza come geometria WebGL.
 */

import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Grid, Text, Line, Environment } from "@react-three/drei";
import * as THREE from "three";
import type { SegmentNode3D, Vec3 } from "@/lib/cutting-simulator/project-layout";
import type { StraightSegment, Elbow90Segment, ContextualElementSegment, PendinoSegment, SectionProfile } from "@/lib/cutting-simulator/project-model";

// ==================== COSTANTI ====================

// Colore calciosilicato (grigio chiaro beige)
const DUCT_COLOR = "#d4c8a8";
const DUCT_COLOR_SELECTED = "#f59e0b";
const WALL_COLOR = "#8b8680";
const FLOOR_COLOR = "#6b7280";
const PENDINO_COLOR = "#71717a";
const JOINT_COLOR = "#ef4444";
const ELBOW_COLOR = "#e8a838";

// Scala: 1 unità Three.js = 1mm, ma dividiamo per 1000 per lavorare in metri
const SCALE = 0.001;

// ==================== HELPERS ====================

function v3(p: Vec3): THREE.Vector3 {
    return new THREE.Vector3(p.x * SCALE, p.z * SCALE, -p.y * SCALE);
}

function midPoint(a: Vec3, b: Vec3): Vec3 {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

// ==================== COMPONENTI SEGMENTO ====================

interface SegmentMeshProps {
    node: SegmentNode3D;
    section: SectionProfile;
    selected: boolean;
    onClick: () => void;
    jointBands?: boolean;
    jointBandWidth?: number;
}

/** Tratto dritto — box cavo (calciosilicato) */
function StraightMesh({ node, section, selected, onClick, jointBands, jointBandWidth }: SegmentMeshProps) {
    const seg = node.segment as StraightSegment;
    const meshRef = useRef<THREE.Mesh>(null);

    const { position, rotation, length } = useMemo(() => {
        const mid = midPoint(node.start, node.end);
        const pos = v3(mid);

        // Calcola la rotazione in base alla direzione
        const rot = new THREE.Euler();
        switch (node.direction) {
            case '+x': rot.set(0, 0, 0); break;
            case '-x': rot.set(0, Math.PI, 0); break;
            case '+y': rot.set(0, -Math.PI / 2, 0); break;
            case '-y': rot.set(0, Math.PI / 2, 0); break;
            case '+z': rot.set(0, 0, Math.PI / 2); break;
            case '-z': rot.set(0, 0, -Math.PI / 2); break;
        }

        return { position: pos, rotation: rot, length: seg.length * SCALE };
    }, [node, seg.length]);

    const outerW = node.outerW * SCALE;
    const outerH = node.outerH * SCALE;
    const t = section.thickness * SCALE;
    const color = selected ? DUCT_COLOR_SELECTED : DUCT_COLOR;

    // Crea una forma cava (sezione a U/rettangolo con spessore)
    const shape = useMemo(() => {
        const s = new THREE.Shape();
        const hw = outerW / 2;
        const hh = outerH / 2;
        // Rettangolo esterno
        s.moveTo(-hw, -hh);
        s.lineTo(hw, -hh);
        s.lineTo(hw, hh);
        s.lineTo(-hw, hh);
        s.closePath();

        // Foro interno
        const hole = new THREE.Path();
        hole.moveTo(-hw + t, -hh + t);
        hole.lineTo(hw - t, -hh + t);
        hole.lineTo(hw - t, hh - t);
        hole.lineTo(-hw + t, hh - t);
        hole.closePath();
        s.holes.push(hole);

        return s;
    }, [outerW, outerH, t]);

    const geometry = useMemo(() => {
        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
            steps: 1,
            depth: length,
            bevelEnabled: false,
        };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        // Centrato: sposta l'estruso di mezzo la lunghezza all'indietro
        geo.translate(0, 0, -length / 2);
        return geo;
    }, [shape, length]);

    return (
        <group position={position} rotation={rotation}>
            <mesh
                ref={meshRef}
                geometry={geometry}
                onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
                <meshStandardMaterial
                    color={color}
                    transparent
                    opacity={selected ? 0.85 : 0.7}
                    side={THREE.DoubleSide}
                    roughness={0.8}
                    metalness={0.05}
                />
            </mesh>
            {/* Bordi wireframe */}
            <mesh geometry={geometry}>
                <meshBasicMaterial
                    color={selected ? "#f59e0b" : "#999"}
                    wireframe
                    transparent
                    opacity={0.25}
                />
            </mesh>
            {/* Fascia giunto all'inizio */}
            {jointBands && (
                <mesh position={[0, 0, -length / 2]}>
                    <boxGeometry args={[outerW + 0.002, outerH + 0.002, (jointBandWidth || 100) * SCALE]} />
                    <meshStandardMaterial color={JOINT_COLOR} transparent opacity={0.4} />
                </mesh>
            )}
        </group>
    );
}

/** Curva 90° — due bracci */
function ElbowMesh({ node, section, selected, onClick }: SegmentMeshProps) {
    const seg = node.segment as Elbow90Segment;
    const color = selected ? DUCT_COLOR_SELECTED : ELBOW_COLOR;
    const outerW = node.outerW * SCALE;
    const outerH = node.outerH * SCALE;
    const t = section.thickness * SCALE;

    // Braccio A (ingresso → corner)
    const armAStart = v3(node.start);
    const armAEnd = v3(node.corner || node.end);
    // Braccio B (corner → uscita)
    const armBStart = v3(node.corner || node.start);
    const armBEnd = v3(node.end);

    return (
        <group onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {/* Braccio A */}
            <BoxBetween
                start={armAStart} end={armAEnd}
                width={outerW} height={outerH} thickness={t}
                color={color} selected={selected}
            />
            {/* Braccio B */}
            <BoxBetween
                start={armBStart} end={armBEnd}
                width={outerW} height={outerH} thickness={t}
                color={color} selected={selected}
            />
            {/* Blocco d'angolo */}
            {node.corner && (
                <mesh position={v3(node.corner)}>
                    <boxGeometry args={[outerW, outerH, outerW]} />
                    <meshStandardMaterial color={color} transparent opacity={selected ? 0.8 : 0.6} />
                </mesh>
            )}
        </group>
    );
}

/** Helper: box orientato tra due punti */
function BoxBetween({ start, end, width, height, thickness, color, selected }: {
    start: THREE.Vector3; end: THREE.Vector3;
    width: number; height: number; thickness: number;
    color: string; selected: boolean;
}) {
    const { position, rotation, length } = useMemo(() => {
        const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        const quat = new THREE.Quaternion();
        if (len > 0.0001) {
            quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize());
        }
        const euler = new THREE.Euler().setFromQuaternion(quat);
        return { position: mid, rotation: euler, length: len };
    }, [start, end]);

    if (length < 0.0001) return null;

    return (
        <group position={position} rotation={rotation}>
            <mesh>
                <boxGeometry args={[width, height, length]} />
                <meshStandardMaterial
                    color={color} transparent opacity={selected ? 0.8 : 0.6}
                    roughness={0.7}
                />
            </mesh>
        </group>
    );
}

/** Muro / Solaio — blocco attraversato dalla canala */
function ObstacleMesh({ node, section, selected, onClick }: SegmentMeshProps) {
    const seg = node.segment as ContextualElementSegment;
    const mid = v3(midPoint(node.start, node.end));
    const isWall = seg.obstacleType === 'wall';
    const color = selected ? DUCT_COLOR_SELECTED : (isWall ? WALL_COLOR : FLOOR_COLOR);

    // Il muro è più largo e alto della canala
    const w = seg.width * SCALE;
    const h = seg.height * SCALE;
    const depth = seg.thickness * SCALE;

    // Orientazione basata sulla direzione del percorso
    const rotation = useMemo(() => {
        const rot = new THREE.Euler();
        switch (node.direction) {
            case '+x': case '-x': /* parete perpendicolare a X */ break;
            case '+y': case '-y': rot.set(0, Math.PI / 2, 0); break;
            case '+z': case '-z': rot.set(Math.PI / 2, 0, 0); break;
        }
        return rot;
    }, [node.direction]);

    return (
        <group position={mid} rotation={rotation} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <mesh>
                <boxGeometry args={[w, h, depth]} />
                <meshStandardMaterial
                    color={color}
                    transparent
                    opacity={selected ? 0.6 : 0.35}
                    roughness={0.9}
                />
            </mesh>
            {/* Bordi */}
            <mesh>
                <boxGeometry args={[w, h, depth]} />
                <meshBasicMaterial color={color} wireframe transparent opacity={0.4} />
            </mesh>
        </group>
    );
}

/** Pendino — barra verticale dal soffitto */
function PendinoMesh({ node, selected, onClick }: SegmentMeshProps) {
    const mid = v3(midPoint(node.start, node.end));
    const pendHeight = 0.6; // 600mm = barra lunga
    const color = selected ? DUCT_COLOR_SELECTED : PENDINO_COLOR;

    return (
        <group position={mid} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            {/* Barra verticale */}
            <mesh position={[0, pendHeight / 2 + node.outerH * SCALE / 2, 0]}>
                <cylinderGeometry args={[0.005, 0.005, pendHeight, 8]} />
                <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Piastra di fissaggio superiore */}
            <mesh position={[0, pendHeight + node.outerH * SCALE / 2, 0]}>
                <boxGeometry args={[0.04, 0.003, 0.04]} />
                <meshStandardMaterial color={color} metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Staffa sulla canala */}
            <mesh position={[0, node.outerH * SCALE / 2, 0]}>
                <boxGeometry args={[node.outerW * SCALE + 0.01, 0.004, 0.03]} />
                <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
            </mesh>
        </group>
    );
}

// ==================== LABELS ====================

function SegmentLabel({ node }: { node: SegmentNode3D }) {
    const seg = node.segment;
    const mid = v3(midPoint(node.start, node.end));
    let text = '';

    if (seg.type === 'straight') {
        text = `${(seg as StraightSegment).length}mm`;
    } else if (seg.type === 'elbow90') {
        text = `90° ${(seg as Elbow90Segment).direction}`;
    } else if (seg.type === 'obstacle') {
        const obs = seg as ContextualElementSegment;
        text = `${obs.obstacleType === 'wall' ? 'Muro' : 'Solaio'} ${obs.thickness}mm`;
    } else if (seg.type === 'pendino') {
        text = 'Pendino';
    }

    if (!text) return null;

    return (
        <Text
            position={[mid.x, mid.y + node.outerH * SCALE / 2 + 0.04, mid.z]}
            fontSize={0.025}
            color="white"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.002}
            outlineColor="black"
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
    jointBands?: boolean;
    jointBandWidth?: number;
}

function Scene({ nodes3D, section, selectedIdx, onSelect, jointBands, jointBandWidth }: SceneProps) {
    // Calcola il centro della scena per OrbitControls
    const center = useMemo(() => {
        if (nodes3D.length === 0) return new THREE.Vector3(0, 0, 0);
        let cx = 0, cy = 0, cz = 0;
        for (const n of nodes3D) {
            const m = midPoint(n.start, n.end);
            cx += m.x; cy += m.y; cz += m.z;
        }
        const count = nodes3D.length;
        return v3({ x: cx / count, y: cy / count, z: cz / count });
    }, [nodes3D]);

    // Calcola la distanza della camera
    const cameraDistance = useMemo(() => {
        if (nodes3D.length === 0) return 2;
        let maxDist = 0;
        for (const n of nodes3D) {
            const s = v3(n.start);
            const e = v3(n.end);
            maxDist = Math.max(maxDist, s.distanceTo(center), e.distanceTo(center));
        }
        return Math.max(maxDist * 2.5, 0.5);
    }, [nodes3D, center]);

    return (
        <>
            {/* Luci */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={0.8} castShadow />
            <directionalLight position={[-3, 4, -3]} intensity={0.3} />

            {/* Controlli camera */}
            <OrbitControls
                target={center}
                enableDamping
                dampingFactor={0.15}
                maxDistance={cameraDistance * 3}
                minDistance={0.1}
            />

            {/* Griglia a pavimento */}
            <Grid
                infiniteGrid
                cellSize={0.1}
                cellThickness={0.5}
                cellColor="#444"
                sectionSize={1}
                sectionThickness={1}
                sectionColor="#666"
                fadeDistance={cameraDistance * 4}
                fadeStrength={1.5}
                position={[center.x, -0.01, center.z]}
            />

            {/* Segmenti */}
            {nodes3D.map((node, i) => {
                const commonProps: SegmentMeshProps = {
                    node,
                    section,
                    selected: selectedIdx === node.index,
                    onClick: () => onSelect(node.index),
                    jointBands,
                    jointBandWidth,
                };

                switch (node.segment.type) {
                    case 'straight':
                        return <StraightMesh key={node.segment.id} {...commonProps} />;
                    case 'elbow90':
                        return <ElbowMesh key={node.segment.id} {...commonProps} />;
                    case 'obstacle':
                        return <ObstacleMesh key={node.segment.id} {...commonProps} />;
                    case 'pendino':
                        return <PendinoMesh key={node.segment.id} {...commonProps} />;
                    default:
                        return null;
                }
            })}

            {/* Etichette */}
            {nodes3D.map((node) => (
                <SegmentLabel key={`label-${node.segment.id}`} node={node} />
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
    jointBands?: boolean;
    jointBandWidth?: number;
}

export function ThreeView({ nodes3D, section, selectedIdx, onSelect, jointBands, jointBandWidth }: ThreeViewProps) {
    // Calcola posizione camera iniziale
    const cameraPos = useMemo(() => {
        if (nodes3D.length === 0) return [1, 1, 1] as [number, number, number];
        let maxDist = 0;
        const c = new THREE.Vector3();
        for (const n of nodes3D) {
            const m = midPoint(n.start, n.end);
            const p = v3(m);
            c.add(p);
        }
        c.divideScalar(nodes3D.length || 1);

        for (const n of nodes3D) {
            const s = v3(n.start);
            const e = v3(n.end);
            maxDist = Math.max(maxDist, s.distanceTo(c), e.distanceTo(c));
        }
        const dist = Math.max(maxDist * 2.5, 0.5);
        return [c.x + dist * 0.6, c.y + dist * 0.5, c.z + dist * 0.6] as [number, number, number];
    }, [nodes3D]);

    return (
        <div className="w-full h-full bg-black/90 rounded-lg overflow-hidden">
            <Canvas
                camera={{
                    position: cameraPos,
                    fov: 50,
                    near: 0.01,
                    far: 100,
                }}
                gl={{ antialias: true, alpha: false }}
                style={{ width: '100%', height: '100%' }}
                onPointerMissed={() => onSelect(-1)}
            >
                <color attach="background" args={['#111111']} />
                <Scene
                    nodes3D={nodes3D}
                    section={section}
                    selectedIdx={selectedIdx}
                    onSelect={onSelect}
                    jointBands={jointBands}
                    jointBandWidth={jointBandWidth}
                />
            </Canvas>
        </div>
    );
}
