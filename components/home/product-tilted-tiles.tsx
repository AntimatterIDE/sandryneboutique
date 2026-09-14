"use client";

import TiltedTiles, {
  type TiltedTile,
} from "@/components/react-bits/tilted-tiles";

export function ProductTiltedTiles({ tiles }: { tiles: TiltedTile[] }) {
  if (tiles.length === 0) return null;

  return (
    <section
      className="relative h-[min(92vh,880px)] overflow-hidden bg-background"
      aria-label="Shop the collection"
    >
      <TiltedTiles
        tiles={tiles}
        columns={10}
        tilesPerColumn={4}
        planeWidth={320}
        rotateX={32}
        rotateY={12}
        rotateZ={-16}
        duration={25}
        fadeTop={22}
        parallax={false}
        height="100%"
        width="100%"
      />
    </section>
  );
}
