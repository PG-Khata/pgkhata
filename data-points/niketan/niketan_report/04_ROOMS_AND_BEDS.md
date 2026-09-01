# Rooms and Beds Data

## Floors
- **Total Floors:** 0 (none created yet)

## Rooms
- **Total Rooms:** 0 (none created yet)

## Beds
- **Total Beds:** 0 (none created yet)
- **Vacant Beds:** 0
- **Occupied Beds:** 0
- **Maintenance Beds:** 0

---

## Property Structure

A binary structure export file is available (Excel/ZIP format) at:
- GET /properties/{id}/structure/export
- POST /properties/{id}/structure/import

The export contains the full floor/room/bed hierarchy when populated.

---

## Room & Bed Management Features

### Floors

| Operation | Endpoint |
|-----------|----------|
| List floors | GET /properties/{id}/floors |
| Create floor | POST /properties/{id}/floors |
| Update floor | PUT /properties/{id}/floors/{floorId} |
| Delete floor | DELETE /properties/{id}/floors/{floorId} |

### Rooms

| Operation | Endpoint |
|-----------|----------|
| List all rooms | GET /properties/{id}/rooms |
| List rooms by floor | GET /properties/{id}/rooms/by-floor/{floorId} |
| Get single room | GET /properties/{id}/rooms/{roomId} |
| Create room | POST /properties/{id}/rooms |
| Update room | PUT /properties/{id}/rooms/{roomId} |
| Delete room | DELETE /properties/{id}/rooms/{roomId} |
| Get beds in room | GET /properties/{id}/rooms/{roomId}/beds |

### Beds

| Operation | Endpoint |
|-----------|----------|
| List vacant beds | GET /properties/{id}/beds/vacant |
| Get single bed | GET /properties/{id}/beds/{bedId} |
| Update bed | PUT /properties/{id}/beds/{bedId} |
| Delete bed | DELETE /properties/{id}/beds/{bedId} |
| Update bed status | PATCH /properties/{id}/beds/{bedId}/status |

---

## Bed Bookings

| Operation | Endpoint |
|-----------|----------|
| List bookings | GET /properties/{id}/bed-bookings |
| Create booking | POST /properties/{id}/bed-bookings |
| Cancel booking | POST /properties/{id}/bed-bookings/cancel |
| Convert to check-in | POST /properties/{id}/bed-bookings/convert-to-checkin |

**Current Bookings:** 0

---

## Amenities

### Global Amenities Available in Platform

| ID | Amenity |
|----|---------|
| 1 | WiFi |
| 2 | AC |
| 3 | Laundry |
| 4 | Power Backup |
| 5 | Meals |
| 6 | Parking |
| 7 | Gym |

### Property-Specific Amenities
None assigned to this property yet.

| Operation | Endpoint |
|-----------|----------|
| List property amenities | GET /properties/{id}/amenities |
| Add amenity | POST /properties/{id}/amenities |
| Update amenity | PUT /properties/{id}/amenities/{amenityId} |
| Remove amenity | DELETE /properties/{id}/amenities/{amenityId} |
