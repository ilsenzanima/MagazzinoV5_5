"use client";

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

interface SinglePiece3DViewProps {
    type: "straight" | "elbow90";
    dimensions: {
        innerWidth: number;
        innerHeight: number;
        thickness: number;
        length?: number;
        direction?: "up" | "down" | "left" | "right";
    };
}

/** Converte mm in unità Three.js (1 unit = 100mm) */
const mm = (v: number) => v / 100;

function StraightDuct({ innerWidth, innerHeight, thickness, length }: {
    innerWidth: number; innerHeight: number; thickness: number; length: number;
}) {
    const t = mm(thickness), iW = mm(innerWidth), iH = mm(innerHeight), L = mm(length);
    const oW = iW + 2 * t;

    return (
        <group>
            {/* Base */}
            <mesh position={[0, -(iH / 2 + t / 2), 0]}>
                <boxGeometry args={[oW, t, L]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.35} metalness={0.1} />
            </mesh>
            {/* Coperchio */}
            <mesh position={[0, iH / 2 + t / 2, 0]}>
                <boxGeometry args={[oW, t, L]} />
                <meshStandardMaterial color="#3b82f6" roughness={0.35} metalness={0.1} />
            </mesh>
            {/* Fianco sx */}
            <mesh position={[-(iW / 2 + t / 2), 0, 0]}>
                <boxGeometry args={[t, iH, L]} />
                <meshStandardMaterial color="#60a5fa" roughness={0.35} metalness={0.1} />
            </mesh>
            {/* Fianco dx */}
            <mesh position={[iW / 2 + t / 2, 0, 0]}>
                <boxGeometry args={[t, iH, L]} />
                <meshStandardMaterial color="#60a5fa" roughness={0.35} metalness={0.1} />
            </mesh>
        </group>
    );
}

function ElbowDuct({ innerWidth, innerHeight, thickness }: {
    innerWidth: number; innerHeight: number; thickness: number;
}) {
    const t = mm(thickness), iW = mm(innerWidth), iH = mm(innerHeight);
    const arm = mm(500);
    const oW = iW + 2 * t;

    return (
        <group>
            {/* Braccio A: lungo -Z */}
            <group position={[0, 0, -arm / 2]}>
                <mesh position={[0, -(iH / 2 + t / 2), 0]}>
                    <boxGeometry args={[oW, t, arm]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.35} />
                </mesh>
                <mesh position={[0, iH / 2 + t / 2, 0]}>
                    <boxGeometry args={[oW, t, arm]} />
                    <meshStandardMaterial color="#3b82f6" roughness={0.35} />
                </mesh>
                <mesh position={[-(iW / 2 + t / 2), 0, 0]}>
                    <boxGeometry args={[t, iH, arm]} />
                    <meshStandardMaterial color="#60a5fa" roughness={0.35} />
                </mesh>
                <mesh position={[iW / 2 + t / 2, 0, 0]}>
                    <boxGeometry args={[t, iH, arm]} />
                    <meshStandardMaterial color="#60a5fa" roughness={0.35} />
                </mesh>
            </group>
            {/* Braccio B: lungo +X, staccato dall'angolo */}
            <group position={[arm / 2, 0, -(arm + oW / 2)]}>
                <mesh position={[0, -(iH / 2 + t / 2), 0]}>
                    <boxGeometry args={[arm, t, oW]} />
                    <meshStandardMaterial color="#2563eb" roughness={0.35} />
                </mesh>
                <mesh position={[0, iH / 2 + t / 2, 0]}>
                    <boxGeometry args={[arm, t, oW]} />
                    <meshStandardMaterial color="#2563eb" roughness={0.35} />
                </mesh>
                <mesh position={[0, 0, iW / 2 + t / 2]}>
                    <boxGeometry args={[arm, iH, t]} />
                    <meshStandardMaterial color="#93c5fd" roughness={0.35} />
                </mesh>
                <mesh position={[0, 0, -(iW / 2 + t / 2)]}>
                    <boxGeometry args={[arm, iH, t]} />
                    <meshStandardMaterial color="#93c5fd" roughness={0.35} />
                </mesh>
            </group>
        </group>
    );
}

export function SinglePiece3DView({ type, dimensions }: SinglePiece3DViewProps) {
    const { innerWidth = 200, innerHeight = 200, thickness = 50, length = 1000 } = dimensions;
    const camD = mm(Math.max(innerWidth + 2 * thickness, length, 400)) * 2.5;

    return (
        <Canvas camera={{ position: [camD, camD * 0.7, camD], fov: 40 }} shadows>
            <color attach="background" args={["#09090b"]} />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
            <directionalLight position={[-4, -2, -4]} intensity={0.25} />
            {type === "straight" ? (
                <StraightDuct innerWidth={innerWidth} innerHeight={innerHeight} thickness={thickness} length={length} />
            ) : (
                <ElbowDuct innerWidth={innerWidth} innerHeight={innerHeight} thickness={thickness} />
            )}
            <OrbitControls autoRotate autoRotateSpeed={1.2} enablePan={false} />
        </Canvas>
    );
}
