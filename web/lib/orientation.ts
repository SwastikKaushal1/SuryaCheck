/**
 * Turns phone motion-sensor readings into where the BACK CAMERA is pointing:
 * a compass bearing (0 = north, clockwise) and a height angle above the horizon.
 *
 * Browsers report the phone's orientation as three angles (W3C DeviceOrientation):
 * alpha (turn around the screen's axis), beta (tilt front-back), gamma (tilt left-right).
 * The camera looks out of the back of the phone, i.e. along the device's -Z axis, so we
 * rotate that axis into the earth frame (x east, y north, z up) and read off its direction.
 */

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export interface Aim {
  /** Compass bearing the camera faces, degrees clockwise from north (0-360). */
  bearing: number
  /** Degrees above the horizon (negative = pointing down). */
  elevation: number
}

/** Where the back camera points, from alpha/beta/gamma measured against true or magnetic north. */
export function aimFromOrientation(alpha: number, beta: number, gamma: number): Aim {
  const cA = Math.cos(rad(alpha)), sA = Math.sin(rad(alpha))
  const cB = Math.cos(rad(beta)), sB = Math.sin(rad(beta))
  const cG = Math.cos(rad(gamma)), sG = Math.sin(rad(gamma))
  // Third column of R = Rz(alpha) * Rx(beta) * Ry(gamma) is the device Z axis in earth coordinates; the camera is -Z.
  const east = -(cA * sG + sA * sB * cG)
  const north = -(sA * sG - cA * sB * cG)
  const up = -(cB * cG)
  return {
    bearing: (deg(Math.atan2(east, north)) + 360) % 360,
    elevation: deg(Math.asin(Math.max(-1, Math.min(1, up)))),
  }
}

/** Height angle only (works even without a compass): phone upright = 0°, tilted back = above the horizon. */
export const elevationFromTilt = (beta: number, gamma: number) => aimFromOrientation(0, beta, gamma).elevation

/** Averages compass bearings correctly across north (359° and 1° average to 0°, not 180°). */
export function averageBearing(bearings: number[]): number {
  let x = 0
  let y = 0
  for (const b of bearings) {
    x += Math.sin(rad(b))
    y += Math.cos(rad(b))
  }
  return (deg(Math.atan2(x, y)) + 360) % 360
}

/** Smallest angle between two bearings, 0-180. */
export const bearingGap = (a: number, b: number) => {
  const d = Math.abs((((a - b) % 360) + 360) % 360)
  return d > 180 ? 360 - d : d
}
