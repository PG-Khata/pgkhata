import { describe, expect, it } from "vitest"
import { groupRoomsByFloor, structureTotals } from "./structure"
import type { FloorWithRoomCount, Room } from "@/types"

function makeFloor(id: string, name: string, position: number): FloorWithRoomCount {
  return {
    floor: {
      id,
      propertyId: "p1",
      name,
      position,
      createdAt: "",
      updatedAt: "",
    },
    roomCount: 0,
  }
}

function makeRoom(number: string, floorId: string | null, capacity = 1): Room {
  return {
    id: `room-${number}`,
    propertyId: "p1",
    floorId,
    number,
    type: "single",
    capacity,
    monthlyRent: 5000,
    createdAt: "",
    updatedAt: "",
  }
}

describe("groupRoomsByFloor", () => {
  it("groups rooms under their floor in position order", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f2", "First floor", 1), makeFloor("f1", "Ground floor", 0)],
      [makeRoom("201", "f2"), makeRoom("101", "f1")],
    )

    expect(groups.map((g) => g.label)).toEqual(["Ground floor", "First floor"])
    expect(groups[0]!.rooms.map((r) => r.number)).toEqual(["101"])
    expect(groups[1]!.rooms.map((r) => r.number)).toEqual(["201"])
  })

  it("keeps an empty floor visible so rooms can be added to it", () => {
    const groups = groupRoomsByFloor([makeFloor("f1", "Second floor", 2)], [])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.rooms).toEqual([])
  })

  it("puts rooms with no floor in an Unassigned group at the end", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Ground floor", 0)],
      [makeRoom("101", "f1"), makeRoom("900", null)],
    )

    expect(groups.map((g) => g.label)).toEqual(["Ground floor", "Unassigned"])
    expect(groups[1]!.floor).toBeNull()
  })

  it("omits the Unassigned group when every room has a floor", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Ground floor", 0)],
      [makeRoom("101", "f1")],
    )

    expect(groups.map((g) => g.label)).toEqual(["Ground floor"])
  })

  it("handles a property with no floors at all", () => {
    const groups = groupRoomsByFloor([], [makeRoom("101", null), makeRoom("102", null)])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.label).toBe("Unassigned")
    expect(groups[0]!.rooms).toHaveLength(2)
  })

  it("sorts room numbers numerically, not lexically", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Ground floor", 0)],
      [makeRoom("1001", "f1"), makeRoom("101", "f1"), makeRoom("2", "f1")],
    )

    // A plain string sort would give 1001, 101, 2.
    expect(groups[0]!.rooms.map((r) => r.number)).toEqual(["2", "101", "1001"])
  })

  it("breaks position ties by name", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Bravo", 0), makeFloor("f2", "Alpha", 0)],
      [],
    )

    expect(groups.map((g) => g.label)).toEqual(["Alpha", "Bravo"])
  })

  it("counts beds from room capacity", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Ground floor", 0)],
      [makeRoom("101", "f1", 3), makeRoom("102", "f1", 2)],
    )

    expect(groups[0]!.bedCount).toBe(5)
  })

  it("ignores a room pointing at a floor that is not in the list", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Ground floor", 0)],
      [makeRoom("101", "f1"), makeRoom("501", "deleted-floor")],
    )

    // Not silently promoted to Unassigned: it has a floor, just not a visible
    // one, so showing it under "Unassigned" would misreport the structure.
    expect(groups.map((g) => g.label)).toEqual(["Ground floor"])
    expect(groups[0]!.rooms.map((r) => r.number)).toEqual(["101"])
  })
})

describe("structureTotals", () => {
  it("counts floors, rooms and beds, excluding Unassigned from the floor count", () => {
    const groups = groupRoomsByFloor(
      [makeFloor("f1", "Ground floor", 0), makeFloor("f2", "First floor", 1)],
      [makeRoom("101", "f1", 3), makeRoom("201", "f2", 2), makeRoom("900", null, 1)],
    )

    expect(structureTotals(groups)).toEqual({ floors: 2, rooms: 3, beds: 6 })
  })

  it("reports zeroes for an empty property", () => {
    expect(structureTotals(groupRoomsByFloor([], []))).toEqual({
      floors: 0,
      rooms: 0,
      beds: 0,
    })
  })
})
