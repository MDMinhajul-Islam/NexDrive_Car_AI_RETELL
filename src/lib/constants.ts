/** Dealership timezone. All appointment and dashboard dates are shown in this zone. */
export const TIMEZONE = "America/Chicago";

export const SITE = {
  name: "NexDrive",
  tagline: "Premium new, certified and pre-owned vehicles in Plano, Texas",
  description:
    "NexDrive is a Plano, Texas dealership with thousands of inspected new, certified pre-owned and used vehicles. Transparent pricing, flexible financing and test drives booked in under a minute.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  phone: "+1-555-020-0100",
  phoneDisplay: "(555) 020-0100",
  email: "hello@nexdrive.example",
  address: {
    street: "6800 Dallas Parkway",
    city: "Plano",
    state: "TX",
    zip: "75024",
  },
  hours: [
    { days: "Monday to Friday", time: "8:30 AM to 8:00 PM" },
    { days: "Saturday", time: "9:00 AM to 7:00 PM" },
    { days: "Sunday", time: "11:00 AM to 5:00 PM" },
  ],
} as const;

// ---- Values below mirror the database check constraints exactly ------------------

export const APPOINTMENT_STATUSES = [
  "Requested",
  "Confirmed",
  "Completed",
  "Cancelled",
  "No Show",
  "Rescheduled",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy a salesperson slot. */
export const ACTIVE_APPOINTMENT_STATUSES = ["Requested", "Confirmed", "Rescheduled"] as const;

export const APPOINTMENT_TYPES = [
  "Test Drive",
  "Virtual Consultation",
  "Financing Consultation",
  "Trade-In Appraisal",
] as const;

export const APPOINTMENT_CREATED_BY = [
  "Voice Agent",
  "Website",
  "Salesperson",
  "Customer Service",
] as const;

export const VEHICLE_STATUSES = [
  "Available",
  "Reserved",
  "Sold",
  "Pending Sale",
  "In Service",
  "Arriving Soon",
  "Demo Vehicle",
  "No Test Drive",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

/** A vehicle may only have test_drive_available = true in these statuses. */
export const TEST_DRIVE_STATUSES = ["Available", "Demo Vehicle"] as const;

export const BODY_TYPES = [
  "SUV",
  "Sedan",
  "Truck",
  "Hatchback",
  "Coupe",
  "Wagon",
  "Minivan",
  "Van",
  "Convertible",
] as const;

export const VEHICLE_CONDITIONS = ["New", "Used", "Certified Pre-Owned"] as const;
export const FUEL_TYPES = ["Gasoline", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric"] as const;
export const TRANSMISSIONS = ["Automatic", "Single-Speed Automatic", "Manual", "CVT"] as const;
export const DRIVETRAINS = ["FWD", "RWD", "AWD", "4WD"] as const;

export const CUSTOMER_VEHICLE_TYPES = ["SUV", "Sedan", "Truck", "Hatchback"] as const;
export const PURCHASE_TIMELINES = [
  "Within 7 Days",
  "Within 30 Days",
  "1-3 Months",
  "3-6 Months",
  "Researching",
] as const;
export const BUYER_PROFILES = ["Hot", "Warm", "Research", "Edge Case"] as const;

export const VEHICLE_YEAR_MIN = 1980;
export const VEHICLE_YEAR_MAX = 2035;
export const BUDGET_MIN = 3000;
export const BUDGET_MAX = 100000;

export const INVENTORY_PAGE_SIZE = 12;
export const VEHICLE_IMAGE_BUCKET = "vehicle-images";
