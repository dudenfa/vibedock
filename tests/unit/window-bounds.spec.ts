import { describe, expect, it } from "vitest";
import { resolveWindowBounds } from "../../src/main/window-bounds";

describe("resolveWindowBounds", () => {
  it("recovers a saved window that is fully offscreen", () => {
    const result = resolveWindowBounds({
      savedBounds: {
        width: 507,
        height: 906,
        x: 2305,
        y: 53
      },
      primaryWorkArea: {
        x: 0,
        y: 0,
        width: 1512,
        height: 982
      },
      workAreas: [
        {
          x: 0,
          y: 0,
          width: 1512,
          height: 982
        }
      ],
      minWidth: 360,
      minHeight: 420,
      edgePadding: 48
    });

    expect(result.recoveredFromOffscreen).toBe(true);
    expect(result.bounds.x).toBeGreaterThanOrEqual(0);
    expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(1512);
  });

  it("keeps a window on the display that holds the majority of its area", () => {
    const result = resolveWindowBounds({
      savedBounds: {
        width: 400,
        height: 500,
        x: 1500,
        y: 200
      },
      primaryWorkArea: {
        x: 0,
        y: 0,
        width: 1512,
        height: 982
      },
      workAreas: [
        {
          x: 0,
          y: 0,
          width: 1512,
          height: 982
        },
        {
          x: 1512,
          y: 0,
          width: 1512,
          height: 982
        }
      ],
      minWidth: 360,
      minHeight: 420,
      edgePadding: 48
    });

    expect(result.bounds.x).toBeGreaterThanOrEqual(1512);
    expect(result.bounds.x + result.bounds.width).toBeLessThanOrEqual(3024);
    expect(result.bounds.y).toBe(200);
  });

  it("keeps a visible window on its current display", () => {
    const result = resolveWindowBounds({
      savedBounds: {
        width: 507,
        height: 906,
        x: 700,
        y: 40
      },
      primaryWorkArea: {
        x: 0,
        y: 0,
        width: 1512,
        height: 982
      },
      workAreas: [
        {
          x: 0,
          y: 0,
          width: 1512,
          height: 982
        },
        {
          x: 1512,
          y: 0,
          width: 1512,
          height: 982
        }
      ],
      minWidth: 360,
      minHeight: 420,
      edgePadding: 48
    });

    expect(result.recoveredFromOffscreen).toBe(false);
    expect(result.bounds.x).toBe(700);
    expect(result.bounds.y).toBe(40);
  });
});
