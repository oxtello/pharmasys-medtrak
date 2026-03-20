"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getOpenedContainers,
  openContainerAndPrintLabel,
  updateOpenedContainer,
  type OpenedContainerRecord,
} from "@/lib/open-container-workflow";

type MedicationMatch = {
  id: string;
  barcode: string;
  medicationName: string;
  strength?: string;
  dosageForm?: string;
  manufacturer?: string;
  ndc?: string;
  deaSchedule?: string;
  inventoryUnit?: string;
  isActive?: boolean;
  isMultidose?: boolean;
  isMultiDose?: boolean;
  openedUsePolicy?: string;
  openedUseDays?: number | null;
  requiresOpenedDate?: boolean;
  requiresContainerTracking?: boolean;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string;
};

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatRemaining(value?: number | null, unit?: string | null) {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  return `${value} ${normalizeText(unit) || ""}`.trim();
}

function getContainerFromScannedBarcode(
  scannedBarcode: string,
  locationId: string
): OpenedContainerRecord | null {
  const trimmed = normalizeText(scannedBarcode);

  if (!trimmed) return null;

  const containerIdPrefix = "MEDTRAK:CONT:";
  let containerId = "";

  if (trimmed.toUpperCase().startsWith(containerIdPrefix)) {
    containerId = trimmed.slice(containerIdPrefix.length).trim();
  } else if (trimmed.toUpperCase().startsWith("CONT-")) {
    containerId = trimmed;
  } else {
    return null;
  }

  const all = getOpenedContainers();

  return (
    all.find(
      (item) =>
        item.containerId === containerId &&
        item.sourceLocation === locationId &&
        item.status === "ACTIVE"
    ) || null
  );
}

export default function DispensePage() {
  const router = useRouter();

  const [barcode, setBarcode] = useState("");
  const [patient, setPatient] = useState("");
  const [encounterId, setEncounterId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [locationId, setLocationId] = useState("");
  const [note, setNote] = useState("");

  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(true);

  const [matchedMedication, setMatchedMedication] = useState<
    MedicationMatch | undefined
  >(undefined);
  const [isLookingUpMedication, setIsLookingUpMedication] = useState(false);

  const [resolvedContainer, setResolvedContainer] =
    useState<OpenedContainerRecord | null>(null);
  const [activeContainers, setActiveContainers] = useState<
    OpenedContainerRecord[]
  >([]);
  const [showContainerDecision, setShowContainerDecision] = useState(false);
  const [showContainerPicker, setShowContainerPicker] = useState(false);
  const [showOpenNewVial, setShowOpenNewVial] = useState(false);

  const [openedDate, setOpenedDate] = useState(
    toDateInputValue(new Date().toISOString())
  );
  const [openingQuantity, setOpeningQuantity] = useState("");
  const [containerLotNumber, setContainerLotNumber] = useState("");
  const [containerExpirationDate, setContainerExpirationDate] = useState("");
  const [isOpeningContainer, setIsOpeningContainer] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isMultidoseMedication = Boolean(
    matchedMedication?.isMultidose ||
      matchedMedication?.isMultiDose ||
      matchedMedication?.requiresContainerTracking ||
      matchedMedication?.requiresOpenedDate ||
      matchedMedication?.openedUsePolicy === "DAYS_AFTER_OPEN"
  );

  useEffect(() => {
    let isMounted = true;

    async function loadLocations() {
      try {
        setIsLoadingLocations(true);

        const response = await fetch("/api/locations", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load locations");
        }

        const data = await response.json();

        const resolvedLocations: LocationOption[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.locations)
          ? data.locations
          : [];

        if (!isMounted) return;

        setLocations(resolvedLocations);

        if (resolvedLocations.length > 0) {
          setLocationId((current) => current || resolvedLocations[0].id);
        }
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setErrorMessage("Unable to load locations.");
      } finally {
        if (isMounted) {
          setIsLoadingLocations(false);
        }
      }
    }

    loadLocations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function lookupMedication() {
      const trimmedBarcode = barcode.trim();

      setErrorMessage("");
      setSuccessMessage("");

      if (!trimmedBarcode) {
        setMatchedMedication(undefined);
        setResolvedContainer(null);
        setActiveContainers([]);
        setShowContainerDecision(false);
        setShowContainerPicker(false);
        setShowOpenNewVial(false);
        return;
      }

      if (locationId) {
        const scannedContainer = getContainerFromScannedBarcode(
          trimmedBarcode,
          locationId
        );

        if (scannedContainer) {
          setResolvedContainer(scannedContainer);
          setActiveContainers([scannedContainer]);
          setShowContainerDecision(false);
          setShowContainerPicker(false);
          setShowOpenNewVial(false);

          setMatchedMedication({
            id: scannedContainer.containerId,
            barcode: scannedContainer.barcode,
            medicationName: scannedContainer.medicationName,
            strength: scannedContainer.strength || "",
            dosageForm: scannedContainer.dosageForm || "",
            manufacturer: scannedContainer.manufacturer || "",
            ndc: scannedContainer.ndc || "",
            deaSchedule: scannedContainer.deaSchedule || "",
            inventoryUnit: scannedContainer.unit || "",
            isActive: true,
            isMultidose: true,
            isMultiDose: true,
            openedUsePolicy: scannedContainer.openedUsePolicy || "",
            openedUseDays: scannedContainer.openedUseDays ?? null,
            requiresOpenedDate: scannedContainer.requiresOpenedDate,
            requiresContainerTracking: scannedContainer.requiresContainerTracking,
          });

          return;
        }
      }

      try {
        setIsLookingUpMedication(true);

        const response = await fetch(
          `/api/medications/by-barcode?barcode=${encodeURIComponent(
            trimmedBarcode
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!isMounted) return;

        if (!response.ok) {
          setMatchedMedication(undefined);
          setResolvedContainer(null);
          setActiveContainers([]);
          setShowContainerDecision(false);
          setShowContainerPicker(false);
          setShowOpenNewVial(false);
          return;
        }

        const medication = data?.medication;

        if (!medication) {
          setMatchedMedication(undefined);
          setResolvedContainer(null);
          setActiveContainers([]);
          setShowContainerDecision(false);
          setShowContainerPicker(false);
          setShowOpenNewVial(false);
          return;
        }

        setResolvedContainer(null);

        setMatchedMedication({
          id: medication.id,
          barcode: medication.barcode || trimmedBarcode,
          medicationName:
            medication.name || medication.medicationName || "Unknown medication",
          strength: medication.strength || "",
          dosageForm: medication.dosageForm || "",
          manufacturer: medication.manufacturer || "",
          ndc: medication.ndc || "",
          deaSchedule: medication.deaSchedule || "",
          inventoryUnit: medication.inventoryUnit || "",
          isActive: medication.isActive,
          isMultidose: Boolean(medication.isMultidose || medication.isMultiDose),
          isMultiDose: Boolean(medication.isMultiDose || medication.isMultidose),
          openedUsePolicy: medication.openedUsePolicy || "",
          openedUseDays:
            typeof medication.openedUseDays === "number"
              ? medication.openedUseDays
              : medication.openedUseDays
              ? Number(medication.openedUseDays)
              : null,
          requiresOpenedDate: Boolean(medication.requiresOpenedDate),
          requiresContainerTracking: Boolean(
            medication.requiresContainerTracking || medication.isMultiDose
          ),
        });
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setMatchedMedication(undefined);
        setResolvedContainer(null);
        setActiveContainers([]);
        setShowContainerDecision(false);
        setShowContainerPicker(false);
        setShowOpenNewVial(false);
      } finally {
        if (isMounted) {
          setIsLookingUpMedication(false);
        }
      }
    }

    lookupMedication();

    return () => {
      isMounted = false;
    };
  }, [barcode, locationId]);

  useEffect(() => {
    if (!matchedMedication || !locationId) {
      setActiveContainers([]);
      setResolvedContainer(null);
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(false);
      return;
    }

    if (!isMultidoseMedication) {
      setActiveContainers([]);
      setResolvedContainer(null);
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(false);
      return;
    }

    if (resolvedContainer) {
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(false);
      return;
    }

    const matchingContainers = getOpenedContainers()
      .filter(
        (item) =>
          item.status === "ACTIVE" &&
          item.barcode === matchedMedication.barcode &&
          item.sourceLocation === locationId
      )
      .sort((a, b) => {
        const aTime = new Date(
          a.createdAt || a.updatedAt || a.openedDate
        ).getTime();
        const bTime = new Date(
          b.createdAt || b.updatedAt || b.openedDate
        ).getTime();
        return bTime - aTime;
      });

    setActiveContainers(matchingContainers);

    if (matchingContainers.length === 0) {
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(true);
      return;
    }

    if (matchingContainers.length === 1) {
      setResolvedContainer(matchingContainers[0]);
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(false);
      return;
    }

    setShowContainerDecision(true);
    setShowContainerPicker(false);
    setShowOpenNewVial(false);
  }, [matchedMedication, locationId, resolvedContainer, isMultidoseMedication]);

  const quantityLabel = useMemo(() => {
    if (resolvedContainer?.unit) {
      return `Enter quantity in ${resolvedContainer.unit}`;
    }
    if (!matchedMedication?.inventoryUnit) return "Enter quantity";
    return `Enter quantity in ${matchedMedication.inventoryUnit}`;
  }, [matchedMedication, resolvedContainer]);

  const selectedLocationName = useMemo(() => {
    return locations.find((item) => item.id === locationId)?.name || "";
  }, [locations, locationId]);

  async function handleOpenNewVial() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!matchedMedication) {
      setErrorMessage("Scan or enter a valid medication barcode first.");
      return;
    }

    if (!locationId) {
      setErrorMessage("Select a location first.");
      return;
    }

    const initialQuantity = Number(openingQuantity);

    if (!openedDate) {
      setErrorMessage("Opened date is required.");
      return;
    }

    if (!Number.isFinite(initialQuantity) || initialQuantity <= 0) {
      setErrorMessage("Starting quantity must be greater than 0.");
      return;
    }

    try {
      setIsOpeningContainer(true);

      const result = openContainerAndPrintLabel({
        barcode: matchedMedication.barcode,
        sourceLocation: locationId,
        openedDate: new Date(openedDate).toISOString(),
        initialQuantity,
        unit: matchedMedication.inventoryUnit || undefined,
        lotNumber: containerLotNumber || undefined,
        expirationDate: containerExpirationDate
          ? new Date(containerExpirationDate).toISOString()
          : undefined,
        notes: note.trim() || undefined,
      });

      setResolvedContainer(result.record);
      setActiveContainers((current) => [result.record, ...current]);
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(false);
      setSuccessMessage(
        result.existedAlready
          ? "Existing opened vial loaded."
          : "Opened vial created and label downloaded."
      );
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to open new vial."
      );
    } finally {
      setIsOpeningContainer(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!matchedMedication) {
      setErrorMessage("Scan or enter a valid medication barcode first.");
      return;
    }

    if (!locationId) {
      setErrorMessage("Select a location.");
      return;
    }

    const numericQuantity = Number(quantity);

    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      setErrorMessage("Quantity must be greater than 0.");
      return;
    }

    if (!patient.trim() || !encounterId.trim()) {
      setErrorMessage("Patient and encounter ID are required.");
      return;
    }

    if (isMultidoseMedication && !resolvedContainer) {
      setErrorMessage(
        "Select an opened vial or open a new vial before dispensing a multidose medication."
      );
      return;
    }

    if (
      resolvedContainer &&
      Number.isFinite(resolvedContainer.remainingQuantity) &&
      numericQuantity > resolvedContainer.remainingQuantity
    ) {
      setErrorMessage(
        `Quantity exceeds remaining volume in selected vial (${resolvedContainer.remainingQuantity} ${resolvedContainer.unit || ""}).`
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch("/api/inventory/dispense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barcode: matchedMedication.barcode,
          locationId,
          quantity: numericQuantity,
          patient: patient.trim(),
          encounterId: encounterId.trim(),
          note: note.trim() || null,
          containerId: resolvedContainer?.containerId || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Dispense transaction failed");
      }

      if (resolvedContainer) {
        const nextRemaining = Math.max(
          0,
          Number(resolvedContainer.remainingQuantity || 0) - numericQuantity
        );

        const updated = updateOpenedContainer(resolvedContainer.containerId, {
          remainingQuantity: nextRemaining,
          status: nextRemaining <= 0 ? "DEPLETED" : "ACTIVE",
        });

        if (updated) {
          setResolvedContainer(updated);
        }
      }

      setSuccessMessage("Dispense record saved to database.");
      setBarcode("");
      setPatient("");
      setEncounterId("");
      setQuantity("");
      setNote("");
      setMatchedMedication(undefined);
      setResolvedContainer(null);
      setActiveContainers([]);
      setShowContainerDecision(false);
      setShowContainerPicker(false);
      setShowOpenNewVial(false);
      setOpenedDate(toDateInputValue(new Date().toISOString()));
      setOpeningQuantity("");
      setContainerLotNumber("");
      setContainerExpirationDate("");

      setTimeout(() => {
        router.push("/inventory");
        router.refresh();
      }, 800);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Dispense transaction failed"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-slate-900">Dispense</h1>
          <p className="mt-2 text-sm text-slate-500">
            Record a medication dispense against live database inventory.
          </p>
          <p className="mt-2 text-sm text-amber-700">
            Medication must exist in the medication master and have received
            inventory at the selected location before it can be dispensed.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="barcode"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Barcode
              </label>
              <input
                id="barcode"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="Scan manufacturer barcode or MedTrak vial tag"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
              {isLookingUpMedication ? (
                <p className="mt-2 text-xs text-slate-500">
                  Looking up medication...
                </p>
              ) : null}
            </div>

            <ReadOnlyField
              label="Medication"
              value={matchedMedication?.medicationName || ""}
            />
            <ReadOnlyField
              label="Strength"
              value={matchedMedication?.strength || ""}
            />
            <ReadOnlyField
              label="Dosage Form"
              value={matchedMedication?.dosageForm || ""}
            />
            <ReadOnlyField
              label="Manufacturer"
              value={matchedMedication?.manufacturer || ""}
            />
            <ReadOnlyField label="NDC" value={matchedMedication?.ndc || ""} />
            <ReadOnlyField
              label="DEA Schedule"
              value={matchedMedication?.deaSchedule || "Non-controlled"}
            />

            {isMultidoseMedication ? (
              <div className="md:col-span-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="text-sm font-semibold text-blue-900">
                  Multidose vial workflow
                </div>
                <p className="mt-1 text-sm text-blue-800">
                  Manufacturer barcode identifies the drug. MedTrak vial tag
                  identifies the exact opened vial.
                </p>

                {resolvedContainer ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <ReadOnlyField
                      label="Selected Vial ID"
                      value={resolvedContainer.containerId}
                    />
                    <ReadOnlyField
                      label="Remaining Quantity"
                      value={formatRemaining(
                        resolvedContainer.remainingQuantity,
                        resolvedContainer.unit
                      )}
                    />
                    <ReadOnlyField
                      label="Opened Date"
                      value={formatDateDisplay(resolvedContainer.openedDate)}
                    />
                    <ReadOnlyField
                      label="BUD"
                      value={formatDateDisplay(
                        resolvedContainer.discardAfterOpenDate ||
                          resolvedContainer.expirationDate
                      )}
                    />
                  </div>
                ) : null}

                {showContainerDecision ? (
                  <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-900">
                      This is a multidose vial. What would you like to do?
                    </p>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeContainers.length === 1) {
                            setResolvedContainer(activeContainers[0]);
                            setShowContainerDecision(false);
                            setShowContainerPicker(false);
                            setShowOpenNewVial(false);
                            return;
                          }

                          setShowContainerPicker(true);
                          setShowOpenNewVial(false);
                        }}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Use Existing Opened Vial
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowOpenNewVial(true);
                          setShowContainerPicker(false);
                        }}
                        className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                      >
                        Open New Vial
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setResolvedContainer(null);
                          setShowContainerDecision(false);
                          setShowContainerPicker(false);
                          setShowOpenNewVial(false);
                        }}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {showContainerPicker ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-900">
                      Select an opened vial for{" "}
                      {selectedLocationName || "this location"}
                    </div>

                    {activeContainers.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        No active opened vials found at this location.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        {activeContainers.map((container) => (
                          <button
                            key={container.containerId}
                            type="button"
                            onClick={() => {
                              setResolvedContainer(container);
                              setShowContainerDecision(false);
                              setShowContainerPicker(false);
                              setShowOpenNewVial(false);
                            }}
                            className="w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50"
                          >
                            <div className="text-sm font-semibold text-slate-900">
                              {container.containerId}
                            </div>
                            <div className="mt-1 text-sm text-slate-600">
                              Lot: {container.lotNumber || "—"} • Opened:{" "}
                              {formatDateDisplay(container.openedDate)} • BUD:{" "}
                              {formatDateDisplay(
                                container.discardAfterOpenDate ||
                                  container.expirationDate
                              )}{" "}
                              • Remaining:{" "}
                              {formatRemaining(
                                container.remainingQuantity,
                                container.unit
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {showOpenNewVial ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-medium text-slate-900">
                      Open new vial
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="openedDate"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Opened Date
                        </label>
                        <input
                          id="openedDate"
                          type="date"
                          value={openedDate}
                          onChange={(event) => setOpenedDate(event.target.value)}
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="openingQuantity"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Starting Quantity
                        </label>
                        <input
                          id="openingQuantity"
                          type="number"
                          min="0"
                          step="0.01"
                          value={openingQuantity}
                          onChange={(event) =>
                            setOpeningQuantity(event.target.value)
                          }
                          placeholder={
                            matchedMedication?.inventoryUnit || "Enter quantity"
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="containerLotNumber"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Lot Number
                        </label>
                        <input
                          id="containerLotNumber"
                          value={containerLotNumber}
                          onChange={(event) =>
                            setContainerLotNumber(event.target.value)
                          }
                          placeholder="Optional lot number"
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="containerExpirationDate"
                          className="mb-2 block text-sm font-medium text-slate-700"
                        >
                          Manufacturer Expiration
                        </label>
                        <input
                          id="containerExpirationDate"
                          type="date"
                          value={containerExpirationDate}
                          onChange={(event) =>
                            setContainerExpirationDate(event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={handleOpenNewVial}
                        disabled={isOpeningContainer}
                        className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {isOpeningContainer
                          ? "Opening..."
                          : "Create Vial + Download Label"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowOpenNewVial(false)}
                        className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label
                htmlFor="patient"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Patient
              </label>
              <input
                id="patient"
                value={patient}
                onChange={(event) => setPatient(event.target.value)}
                placeholder="Enter patient name or identifier"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="encounterId"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Encounter ID
              </label>
              <input
                id="encounterId"
                value={encounterId}
                onChange={(event) => setEncounterId(event.target.value)}
                placeholder="Enter encounter ID"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="quantity"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Quantity Dispensed
              </label>
              <input
                id="quantity"
                type="number"
                min="0"
                step="0.01"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                placeholder={quantityLabel}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="locationId"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Location
              </label>
              <select
                id="locationId"
                value={locationId}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  setResolvedContainer(null);
                  setActiveContainers([]);
                  setShowContainerDecision(false);
                  setShowContainerPicker(false);
                  setShowOpenNewVial(false);
                }}
                disabled={isLoadingLocations}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">
                  {isLoadingLocations ? "Loading locations..." : "Select location"}
                </option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.code ? ` (${location.code})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="note"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Note
              </label>
              <textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Optional dispense note"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {errorMessage ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={
                isSubmitting || isLoadingLocations || isLookingUpMedication
              }
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Saving..." : "Save Dispense Record"}
            </button>

            <button
              type="button"
              onClick={() => router.push("/inventory")}
              className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {value || "—"}
      </div>
    </div>
  );
}
