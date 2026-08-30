import type { Floor, FloorWithRoomCount, Room } from "@/types"

export interface FloorGroup {
  /** null for rooms that belong to no floor. */
  floor: Floor | null
  label: string
  rooms: Room[]
  bedCount: number
  occupiedCount: number
}

/**
 * Groups rooms under their floor in display order, then appends an
 * "Unassigned" group.
 *
 * Every floor appears even with no rooms — an owner who has just added
 * "Second floor" needs to see it in order to add rooms to it. The unassigned
 * group is omitted when empty, since a property that models floors properly
 * should not carry a permanent empty bucket.
 */
export function groupRoomsByFloor(
  floors: FloorWithRoomCount[],
  rooms: Room[],
): FloorGroup[] {
  const byFloor = new Map<string, Room[]>()
  const unassigned: Room[] = []

  for (const room of rooms) {
    if (room.floorId) {
      const bucket = byFloor.get(room.floorId)
      if (bucket) {
        bucket.push(room)
      } else {
        byFloor.set(room.floorId, [room])
      }
    } else {
      unassigned.push(room)
    }
  }

  const ordered = [...floors].sort(
    (a, b) =>
      a.floor.position - b.floor.position || a.floor.name.localeCompare(b.floor.name),
  )

  const groups: FloorGroup[] = ordered.map((entry) => {
    const floorRooms = sortRooms(byFloor.get(entry.floor.id) ?? [])
    return {
      floor: entry.floor,
      label: entry.floor.name,
      rooms: floorRooms,
      bedCount: countBeds(floorRooms),
      occupiedCount: countOccupied(floorRooms),
    }
  })

  if (unassigned.length > 0) {
    const rest = sortRooms(unassigned)
    groups.push({
      floor: null,
      label: "Unassigned",
      rooms: rest,
      bedCount: countBeds(rest),
      occupiedCount: countOccupied(rest),
    })
  }

  return groups
}

/** Numeric-aware so 101 sorts before 1001, and "2A" after "2". */
function sortRooms(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) =>
    a.number.localeCompare(b.number, undefined, { numeric: true }),
  )
}

/**
 * Counts real bed rows, falling back to capacity only for a room whose beds
 * have not loaded yet — so the figure never silently reads zero mid-fetch.
 */
function countBeds(rooms: Room[]): number {
  return rooms.reduce(
    (total, room) => total + (room.beds ? room.beds.length : room.capacity),
    0,
  )
}

function countOccupied(rooms: Room[]): number {
  return rooms.reduce(
    (total, room) =>
      total + (room.beds?.filter((bed) => bed.status === "occupied").length ?? 0),
    0,
  )
}

export interface StructureTotals {
  floors: number
  rooms: number
  beds: number
  occupied: number
  occupancyRate: number
}

export function structureTotals(groups: FloorGroup[]): StructureTotals {
  const beds = groups.reduce((total, group) => total + group.bedCount, 0)
  const occupied = groups.reduce((total, group) => total + group.occupiedCount, 0)

  return {
    floors: groups.filter((group) => group.floor !== null).length,
    rooms: groups.reduce((total, group) => total + group.rooms.length, 0),
    beds,
    occupied,
    occupancyRate: beds > 0 ? Math.round((occupied / beds) * 100) : 0,
  }
}
