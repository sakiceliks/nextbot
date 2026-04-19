import type { AutoCategory, CategoryTreeNode, VehicleTypeReference } from "@/lib/types";

export const SAHIBINDEN_ROOT_PATH = [
  "Otomotiv Ekipmanları"
] as const;

export const CATEGORY_TREE: CategoryTreeNode[] = [
  {
    id: 1,
    name: "Yedek Parça",
    children: [
      {
        id: 11,
        name: "Otomobil & Arazi Aracı",
        children: [
          {
            id: 111,
            name: "Minivan & Panelvan",
            children: [
              { id: 1111, name: "Ateşleme & Yakıt", children: [] },
              { id: 1112, name: "Egzoz", children: [] },
              { id: 1113, name: "Elektrik", children: [] },
              { id: 1114, name: "Filtre", children: [] },
              { id: 1115, name: "Fren & Debriyaj", children: [] },
              { id: 1116, name: "Isıtma & Havalandırma & Klima", children: [] },
              { id: 1117, name: "Kaporta & Karoser", children: [] },
              { id: 1118, name: "Mekanik", children: [] },
              { id: 1119, name: "Motor", children: [] },
              { id: 11110, name: "Şanzıman & Vites", children: [] },
              { id: 11111, name: "Yürüyen & Direksiyon", children: [] }
            ]
          },
          {
            id: 112,
            name: "Ticari Araçlar",
            children: [
              { id: 1121, name: "Ateşleme & Yakıt", children: [] },
              { id: 1122, name: "Egzoz", children: [] },
              { id: 1123, name: "Elektrik", children: [] },
              { id: 1124, name: "Filtre", children: [] },
              { id: 1125, name: "Fren & Debriyaj", children: [] },
              { id: 1126, name: "Isıtma & Havalandırma & Klima", children: [] },
              { id: 1127, name: "Kaporta & Karoser", children: [] },
              { id: 1128, name: "Mekanik", children: [] },
              { id: 1129, name: "Motor", children: [] },
              { id: 11210, name: "Şanzıman & Vites", children: [] },
              { id: 11211, name: "Yürüyen & Direksiyon", children: [] }
            ]
          },
          {
            id: 113,
            name: "Karavan",
            children: [
              { id: 1131, name: "Ateşleme & Yakıt", children: [] },
              { id: 1132, name: "Egzoz", children: [] },
              { id: 1133, name: "Elektrik", children: [] },
              { id: 1134, name: "Filtre", children: [] },
              { id: 1135, name: "Fren & Debriyaj", children: [] },
              { id: 1136, name: "Isıtma & Havalandırma & Klima", children: [] },
              { id: 1137, name: "Kaporta & Karoser", children: [] },
              { id: 1138, name: "Mekanik", children: [] },
              { id: 1139, name: "Motor", children: [] },
              { id: 11310, name: "Şanzıman & Vites", children: [] },
              { id: 11311, name: "Yürüyen & Direksiyon", children: [] }
            ]
          }
        ]
      }
    ]
  }
];

export const VEHICLE_TYPES: VehicleTypeReference[] = [
  {
    name: "Otomobil & Arazi Aracı",
    brands: [
      { marka: "Audi", modeller: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q5", "Q7", "TT"] },
      { marka: "BMW", modeller: ["1 Serisi", "3 Serisi", "5 Serisi", "X1", "X3", "X5"] },
      { marka: "Fiat", modeller: ["500", "Albea", "Brava", "Bravo", "Doblo", "Egea", "Linea", "Palio", "Punto", "Tipo"] },
      { marka: "Ford", modeller: ["Fiesta", "Focus", "Mondeo", "Mustang", "Puma"] },
      { marka: "Honda", modeller: ["Accord", "Civic", "CR-V", "HR-V", "Jazz"] },
      { marka: "Hyundai", modeller: ["Accent", "Elantra", "i10", "i20", "i30", "Kona", "Santa Fe", "Tucson"] },
      { marka: "Mercedes - Benz", modeller: ["A Serisi", "C Serisi", "CLA", "CLS", "E Serisi", "GLA", "GLC", "S Serisi"] },
      { marka: "Opel", modeller: ["Astra", "Corsa", "Insignia", "Mokka", "Vectra", "Zafira"] },
      { marka: "Peugeot", modeller: ["106", "206", "207", "208", "307", "308", "508"] },
      { marka: "Renault", modeller: ["Clio", "Fluence", "Megane", "Symbol", "Talisman"] },
      { marka: "Skoda", modeller: ["Fabia", "Octavia", "Rapid", "Scala", "Superb"] },
      { marka: "Toyota", modeller: ["Auris", "Avensis", "Corolla", "Prius", "Yaris"] },
      { marka: "Volkswagen", modeller: ["Beetle", "Bora", "Golf", "Jetta", "Passat", "Polo", "Scirocco"] },
      { marka: "Volvo", modeller: ["S40", "S60", "S90", "V40", "XC40", "XC60", "XC90"] }
    ]
  },
  {
    name: "Minivan & Panelvan",
    brands: [
      { marka: "Citroen", modeller: ["Berlingo", "Dispatch", "Jumper", "Jumpy", "Nemo", "SpaceTourer"] },
      { marka: "Dacia", modeller: ["Dokker", "Jogger", "Logan Van"] },
      { marka: "Fiat", modeller: ["Doblo", "Ducato", "Fiorino", "Multipla", "Scudo", "Ulysse"] },
      { marka: "Ford", modeller: ["Connect", "Courier", "Tourneo Connect", "Tourneo Courier", "Transit", "Transit Connect", "Transit Custom"] },
      { marka: "Hyundai", modeller: ["H-1", "H200", "Starex", "Staria"] },
      { marka: "Mercedes - Benz", modeller: ["Citan", "Marco Polo", "Metris", "Viano", "Vito", "V Serisi"] },
      { marka: "Nissan", modeller: ["Evalia", "NV200", "Primastar", "Serena", "Vanette"] },
      { marka: "Opel", modeller: ["Combo", "Movano", "Vivaro", "Zafira Life"] },
      { marka: "Peugeot", modeller: ["Bipper", "Expert", "Partner", "Rifter", "Traveller"] },
      { marka: "Renault", modeller: ["Express", "Express Van", "Kangoo", "Master", "Trafic"] },
      { marka: "Toyota", modeller: ["HiAce", "Proace", "ProAce City", "ProAce Verso"] },
      { marka: "Volkswagen", modeller: ["Caddy", "Caravelle", "Multivan", "Transporter"] }
    ]
  },
  {
    name: "Ticari Araçlar",
    brands: [
      { marka: "BMC", modeller: ["Fatih", "Levend", "Pro 825", "Sprinter", "TM 80"] },
      { marka: "Fiat", modeller: ["Ducato Kamyon", "Fiorino Kamyonet"] },
      { marka: "Ford", modeller: ["Cargo", "Ranger", "Transit"] },
      { marka: "Isuzu", modeller: ["D-Max", "NKR", "NPR", "NQR", "NPS"] },
      { marka: "Iveco - Otoyol", modeller: ["Daily", "Eurocargo", "Stralis", "Trakker"] },
      { marka: "MAN", modeller: ["TGA", "TGE", "TGL", "TGM", "TGS", "TGX"] },
      { marka: "Mercedes - Benz", modeller: ["Actros", "Atego", "Axor", "Sprinter", "Unimog"] },
      { marka: "Renault", modeller: ["Kerax", "Magnum", "Master", "Premium"] },
      { marka: "Scania", modeller: ["G Serisi", "P Serisi", "R Serisi", "S Serisi"] },
      { marka: "Volvo", modeller: ["FE", "FL", "FM", "FMX", "FH", "FH16"] }
    ]
  }
];

export const AUTO_CATEGORIES: AutoCategory[] = [
  { label: "Ateşleme & Yakıt", keywords: ["buji", "yakıt", "enjektör", "pompa", "ateşleme", "bobin"] },
  { label: "Egzoz", keywords: ["egzoz", "susturucu", "katalizör", "manifolt"] },
  { label: "Elektrik", keywords: ["far", "stop", "beyin", "sensör", "marş", "şarj", "akü", "lamba", "aydınlatma"] },
  { label: "Filtre", keywords: ["filtre", "yağ filtresi", "hava filtresi", "polen", "mazot filtresi"] },
  { label: "Fren & Debriyaj", keywords: ["fren", "balata", "disk", "debriyaj", "baskı balata", "volant", "kaliper"] },
  { label: "Isıtma & Havalandırma & Klima", keywords: ["klima", "radyatör", "kalorifer", "kompresör", "fan", "intercooler"] },
  { label: "Kaporta & Karoser", keywords: ["tampon", "kaput", "çamurluk", "kapı", "ayna", "panjur", "bagaj", "cam"] },
  { label: "Mekanik", keywords: ["rulman", "kayış", "gergi", "zincir", "pompa", "kasnak"] },
  { label: "Motor", keywords: ["motor", "piston", "segman", "krank", "eksantrik", "kapak", "blok", "conta"] },
  { label: "Şanzıman & Vites", keywords: ["şanzıman", "vites", "dişli", "senkromeç", "tork"] },
  { label: "Yürüyen & Direksiyon", keywords: ["amortisör", "yay", "rot", "tabla", "aks", "direksiyon", "salıncak", "porya"] }
];

export const DEFAULT_CONDITION = "İkinci El";

export const CATEGORY_OPTIONS = AUTO_CATEGORIES.map((item) => item.label);
export const VEHICLE_TYPE_OPTIONS = VEHICLE_TYPES.map((item) => item.name);
