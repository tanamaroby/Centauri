/** Small lookup tables so parsed tickets read nicely. Extend freely. */
export const AIRLINES: Record<string, string> = {
  AA: "American Airlines", AC: "Air Canada", AF: "Air France", AI: "Air India", AK: "AirAsia",
  AY: "Finnair", AZ: "ITA Airways", BA: "British Airways", BR: "EVA Air", CA: "Air China",
  CI: "China Airlines", CX: "Cathay Pacific", CZ: "China Southern", D7: "AirAsia X", DL: "Delta",
  EK: "Emirates", EY: "Etihad", FD: "Thai AirAsia", FR: "Ryanair", GA: "Garuda Indonesia",
  HA: "Hawaiian", IB: "Iberia", ID: "Batik Air", IU: "Super Air Jet", JL: "Japan Airlines",
  JQ: "Jetstar", JT: "Lion Air", KE: "Korean Air", KL: "KLM", LH: "Lufthansa", LX: "SWISS",
  MH: "Malaysia Airlines", MU: "China Eastern", NH: "ANA", NZ: "Air New Zealand", OD: "Batik Air Malaysia",
  OZ: "Asiana", PR: "Philippine Airlines", QF: "Qantas", QR: "Qatar Airways", QZ: "Indonesia AirAsia",
  SQ: "Singapore Airlines", TG: "Thai Airways", TK: "Turkish Airlines", TR: "Scoot", U2: "easyJet",
  UA: "United", VA: "Virgin Australia", VJ: "VietJet", VN: "Vietnam Airlines", VS: "Virgin Atlantic",
  QG: "Citilink", IN: "Nam Air", IW: "Wings Air", "8B": "TransNusa", SJ: "Sriwijaya Air", IP: "Pelita Air",
  "3K": "Jetstar Asia", "5J": "Cebu Pacific", "6E": "IndiGo", WN: "Southwest", B6: "JetBlue", AS: "Alaska Airlines",
};

export const AIRPORTS: Record<string, string> = {
  AMS: "Amsterdam", ATL: "Atlanta", AUH: "Abu Dhabi", BKK: "Bangkok", BCN: "Barcelona", BNE: "Brisbane",
  BOS: "Boston", BPN: "Balikpapan", CDG: "Paris", CGK: "Jakarta", CAN: "Guangzhou", CNX: "Chiang Mai",
  CTS: "Sapporo", DAD: "Da Nang", DEL: "Delhi", DFW: "Dallas", DOH: "Doha", DPS: "Bali", DXB: "Dubai",
  EWR: "Newark", FCO: "Rome", FRA: "Frankfurt", FUK: "Fukuoka", HAN: "Hanoi", HKG: "Hong Kong",
  HKT: "Phuket", HLP: "Jakarta Halim", HND: "Tokyo Haneda", ICN: "Seoul Incheon", IST: "Istanbul",
  JFK: "New York JFK", JOG: "Yogyakarta", KIX: "Osaka Kansai", KNO: "Medan", KUL: "Kuala Lumpur",
  LAX: "Los Angeles", LGK: "Langkawi", LHR: "London Heathrow", LGW: "London Gatwick", LOP: "Lombok",
  MAD: "Madrid", MEL: "Melbourne", MNL: "Manila", MUC: "Munich", NRT: "Tokyo Narita", ORD: "Chicago",
  PEN: "Penang", PEK: "Beijing", PKX: "Beijing Daxing", PVG: "Shanghai Pudong", SFO: "San Francisco",
  SEA: "Seattle", SGN: "Ho Chi Minh City", SIN: "Singapore", SUB: "Surabaya", SYD: "Sydney",
  TPE: "Taipei", UPG: "Makassar", YIA: "Yogyakarta", YVR: "Vancouver", YYZ: "Toronto", ZRH: "Zurich",
  BTH: "Batam", TNJ: "Tanjung Pinang", LBJ: "Labuan Bajo", PER: "Perth", AKL: "Auckland", CEB: "Cebu",
  MLE: "Malé", CMB: "Colombo", KTM: "Kathmandu", OKA: "Okinawa", NGO: "Nagoya", GMP: "Seoul Gimpo",
};
