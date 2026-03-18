"use client";

import React, { useMemo } from "react";
import { ThreeView } from "@/components/cutting-simulator/ThreeView";
import type { SegmentNode3D } from "@/lib/cutting-simulator/project-layout";
import type { SectionProfile } from "@/lib/cutting-simulator/project-model";

interface SinglePiece3DViewProps {
    type: "straight" | "elbow90";
    dimensions: {
        innerWidth: number;
        innerHeight: number;
        thickness: number;
        length?: number; // per dritto
        direction?: "up" | "down" | "left" | "right"; // per curva
    };
}

export function SinglePiece3DView({ type, dimensions }: SinglePiece3DViewProps) {
    const { innerWidth, innerHeight, thickness, length = 1000, direction = "right" } = dimensions;

    const section: SectionProfile = useMemo(() => ({
        innerWidth,
        innerHeight,
        thickness,
        sides: { top: true, bottom: true, left: true, right: true },
        extraMargin: 0,
        cap: 'none'
    }), [innerWidth, innerHeight, thickness]);

    const nodes3D: SegmentNode3D[] = useMemo(() => {
        const outerW = innerWidth + 2 * thickness;
        const outerH = innerHeight + 2 * thickness;

        if (type === "straight") {
            return [{
                index: 0,
                segment: { id: "preview-straight", type: "straight", length },
                start: { x: 0, y: 0, z: 0 },
                end: { x: 0, y: length, z: 0 },
                direction: "+y",
                outerW,
                outerH,
            }];
        } else {
            // Elbow 90
            const corner = { x: 0, y: 200, z: 0 };
            let end = { x: 200, y: 200, z: 0 };
            let dir: any = "+x";

            if (direction === "left") { end = { x: -200, y: 200, z: 0 }; dir = "-x"; }
            else if (direction === "up") { end = { x: 0, y: 200, z: 200 }; dir = "+z"; }
            else if (direction === "down") { end = { x: 0, y: 200, z: -200 }; dir = "-z"; }

            return [{
                index: 0,
                segment: { 
                    id: "preview-elbow", 
                    type: "elbow90", 
                    direction: direction as any,
                    armA: 500,
                    armB: 500,
                    baseMode: 'split'
                },
                start: { x: 0, y: 0, z: 0 },
                end,
                corner,
                direction: dir,
                outerW,
                outerH,
            }];
        }
    }, [type, innerWidth, innerHeight, thickness, length, direction]);

    return (
        <div className="w-full h-full min-h-[200px] rounded-lg overflow-hidden border border-border/50 shadow-inner bg-slate-900">
            <ThreeView 
                nodes3D={nodes3D} 
                section={section} 
                selectedIdx={null} 
                onSelect={() => {}} 
            />
        </div>
    );
}
