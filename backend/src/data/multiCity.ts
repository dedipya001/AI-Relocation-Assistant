export type CityKey = "Kolkata" | "Bengaluru" | "Pune" | "Hyderabad";

type ScoreSeed = { overall:number; women_safety:number; late_night:number; internet:number; food_access:number; commute_reliability:number };

function scores(overall:number, safety:number, internet:number, food:number, commute:number):ScoreSeed {
  return { overall, women_safety:safety, late_night:Math.max(50,safety-5), internet, food_access:food, commute_reliability:commute };
}
function loc(city:CityKey, slug:string, name:string, coordinates:[number,number], score:ScoreSeed, tags:string[], transit:string[], officeHubs:string[]){
  return { _id:`loc-${slug}`, name, slug, city, location:{type:"Point",coordinates}, summary:`${name} is a major ${city} relocation corridor with technology-office access and established residential infrastructure.`, tags, scores:score, transit, office_hubs:officeHubs, essentials:[], things_to_do:[], created_at:new Date().toISOString(), updated_at:new Date().toISOString() };
}

export const CITY_OFFICE_HUBS:Record<CityKey,Array<{name:string;coordinates:[number,number]}>> = {
  Kolkata:[{name:"Sector V IT Hub",coordinates:[88.4335,22.5762]},{name:"New Town Business District",coordinates:[88.4798,22.5797]}],
  Bengaluru:[{name:"Manyata Tech Park",coordinates:[77.6209,13.0456]},{name:"Bagmane Tech Park",coordinates:[77.6603,12.9794]},{name:"International Tech Park Whitefield",coordinates:[77.7377,12.9855]},{name:"Electronic City",coordinates:[77.6642,12.8399]}],
  Pune:[{name:"Rajiv Gandhi Infotech Park Hinjawadi",coordinates:[73.7389,18.5913]},{name:"EON IT Park Kharadi",coordinates:[73.9472,18.5514]},{name:"Magarpatta Cybercity",coordinates:[73.933,18.5165]}],
  Hyderabad:[{name:"Cyber Towers Hitec City",coordinates:[78.3772,17.4504]},{name:"DLF Cyber City Gachibowli",coordinates:[78.3489,17.4473]},{name:"Financial District",coordinates:[78.3428,17.4145]}],
};

export const CITY_TRANSIT:Record<CityKey,Array<{name:string;mode:string;corridor:string}>> = {
  Kolkata:[{name:"Green Line",mode:"metro",corridor:"Howrah Maidan–Salt Lake Sector V"},{name:"Blue Line",mode:"metro",corridor:"Dakshineswar–Kavi Subhash"}],
  Bengaluru:[{name:"Purple Line",mode:"metro",corridor:"Whitefield–Challaghatta"},{name:"Green Line",mode:"metro",corridor:"North–South corridor"},{name:"Yellow Line",mode:"metro",corridor:"RV Road–Bommasandra / Electronic City corridor"}],
  Pune:[{name:"Line 1",mode:"metro",corridor:"PCMC–Swargate"},{name:"Line 2",mode:"metro",corridor:"Vanaz–Ramwadi"},{name:"Line 3",mode:"metro",corridor:"Hinjawadi–Civil Court IT corridor"}],
  Hyderabad:[{name:"Red Line",mode:"metro",corridor:"Miyapur–LB Nagar"},{name:"Blue Line",mode:"metro",corridor:"Nagole–Raidurg / Hitec corridor"}],
};

export const MULTI_CITY_LOCALITIES = [
  loc("Bengaluru","blr-hsr-layout","HSR Layout",[77.6387,12.9116],scores(86,82,91,92,77),["startup hub","cafes","ORR access"],["Yellow Line","BMTC"],["Electronic City","Bagmane Tech Park"]),
  loc("Bengaluru","blr-koramangala","Koramangala",[77.6245,12.9352],scores(87,80,90,96,70),["startup hub","nightlife","cafes"],["Purple Line access","BMTC"],["Bagmane Tech Park"]),
  loc("Bengaluru","blr-bellandur","Bellandur / ORR",[77.676,12.9304],scores(78,72,89,84,64),["ORR tech corridor","Bellandur","office proximity"],["Blue Line corridor","BMTC Vajra"],["Bagmane Tech Park"]),
  loc("Bengaluru","blr-whitefield","Whitefield",[77.7499,12.9698],scores(84,78,91,86,82),["ITPL","tech parks","metro"],["Purple Line","BMTC Vajra"],["International Tech Park Whitefield"]),
  loc("Bengaluru","blr-indiranagar","Indiranagar",[77.6408,12.9784],scores(89,82,93,96,84),["metro","restaurants","nightlife"],["Purple Line","BMTC"],["Bagmane Tech Park"]),
  loc("Bengaluru","blr-electronic-city","Electronic City",[77.6603,12.8452],scores(80,76,88,79,80),["tech campuses","value rentals"],["Yellow Line","BMTC"],["Electronic City"]),
  loc("Bengaluru","blr-sarjapur-road","Sarjapur Road",[77.6908,12.9081],scores(79,74,88,82,64),["ORR access","new housing"],["BMTC","Blue Line corridor"],["Bagmane Tech Park"]),

  loc("Pune","pune-hinjawadi","Hinjewadi Phase 1-3",[73.7389,18.5913],scores(81,77,88,79,79),["IT park","value rentals"],["Metro Line 3","PMPML"],["Rajiv Gandhi Infotech Park Hinjawadi"]),
  loc("Pune","pune-wakad","Wakad",[73.7698,18.598],scores(82,79,89,84,76),["Hinjewadi access","family housing"],["PMPML","Metro Line 3 access"],["Rajiv Gandhi Infotech Park Hinjawadi"]),
  loc("Pune","pune-baner","Baner",[73.7868,18.559],scores(86,82,91,92,72),["cafes","Balewadi","startup corridor"],["PMPML","Metro Line 3 access"],["Rajiv Gandhi Infotech Park Hinjawadi"]),
  loc("Pune","pune-kharadi","Kharadi",[73.9474,18.5516],scores(84,79,92,87,82),["EON IT Park","office proximity"],["PMPML","Metro Line 2 access"],["EON IT Park Kharadi"]),
  loc("Pune","pune-viman-nagar","Viman Nagar",[73.9143,18.5679],scores(87,83,91,94,80),["airport","cafes","Kharadi access"],["Metro Line 2","PMPML"],["EON IT Park Kharadi"]),
  loc("Pune","pune-magarpatta","Magarpatta",[73.9326,18.5158],scores(85,82,90,88,84),["Cybercity","planned township"],["PMPML"],["Magarpatta Cybercity"]),

  loc("Hyderabad","hyd-hitec-city","Hitec City",[78.3772,17.4483],scores(85,79,92,91,84),["Cyber Towers","metro","tech hub"],["Blue Line","TSRTC"],["Cyber Towers Hitec City"]),
  loc("Hyderabad","hyd-gachibowli","Gachibowli",[78.3489,17.4401],scores(87,82,93,88,78),["financial district","tech campuses"],["TSRTC","Blue Line access"],["DLF Cyber City Gachibowli","Financial District"]),
  loc("Hyderabad","hyd-madhapur","Madhapur",[78.3915,17.4486],scores(84,78,91,93,85),["Hitec access","cafes","metro"],["Blue Line","TSRTC"],["Cyber Towers Hitec City"]),
  loc("Hyderabad","hyd-kondapur","Kondapur",[78.3647,17.4698],scores(83,80,91,88,73),["residential","Hitec access"],["TSRTC","Blue Line access"],["Cyber Towers Hitec City"]),
  loc("Hyderabad","hyd-financial-district","Financial District",[78.3428,17.4145],scores(85,82,94,78,80),["office hub","new housing"],["TSRTC"],["Financial District","DLF Cyber City Gachibowli"]),
];

export function cityPartition(city:string):string {
  const normalized=city.trim().toLowerCase();
  if(normalized.includes("bengaluru")||normalized.includes("bangalore"))return "properties_bangalore";
  if(normalized.includes("pune"))return "properties_pune";
  if(normalized.includes("hyderabad"))return "properties_hyderabad";
  if(normalized.includes("kolkata"))return "properties_kolkata";
  return `properties_${normalized.replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")||"unknown"}`;
}
