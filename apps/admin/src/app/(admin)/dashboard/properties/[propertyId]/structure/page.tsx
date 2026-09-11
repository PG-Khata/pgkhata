"use client";

import { use, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bed, Users, Layers, DoorOpen, Edit2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Floor {
  id: string;
  name: string;
  position: number;
  description: string | null;
}

interface Room {
  id: string;
  number: string;
  floorId: string | null;
  type: string;
  capacity: number;
  monthlyRent: number;
}

interface Bed {
  id: string;
  roomId: string;
  number: string;
  status: "vacant" | "occupied" | "maintenance";
  monthlyRent: number | null;
  roomNumber: string;
}

interface StructureData {
  propertyId: string;
  propertyName: string;
  floors: Floor[];
  rooms: Room[];
  beds: Bed[];
}

export default function StructurePage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = use(params);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "structure", propertyId],
    queryFn: () => api.get<StructureData>(`/v1/admin/properties/${propertyId}/structure`),
    enabled: !!propertyId,
  });

  const updateBed = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api.patch(`/v1/admin/beds/${bedId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "structure", propertyId] });
      toast.success("Bed updated");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link href={`/dashboard/properties/${propertyId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to Property
        </Link>
        <p className="text-sm text-muted-foreground">Property not found.</p>
      </div>
    );
  }

  const vacantBeds = data.beds.filter((b) => b.status === "vacant").length;
  const occupiedBeds = data.beds.filter((b) => b.status === "occupied").length;
  const maintenanceBeds = data.beds.filter((b) => b.status === "maintenance").length;

  function handleBedStatusChange(bedId: string, currentStatus: string) {
    const nextStatus =
      currentStatus === "vacant" ? "occupied" : currentStatus === "occupied" ? "vacant" : "vacant";
    updateBed.mutate({ bedId, status: nextStatus });
  }

  return (
    <div className="space-y-6">
      <Link href={`/dashboard/properties/${propertyId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to Property
      </Link>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">{data.propertyName} — Structure</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Manage floors, rooms, and beds.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-xs text-center">
          <p className="text-2xl font-semibold text-green-600">{vacantBeds}</p>
          <p className="text-xs text-muted-foreground mt-1">Vacant Beds</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs text-center">
          <p className="text-2xl font-semibold text-blue-600">{occupiedBeds}</p>
          <p className="text-xs text-muted-foreground mt-1">Occupied</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-xs text-center">
          <p className="text-2xl font-semibold text-orange-600">{maintenanceBeds}</p>
          <p className="text-xs text-muted-foreground mt-1">Maintenance</p>
        </div>
      </div>

      {/* Floor/Room/Bed Tree */}
      {data.floors.length > 0 ? (
        <div className="space-y-4">
          {data.floors.map((floor) => {
            const floorRooms = data.rooms.filter((r) => r.floorId === floor.id);
            return (
              <div key={floor.id} className="rounded-xl border bg-card p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">{floor.name}</h2>
                  <Badge variant="outline">{floorRooms.length} rooms</Badge>
                </div>
                {floorRooms.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {floorRooms.map((room) => {
                      const roomBeds = data.beds.filter((b) => b.roomId === room.id);
                      return (
                        <div key={room.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-sm font-medium">Room {room.number}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {room.type}
                            </Badge>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {roomBeds.map((bed) => (
                              <Button
                                key={bed.id}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBedStatusChange(bed.id, bed.status)}
                                className={`h-6 px-2 text-xs ${
                                  bed.status === "vacant"
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : bed.status === "occupied"
                                      ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                      : "bg-orange-100 text-orange-800 hover:bg-orange-200"
                                }`}
                              >
                                {bed.number}
                              </Button>
                            ))}
                            {roomBeds.length === 0 && (
                              <p className="text-xs text-muted-foreground">No beds</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No rooms on this floor.</p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground/30" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No floors defined</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add floors from the property detail page.
          </p>
        </div>
      )}
    </div>
  );
}
